---
outline: deep
---

# Enhanced Authentication Configuration

## Overview

The enhanced authentication system provides improved security and enterprise Identity Provider (IdP) integration. Authentication is handled server-side, enabling support for enterprise IdPs that require client secrets, while providing better security through secure cookies (HttpOnly cookies that can't be accessed by JavaScript and are only sent to the server with requests) and simplified application code.

::: danger DEPRECATED OIDC_* PARAMETERS NOT SUPPORTED
The deprecated `OIDC_*` configuration parameters (such as `OIDC_URL`, `OIDC_CLIENT_NAME`, `OIDC_VERIFY_SSL`, `OIDC_REDIRECT_URL`, etc.) are **no longer supported**. You must use the `AUTH_*` parameters documented below. See the [Migration from Deprecated OIDC Configuration](#migration-from-deprecated-oidc-configuration) section for migration instructions.
:::

## Configuration Parameters

### Required AUTH_* Parameters

The enhanced authentication system uses `AUTH_*` configuration parameters that replace the deprecated `OIDC_*` parameters:

| Parameter | Description | Example | Required |
|-----------|-------------|---------|----------|
| `AUTH_IDP_TYPE` | Identity Provider type | `"oidc"` | Yes |
| `AUTH_OIDC_URL` | OIDC issuer URL (replaces `OIDC_URL`) | `"https://auth.example.com"` | Yes (for OIDC) |
| `AUTH_OIDC_CLIENT_ID` | OIDC client identifier (replaces `OIDC_CLIENT_NAME`) | `"mlspace-client"` | Yes (for OIDC) |
| `AUTH_SESSION_TTL_HOURS` | Session duration in hours | `24` | No (default: 24) |

### Optional AUTH_* Parameters

| Parameter | Description | Example | Default |
|-----------|-------------|---------|---------|
| `AUTH_SYNC_DOMAINS` | Comma-separated list of additional domains for cookie sync | `"notebooks.mlspace.com,admin.mlspace.com"` | None |
| `AUTH_OIDC_CLIENT_SECRET_NAME` | Secrets Manager secret name for OIDC client secret | `"mlspace/auth/oidc-client-secret"` | `"mlspace/auth/oidc-client-secret"` |
| `AUTH_OIDC_CLIENT_SECRET_VALUE` | Optional OIDC client secret value for deployment-time configuration | `"your-secret-here"` | None |
| `AUTH_OIDC_USE_PKCE` | Whether to use PKCE flow (recommended) | `true` | `true` |
| `AUTH_OIDC_VERIFY_SSL` | Whether to verify SSL certificates for OIDC requests | `true` | `true` |
| `AUTH_OIDC_VERIFY_SIGNATURE` | Whether to verify OIDC token signatures | `true` | `true` |
| `AUTH_SESSION_TABLE_NAME` | DynamoDB table name for authentication sessions | `"mlspace-auth-sessions"` | `"mlspace-auth-sessions"` |
| `AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME` | Secrets Manager secret name for token encryption keys (versioned) | `"mlspace/auth/token-encryption-keys"` | `"mlspace/auth/token-encryption-keys"` |
| `AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME` | Secrets Manager secret name for state encryption key | `"mlspace/auth/state-encryption-key"` | `"mlspace/auth/state-encryption-key"` |

## Configuration Setup

### 1. Update lib/constants.ts

Replace the deprecated OIDC constants with new AUTH constants:

```typescript
// Remove these deprecated constants:
// export const OIDC_URL = '';
// export const OIDC_CLIENT_NAME = '';

// Add these new AUTH constants:
export const AUTH_IDP_TYPE = 'oidc';
export const AUTH_OIDC_URL = '';
export const AUTH_OIDC_CLIENT_ID = '';
export const AUTH_OIDC_CLIENT_SECRET_NAME = 'mlspace/auth/oidc-client-secret';
export const AUTH_OIDC_CLIENT_SECRET_VALUE = ''; // Optional: set during deployment
export const AUTH_OIDC_USE_PKCE = true;
export const AUTH_OIDC_VERIFY_SSL = true;
export const AUTH_OIDC_VERIFY_SIGNATURE = true;
export const AUTH_SESSION_TTL_HOURS = 24;
export const AUTH_SYNC_DOMAINS = '';
export const AUTH_SESSION_TABLE_NAME = 'mlspace-auth-sessions';
export const AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME = 'mlspace/auth/token-encryption-keys';
export const AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME = 'mlspace/auth/state-encryption-key';
```

### 2. Update lib/config.json

Update your environment-specific configuration file:

```json
{
  "dev": {
    "AUTH_IDP_TYPE": "oidc",
    "AUTH_OIDC_URL": "https://auth.dev.example.com",
    "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
    "AUTH_OIDC_CLIENT_SECRET_VALUE": "dev-client-secret-here",
    "AUTH_OIDC_USE_PKCE": true,
    "AUTH_OIDC_VERIFY_SSL": true,
    "AUTH_OIDC_VERIFY_SIGNATURE": true,
    "AUTH_SESSION_TTL_HOURS": 8,
    "AUTH_SYNC_DOMAINS": ""
  },
  "prod": {
    "AUTH_IDP_TYPE": "oidc",
    "AUTH_OIDC_URL": "https://auth.example.com",
    "AUTH_OIDC_CLIENT_ID": "mlspace-prod-client",
    "AUTH_OIDC_CLIENT_SECRET_VALUE": "prod-client-secret-here",
    "AUTH_OIDC_USE_PKCE": true,
    "AUTH_OIDC_VERIFY_SSL": true,
    "AUTH_OIDC_VERIFY_SIGNATURE": true,
    "AUTH_SESSION_TTL_HOURS": 24,
    "AUTH_SYNC_DOMAINS": "notebooks.mlspace.com,admin.mlspace.com"
  }
}
```

### 3. Update lib/utils/configTypes.ts

Add the new AUTH properties to the MLSpaceConfig interface:

```typescript
export interface MLSpaceConfig {
  // ... existing properties ...
  
  // Remove deprecated OIDC properties:
  // OIDC_URL?: string;
  // OIDC_CLIENT_NAME?: string;
  
  // Add new AUTH properties:
  AUTH_IDP_TYPE: string;
  AUTH_OIDC_URL?: string;
  AUTH_OIDC_CLIENT_ID?: string;
  AUTH_OIDC_CLIENT_SECRET_NAME?: string;
  AUTH_OIDC_CLIENT_SECRET_VALUE?: string;
  AUTH_OIDC_USE_PKCE?: boolean;
  AUTH_OIDC_VERIFY_SSL?: boolean;
  AUTH_OIDC_VERIFY_SIGNATURE?: boolean;
  AUTH_SESSION_TTL_HOURS?: number;
  AUTH_SYNC_DOMAINS?: string;
  AUTH_SESSION_TABLE_NAME?: string;
  AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME?: string;
  AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME?: string;
}
```

## Secrets Manager Setup for Client Secret

For OIDC deployments that require client secrets (confidential client flow), you can configure the client secret in two ways:

### Option 1: Deployment-Time Configuration (Recommended)

Add the client secret to your `lib/config.json` file:

```json
{
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "your-client-secret-here"
}
```

The secret will be automatically created in AWS Secrets Manager during deployment.

### Option 2: Manual Secrets Manager Configuration

If you prefer to manage the secret manually:

Using AWS CLI:

```bash
# Create new secret
aws secretsmanager create-secret \
  --name "mlspace/auth/oidc-client-secret" \
  --secret-string '{"client_secret":"your-client-secret-here","configured":true}' \
  --description "OIDC client secret for MLSpace authentication"

# Or update existing secret
aws secretsmanager update-secret \
  --secret-id "mlspace/auth/oidc-client-secret" \
  --secret-string '{"client_secret":"your-new-secret-here","configured":true}'
```

Using AWS Console:
1. Navigate to AWS Secrets Manager
2. Click "Store a new secret"
3. Select "Other type of secret"
4. Add key-value pairs:
   - Key: `client_secret`, Value: Your OIDC client secret
   - Key: `configured`, Value: `true`
5. Set Secret name: `mlspace/auth/oidc-client-secret`
6. Click "Store"

::: info SECRETS MANAGER VS SSM PARAMETER STORE
MLSpace uses AWS Secrets Manager (not SSM Parameter Store) for authentication secrets. Secrets Manager provides better support for secret rotation, versioning, and automatic generation.
:::

### Lambda Access Permissions

The MLSpace Lambda execution role needs permission to read secrets:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:{AWS_REGION}:{AWS_ACCOUNT}:secret:mlspace/auth/*"
      ]
    }
  ]
}
```

### Encryption Key Access

If using a custom KMS key for Secrets Manager encryption, ensure the Lambda execution role has decrypt permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": [
        "arn:aws:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{KMS_KEY_ID}"
      ]
    }
  ]
}
```

## Multi-Domain Cookie Synchronization

For deployments spanning multiple domains (e.g., separate domains for API, notebooks, and admin interfaces), configure cross-domain cookie synchronization.

### Configuration

Set the `AUTH_SYNC_DOMAINS` parameter with a comma-separated list of additional domains:

```json
{
  "AUTH_SYNC_DOMAINS": "notebooks.mlspace.com,admin.mlspace.com"
}
```

::: tip Domain Detection
The system automatically uses the Host header to determine the primary domain where authentication is initiated.
:::

### How It Works

1. **Primary Authentication**: User authenticates on the current domain (detected from Host header)
2. **OTAC Generation**: System generates One-Time Authentication Code (OTAC)
3. **Domain Chain**: Browser is redirected through each sync domain in sequence
4. **Cookie Setting**: Each domain validates the OTAC and sets its own session cookie
5. **Final Redirect**: User is redirected to their original destination

### Security Considerations

- OTACs expire after 5 minutes
- OTACs are single-use only
- Each domain validates OTAC independently
- Session cookies are domain-specific with `HttpOnly` and `Secure` flags

### Example Flow

```
1. User visits: https://app.mlspace.com/dashboard
2. Redirected to: https://api.mlspace.com/auth/login
3. OIDC authentication completes
4. Redirected to: https://notebooks.mlspace.com/auth/sync?otac=xyz&next=admin.mlspace.com&final=https://app.mlspace.com/dashboard
5. Redirected to: https://admin.mlspace.com/auth/sync?otac=abc&final=https://app.mlspace.com/dashboard
6. Final redirect: https://app.mlspace.com/dashboard
```

## Migration from Deprecated OIDC Configuration

### Pre-Migration Checklist

Before migrating to the enhanced authentication system, ensure you have:

- [ ] Backup of current `lib/constants.ts` and `lib/config.json`
- [ ] OIDC client secret (if using confidential client flow)
- [ ] Access to AWS Systems Manager Parameter Store
- [ ] Understanding of your current OIDC configuration
- [ ] Planned maintenance window for deployment

### Migration Steps

#### 1. Update Configuration Files

**lib/constants.ts changes:**
```typescript
// BEFORE (Deprecated OIDC)
export const OIDC_URL = 'https://auth.example.com';
export const OIDC_CLIENT_NAME = 'mlspace-client';
export const OIDC_REDIRECT_URL = undefined;
export const OIDC_VERIFY_SSL = true;
export const OIDC_VERIFY_SIGNATURE = true;

// AFTER (Enhanced Authentication)
export const AUTH_IDP_TYPE = 'oidc';
export const AUTH_OIDC_URL = 'https://auth.example.com';
export const AUTH_OIDC_CLIENT_ID = 'mlspace-client';
export const AUTH_OIDC_CLIENT_SECRET_NAME = 'mlspace/auth/oidc-client-secret';
export const AUTH_OIDC_CLIENT_SECRET_VALUE = ''; // Optional: set in config.json
export const AUTH_OIDC_USE_PKCE = true;
export const AUTH_OIDC_VERIFY_SSL = true;
export const AUTH_OIDC_VERIFY_SIGNATURE = true;
export const AUTH_SESSION_TTL_HOURS = 24;
export const AUTH_SYNC_DOMAINS = '';
```

**lib/config.json changes:**
```json
// BEFORE
{
  "OIDC_URL": "https://auth.example.com",
  "OIDC_CLIENT_NAME": "mlspace-client"
}

// AFTER
{
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://auth.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-client",
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "your-client-secret-here",
  "AUTH_OIDC_USE_PKCE": true,
  "AUTH_OIDC_VERIFY_SSL": true,
  "AUTH_OIDC_VERIFY_SIGNATURE": true,
  "AUTH_SESSION_TTL_HOURS": 24
}
```

#### 2. Set Up Client Secret (If Required)

If your OIDC provider requires a client secret, add it to your `lib/config.json`:

```json
{
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "your-client-secret"
}
```

Or create it manually in Secrets Manager:

```bash
# Store client secret in Secrets Manager
aws secretsmanager create-secret \
  --name "mlspace/auth/oidc-client-secret" \
  --secret-string '{"client_secret":"your-client-secret","configured":true}'
```

#### 3. Update OIDC Provider Configuration

Update your OIDC provider's redirect URI configuration:

**Before (Deprecated):**
- Redirect URI: `https://your-api-gateway.execute-api.region.amazonaws.com/Prod/`

**After (Enhanced Authentication):**
- Redirect URI: `https://your-api-gateway.execute-api.region.amazonaws.com/Prod/auth/callback`

#### 4. Deploy Updated Configuration

```bash
# Build frontend with new configuration
cd frontend/
npm run clean && npm install && npm run build

# Deploy CDK changes
cd ../
cdk deploy --all
```

#### 5. Verify Migration

After deployment, verify the migration:

1. **Test Authentication Flow:**
   - Visit your MLSpace application
   - Verify redirect to `/auth/login`
   - Complete OIDC authentication
   - Verify successful redirect back to application

2. **Check Session Management:**
   - Verify session cookies are set with `HttpOnly` flag
   - Test automatic token refresh
   - Test logout functionality

3. **Validate API Calls:**
   - Verify API calls work without Authorization header
   - Check that session cookies are included in requests

### Rollback Plan

If issues occur during migration, you can rollback:

1. **Revert Configuration Files:**
   ```bash
   git checkout HEAD~1 -- lib/constants.ts lib/config.json lib/utils/configTypes.ts
   ```

2. **Rebuild and Redeploy:**
   ```bash
   cd frontend/
   npm run build
   cd ../
   cdk deploy --all
   ```

3. **Update OIDC Provider:**
   - Revert redirect URI to original value

### Common Migration Issues

#### Issue: Authentication Loops

**Symptoms:** User gets stuck in redirect loop between IdP and MLSpace

**Solution:** 
- Verify OIDC redirect URI is correctly set to `/auth/callback`
- Check that `AUTH_OIDC_CLIENT_ID` matches IdP configuration

#### Issue: Session Cookies Not Set

**Symptoms:** User can authenticate but gets 401 errors on API calls

**Solution:**
- Verify cookies are being set with correct domain
- Check browser developer tools for cookie presence
- Ensure HTTPS is being used (cookies won't set over HTTP in production)

#### Issue: Client Secret Errors

**Symptoms:** Authentication fails with "invalid_client" error

**Solution:**
- Verify SSM parameter `mlspace/auth/oidc-client-secret` exists
- Check Lambda execution role has SSM read permissions
- Ensure client secret value is correct

#### Issue: Cross-Domain Sync Failures

**Symptoms:** Authentication works on primary domain but fails on sync domains

**Solution:**
- Verify `AUTH_SYNC_DOMAINS` configuration
- Check that all domains resolve correctly
- Ensure OTAC generation and validation is working

## Troubleshooting

### Enable Debug Logging

Add debug environment variables to Lambda functions:

```typescript
const authCommonEnv = {
  // ... existing environment variables ...
  LOG_LEVEL: 'DEBUG',
  DEBUG_AUTH: 'true'
};
```

### Check CloudWatch Logs

Monitor these log groups for authentication issues:

- `/aws/lambda/mls-lambda-auth-login`
- `/aws/lambda/mls-lambda-auth-callback`
- `/aws/lambda/mls-lambda-auth-identity`
- `/aws/lambda/mls-lambda-auth-logout`
- `/aws/lambda/mls-lambda-authorizer`

### Common Log Messages

**Successful Authentication:**
```
[INFO] User authenticated successfully: user@example.com
[INFO] Session created: session:550e8400-e29b-41d4-a716-446655440000
[INFO] Session cookie set for domain: api.mlspace.com
```

**Authentication Failures:**
```
[ERROR] OIDC token exchange failed: invalid_grant
[ERROR] Session validation failed: session not found
[ERROR] OTAC validation failed: code expired
```

### Performance Monitoring

Monitor these CloudWatch metrics:

- **Authentication Success Rate:** Custom metric tracking successful logins
- **Session Duration:** Average time between login and logout
- **Token Refresh Rate:** Frequency of automatic token refreshes
- **OTAC Usage:** Cross-domain sync success rate

## Security Considerations

### Session Security

- **HttpOnly Cookies:** Prevents JavaScript access to session tokens
- **Secure Flag:** Ensures cookies only sent over HTTPS
- **SameSite=Strict:** Prevents CSRF attacks
- **Session Encryption:** All IdP tokens encrypted before storage

### Token Management

- **Automatic Refresh:** Tokens refreshed transparently before expiration
- **Secure Storage:** Tokens stored encrypted in DynamoDB
- **TTL Cleanup:** Expired sessions automatically deleted

### Cross-Domain Security

- **OTAC Expiration:** One-time codes expire after 5 minutes
- **Single Use:** OTACs can only be used once
- **Domain Validation:** Each domain validates OTACs independently

### Monitoring and Alerting

Set up CloudWatch alarms for:

- High authentication failure rates
- Unusual session creation patterns
- Failed OTAC validations
- SSM parameter access failures

## Support and Maintenance

### Regular Maintenance Tasks

1. **Monitor SSM Parameters:** Ensure client secrets remain valid
2. **Review Session Metrics:** Check for unusual authentication patterns
3. **Update Dependencies:** Keep authentication libraries current
4. **Rotate Secrets:** Periodically rotate client secrets and encryption keys

### Backup and Recovery

1. **Configuration Backup:** Regularly backup configuration files
2. **SSM Parameter Backup:** Export SSM parameters for disaster recovery
3. **Session Data:** DynamoDB sessions are automatically backed up with TTL

### Scaling Considerations

- **DynamoDB Capacity:** Monitor read/write capacity for session table
- **Lambda Concurrency:** Ensure sufficient concurrency for auth endpoints
- **API Gateway Limits:** Monitor request rates for authentication endpoints