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

### Key Cleanup

Old key versions are automatically retained for backward compatibility and cleaned up during rotation based on the configured retention policy (default: 3 versions).

### Monitoring Token Key Rotation

Monitor rotation through CloudWatch Logs and AWS Secrets Manager console:

- **CloudWatch Logs**: Check `/aws/lambda/mlspace-key-rotation` log group
- **Secrets Manager Console**: View rotation configuration and history
- **CloudWatch Metrics**: Monitor rotation success/failure rates

## State Key Rotation (Deploy-Time)

### Architecture

State encryption uses a **simple Fernet key** that can be regenerated as needed:

- **Generation**: Initialization script creates key using `create_state_encryption_key()`
- **Storage**: AWS Secrets Manager (simple string value)
- **Rotation**: Regenerate via initialization script
- **Impact**: Only affects users actively logging in (1-2 minutes)
- **Rotation**: Automatic via configured rotation schedule

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
        "arn:aws:secretsmanager:*:*:secret:mlspace/auth/*"
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
- Check CloudWatch Logs for the `/aws/lambda/mlspace-key-rotation` log group
- Review CloudWatch metrics for rotation failures
- Verify IAM permissions for the rotation Lambda function

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
- Check CloudWatch logs for the rotation Lambda function
- Verify the rotation schedule is configured correctly in AWS Secrets Manager

### Key Validation

Verify key structure using AWS Secrets Manager console or by checking CloudWatch logs for the rotation Lambda function.

## Migration from Legacy Keys

The system now uses versioned keys by default. If migrating from a legacy deployment:

1. **Backup existing keys** using AWS Secrets Manager console or CLI
2. **Deploy updated infrastructure** with versioned key support
3. **Initialize secrets** using the initialization script
4. **Verify rotation schedule** is configured correctly

### Rollback Plan

If issues occur during migration:

1. **Check CloudWatch logs** for rotation Lambda errors
2. **Verify secret structure** matches expected versioned format
3. **Contact support** if issues persist

## Best Practices

### Rotation Schedule

- **Token Keys**: Every 90 days (automated via AWS Secrets Manager)
- **State Keys**: Every 90 days (automated via AWS Secrets Manager)

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

### Key Compromise Response

If keys are compromised:

1. **Trigger immediate rotation**: Use AWS Secrets Manager console to trigger rotation immediately
2. **Monitor rotation completion**: Check CloudWatch logs for rotation Lambda execution
3. **Invalidate sessions if necessary**: Consider clearing the session table for critical security incidents

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

Monitor rotation history through:
- **CloudWatch Logs Insights**: Query rotation events in the Lambda log group
- **AWS Secrets Manager Console**: View rotation history for each secret
- **CloudTrail**: Audit all Secrets Manager API calls