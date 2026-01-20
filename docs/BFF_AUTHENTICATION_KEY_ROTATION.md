# BFF Authentication Key Rotation Guide

This document provides comprehensive guidance for managing encryption key rotation in the MLSpace Backend for Frontend (BFF) authentication system.

## Overview

The BFF authentication system uses two types of encryption keys:

1. **Token Encryption Keys** - Encrypt IdP tokens stored in sessions (high impact)
2. **State Encryption Keys** - Encrypt CSRF state parameters during login flow (low impact)

## Key Rotation Strategy

### Hybrid Approach

We implement a **hybrid key rotation strategy** that balances security with operational simplicity:

- **Token Keys**: Versioned with automated rotation (zero downtime)
- **State Keys**: Simple deploy-time generation (minimal impact)

### Impact Assessment

| Key Type | Rotation Impact | Affected Users | Duration |
|----------|----------------|----------------|----------|
| Token Keys | Zero downtime | None | N/A |
| State Keys | Minimal | Users actively logging in | 1-2 minutes |

## Token Key Rotation (Automated)

### Architecture

Token encryption uses a **versioned key system** that supports graceful rotation:

- **Encryption**: Always uses the latest key version
- **Decryption**: Can decrypt with any available key version
- **Storage**: AWS Secrets Manager with versioned JSON structure
- **Rotation**: Automated via EventBridge + Lambda (90-day schedule)

### Key Structure

```json
{
  "current_version": 2,
  "keys": {
    "1": "base64-encoded-key-v1",
    "2": "base64-encoded-key-v2"
  },
  "key_type": "token",
  "rotation_date": "2024-01-15T10:30:00Z",
  "rotated_by": "key_rotation_manager"
}
```

### Automated Rotation

**Schedule**: Every 90 days via EventBridge rule

**Process**:
1. Generate new 32-byte encryption key
2. Increment version number
3. Add new key to versioned structure
4. Update Secrets Manager
5. New sessions use latest key
6. Existing sessions continue with their original key

**Zero Impact**: Users experience no disruption during rotation.

### Manual Token Key Rotation

```bash
# Rotate token keys immediately
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{
    "action": "rotate_token_key",
    "secret_arn": "/mlspace/auth/token-encryption-keys"
  }' \
  response.json

# Check rotation status
cat response.json
```

### Key Cleanup

Old key versions are automatically retained for backward compatibility. Clean up old versions periodically:

```bash
# Keep only the last 3 key versions
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{
    "action": "cleanup_old_versions",
    "secret_arn": "/mlspace/auth/token-encryption-keys",
    "keep_versions": 3
  }' \
  response.json
```

### Monitoring Token Key Rotation

```bash
# Get key rotation status
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{
    "action": "get_status",
    "secret_arn": "/mlspace/auth/token-encryption-keys"
  }' \
  response.json
```

**Response Example**:
```json
{
  "success": true,
  "current_version": 2,
  "total_versions": 2,
  "available_versions": ["1", "2"],
  "key_type": "token",
  "last_rotation": "2024-01-15T10:30:00Z"
}
```

## State Key Rotation (Deploy-Time)

### Architecture

State encryption uses a **simple Fernet key** that can be regenerated as needed:

- **Generation**: Initialization script creates key using `create_state_encryption_key()`
- **Storage**: AWS Secrets Manager (simple string value)
- **Rotation**: Regenerate via initialization script
- **Impact**: Only affects users actively logging in (1-2 minutes)

### Manual State Key Rotation

```bash
# Method 1: Re-run initialization script (recommended)
python3 scripts/initialize-auth-keys.py

# Method 2: Rotate via CDK deployment (also regenerates)
cdk deploy
```

**Impact**: Users in the middle of authentication flow will need to retry login.

## Deployment Configuration

### CDK Integration

The `AuthSecretsConstruct` creates the secrets with placeholder values:

```typescript
// In your CDK stack
const authSecrets = new AuthSecretsConstruct(this, 'AuthSecrets', {
  encryptionKey: kmsKey, // Optional: Use customer-managed KMS key
  enableTokenKeyRotation: true, // Enable automated rotation
  tokenKeyRotationSchedule: Schedule.rate(Duration.days(90)), // Optional: Custom schedule
});
```

### Key Initialization

After CDK deployment, run the initialization script to populate secrets with proper keys:

```bash
# Initialize both state and token encryption keys
python3 scripts/initialize-auth-keys.py
```

**What the script does:**
- Generates proper Fernet key for state encryption using `create_state_encryption_key()`
- Generates versioned token encryption key using `create_encryption_key()`
- Stores keys in the correct format expected by the authentication system

### Environment Variables

Lambda functions receive these environment variables:

```bash
# Token encryption (versioned)
AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME=mlspace/auth/token-encryption-keys

# State encryption (simple)
AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME=mlspace/auth/state-encryption-key
```

### Configuration Files

**lib/config.json**:
```json
{
  "AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME": "mlspace/auth/token-encryption-keys",
  "AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME": "mlspace/auth/state-encryption-key"
}
```

## Security Considerations

### Key Generation

- **Token Keys**: 32-byte cryptographically secure random keys
- **State Keys**: Fernet-compatible keys (32-byte base64-encoded)
- **Entropy**: All keys use `os.urandom()` for cryptographic randomness

### Access Control

**IAM Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:UpdateSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:/mlspace/auth/*"
      ]
    }
  ]
}
```

### Encryption at Rest

- **Secrets Manager**: Encrypted with AWS managed keys or customer-managed KMS keys
- **DynamoDB**: Session data encrypted at rest
- **Application-Level**: Tokens encrypted before storage in DynamoDB

## Troubleshooting

### Token Key Rotation Issues

**Problem**: Rotation Lambda fails
```bash
# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/mlspace-key-rotation

# Check specific error
aws logs filter-log-events \
  --log-group-name /aws/lambda/mlspace-key-rotation \
  --start-time $(date -d '1 hour ago' +%s)000
```

**Problem**: Sessions become invalid after rotation
- This should not happen with versioned keys
- Check that `VersionedTokenEncryption` is being used
- Verify key versions are properly stored

### State Key Rotation Issues

**Problem**: Users can't log in after deployment
- Expected behavior during state key rotation
- Users should retry login after 1-2 minutes
- Check that new state key was generated properly

**Problem**: State key generation fails
```bash
# Check custom resource logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/mlspace-state-key-init \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Key Validation

**Verify Token Key Structure**:
```bash
aws secretsmanager get-secret-value \
  --secret-id /mlspace/auth/token-encryption-keys \
  --query SecretString --output text | jq .
```

**Verify State Key**:
```bash
aws secretsmanager get-secret-value \
  --secret-id /mlspace/auth/state-encryption-key \
  --query SecretString --output text | jq .
```

## Migration from Legacy Keys

### Pre-Rotation Setup

If migrating from non-versioned keys:

1. **Backup existing keys**:
```bash
aws secretsmanager get-secret-value \
  --secret-id /mlspace/auth/token-encryption-key \
  --query SecretString --output text > token-key-backup.json
```

2. **Initialize versioned structure**:
```bash
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{
    "action": "initialize_versioned_secret",
    "secret_arn": "/mlspace/auth/token-encryption-keys",
    "key_type": "token"
  }' \
  response.json
```

3. **Deploy updated Lambda functions** that use `VersionedTokenEncryption`

4. **Verify compatibility** with existing sessions

### Rollback Plan

If issues occur during migration:

1. **Revert Lambda functions** to use legacy `TokenEncryption`
2. **Restore backup keys** to original secret names
3. **Investigate and fix** versioned key implementation
4. **Retry migration** after fixes

## Best Practices

### Rotation Schedule

- **Token Keys**: Every 90 days (automated)
- **State Keys**: Every deployment (automatic)
- **Emergency Rotation**: On-demand via Lambda invocation

### Monitoring

- **CloudWatch Alarms**: Monitor rotation Lambda failures
- **Session Metrics**: Track session creation/expiration rates
- **Error Rates**: Monitor authentication error rates during rotation

### Testing

- **Pre-Production**: Test rotation in staging environment
- **Load Testing**: Verify rotation works under load
- **Rollback Testing**: Practice emergency rollback procedures

### Documentation

- **Runbooks**: Document rotation procedures for operations team
- **Incident Response**: Include key rotation in security incident procedures
- **Change Management**: Include rotation schedule in change calendar

## Emergency Procedures

### Immediate Key Rotation

If keys are compromised:

1. **Rotate token keys immediately**:
```bash
aws lambda invoke \
  --function-name mlspace-key-rotation \
  --payload '{"action": "rotate_token_key", "secret_arn": "/mlspace/auth/token-encryption-keys"}' \
  response.json
```

2. **Rotate state keys via deployment**:
```bash
cdk deploy --exclusively
```

3. **Invalidate all sessions** (if necessary):
```bash
# This would require a custom Lambda function to clear the session table
# Consider implementing if needed for security incidents
```

### Key Recovery

If rotation fails and keys are lost:

1. **Check CloudTrail** for key modification events
2. **Restore from backup** if available
3. **Generate new keys** and accept that existing sessions will be invalidated
4. **Notify users** of required re-authentication

## Compliance and Auditing

### Audit Trail

All key operations are logged:
- **CloudTrail**: Secrets Manager API calls
- **Lambda Logs**: Rotation operation details
- **EventBridge**: Scheduled rotation events

### Compliance Requirements

- **Key Rotation**: Automated 90-day rotation meets most compliance requirements
- **Access Logging**: All key access is logged and auditable
- **Encryption**: Keys encrypted at rest and in transit
- **Separation of Duties**: Rotation is automated, reducing human access

### Reporting

Generate rotation reports:
```bash
# Get rotation history
aws logs filter-log-events \
  --log-group-name /aws/lambda/mlspace-key-rotation \
  --filter-pattern "Token encryption key rotated" \
  --start-time $(date -d '90 days ago' +%s)000
```