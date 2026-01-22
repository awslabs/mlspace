---
outline: deep
---

# AUTH_* Configuration Reference

## Quick Reference

This page provides a quick reference for all AUTH_* configuration parameters used in the BFF authentication system.

::: danger OIDC_* PARAMETERS NOT SUPPORTED
The legacy `OIDC_*` configuration parameters (such as `OIDC_URL`, `OIDC_CLIENT_NAME`, `OIDC_VERIFY_SSL`, etc.) are **deprecated and no longer supported**. You must use the `AUTH_*` parameters documented on this page. See the [Migration Mapping](#migration-mapping) section below for the complete mapping from legacy to new parameters.
:::

## Required Parameters

### AUTH_IDP_TYPE
- **Type**: String
- **Required**: Yes
- **Default**: None
- **Valid Values**: `"oidc"` (SAML support planned)
- **Description**: Specifies the Identity Provider type
- **Example**: `"oidc"`

### AUTH_OIDC_URL
- **Type**: String
- **Required**: Yes (when `AUTH_IDP_TYPE` is `"oidc"`)
- **Default**: None
- **Description**: OIDC issuer URL for authentication
- **Example**: `"https://auth.example.com"`
- **Notes**: Replaces legacy `OIDC_URL` parameter

### AUTH_OIDC_CLIENT_ID
- **Type**: String
- **Required**: Yes (when `AUTH_IDP_TYPE` is `"oidc"`)
- **Default**: None
- **Description**: OIDC client identifier
- **Example**: `"mlspace-client"`
- **Notes**: Replaces legacy `OIDC_CLIENT_NAME` parameter

## Optional Parameters

### AUTH_SESSION_TTL_HOURS
- **Type**: Number
- **Required**: No
- **Default**: `24`
- **Range**: `1` to `168` (1 week)
- **Description**: Session duration in hours
- **Example**: `8` (for 8-hour sessions)
- **Notes**: Affects both session cookies and DynamoDB TTL

### AUTH_SYNC_DOMAINS
- **Type**: String (comma-separated)
- **Required**: No
- **Default**: None
- **Description**: Additional domains for cross-domain cookie sync
- **Example**: `"notebooks.mlspace.com,admin.mlspace.com"`
- **Notes**: Enables seamless authentication across multiple domains. The primary domain is automatically detected from the Host header.

### AUTH_OIDC_CLIENT_SECRET_NAME
- **Type**: String
- **Required**: No
- **Default**: `"mlspace/auth/oidc-client-secret"`
- **Description**: AWS Secrets Manager secret name for OIDC client secret
- **Example**: `"mlspace/auth/oidc-client-secret"`
- **Notes**: Used for confidential OIDC client flow; secret is stored in Secrets Manager

### AUTH_OIDC_CLIENT_SECRET_VALUE
- **Type**: String
- **Required**: No
- **Default**: None
- **Description**: Optional OIDC client secret value for deployment-time configuration
- **Example**: `"your-client-secret-here"`
- **Notes**: If provided in config.json, the secret will be created/updated during deployment

### AUTH_OIDC_USE_PKCE
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Whether to use PKCE (Proof Key for Code Exchange) flow
- **Example**: `true`
- **Notes**: Recommended to keep enabled even when using client_secret for enhanced security

### AUTH_OIDC_VERIFY_SSL
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Whether to verify SSL certificates for OIDC requests
- **Example**: `true`
- **Notes**: Should only be set to false for development/testing with self-signed certificates

### AUTH_OIDC_VERIFY_SIGNATURE
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Whether to verify OIDC token signatures
- **Example**: `true`
- **Notes**: Should always be true in production for security

### AUTH_SESSION_TABLE_NAME
- **Type**: String
- **Required**: No
- **Default**: `"mlspace-auth-sessions"`
- **Description**: DynamoDB table name for storing authentication sessions
- **Example**: `"mlspace-auth-sessions"`
- **Notes**: Automatically created during deployment

### AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME
- **Type**: String
- **Required**: No
- **Default**: `"mlspace/auth/token-encryption-keys"`
- **Description**: AWS Secrets Manager secret name for versioned token encryption keys
- **Example**: `"mlspace/auth/token-encryption-keys"`
- **Notes**: Supports key rotation; automatically created during deployment

### AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME
- **Type**: String
- **Required**: No
- **Default**: `"mlspace/auth/state-encryption-key"`
- **Description**: AWS Secrets Manager secret name for state encryption key
- **Example**: `"mlspace/auth/state-encryption-key"`
- **Notes**: Used for encrypting OAuth state parameter; automatically created during deployment

## Secrets Manager Configuration

### mlspace/auth/oidc-client-secret
- **Type**: SecureString
- **Required**: No (only for confidential OIDC clients)
- **Description**: OIDC client secret for confidential client flow
- **Creation**: 
  ```bash
  aws ssm put-parameter \
    --name "mlspace/auth/oidc-client-secret" \
    --value "your-client-secret" \
    --type "SecureString"
  ```

### mlspace/auth/encryption-key
- **Type**: SecureString
- **Required**: No (auto-generated if not provided)
- **Description**: AES-256 key for token encryption
- **Notes**: Automatically generated during deployment if not specified

## Environment-Specific Examples

### Development Environment (Minimal)
```json
{
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://auth.dev.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
  "AUTH_SESSION_TTL_HOURS": 8
}
```

### Development Environment (With Client Secret)
```json
{
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://auth.dev.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "dev-client-secret-here",
  "AUTH_SESSION_TTL_HOURS": 8,
  "AUTH_OIDC_USE_PKCE": true,
  "AUTH_OIDC_VERIFY_SSL": true,
  "AUTH_OIDC_VERIFY_SIGNATURE": true
}
```

### Production Environment
```json
{
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://auth.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-prod-client",
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "prod-client-secret-here",
  "AUTH_SESSION_TTL_HOURS": 24,
  "AUTH_SYNC_DOMAINS": "notebooks.mlspace.com,admin.mlspace.com",
  "AUTH_OIDC_USE_PKCE": true,
  "AUTH_OIDC_VERIFY_SSL": true,
  "AUTH_OIDC_VERIFY_SIGNATURE": true
}
```

### Multi-Domain Production Environment
```json
{
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://sso.company.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-enterprise",
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "enterprise-client-secret-here",
  "AUTH_SESSION_TTL_HOURS": 12,
  "AUTH_SYNC_DOMAINS": "mlspace-notebooks.company.com,mlspace-admin.company.com",
  "AUTH_OIDC_USE_PKCE": true,
  "AUTH_OIDC_VERIFY_SSL": true,
  "AUTH_OIDC_VERIFY_SIGNATURE": true
}
```

## Configuration Validation

### Required Validation Rules

1. **AUTH_IDP_TYPE**: Must be `"oidc"` (case-sensitive)
2. **AUTH_OIDC_URL**: Must be valid HTTPS URL when `AUTH_IDP_TYPE` is `"oidc"`
3. **AUTH_OIDC_CLIENT_ID**: Must be non-empty string when `AUTH_IDP_TYPE` is `"oidc"`
4. **AUTH_SESSION_TTL_HOURS**: Must be positive integer between 1 and 168

### Optional Validation Rules

1. **AUTH_SYNC_DOMAINS**: Must be comma-separated list of valid domain names if specified
2. **AUTH_OIDC_USE_PKCE**: Must be boolean (true/false)
4. **AUTH_OIDC_VERIFY_SSL**: Must be boolean (true/false); should be true in production
5. **AUTH_OIDC_VERIFY_SIGNATURE**: Must be boolean (true/false); should be true in production
6. **AUTH_OIDC_CLIENT_SECRET_NAME**: Must be valid Secrets Manager secret name if specified
7. **AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME**: Must be valid Secrets Manager secret name if specified
8. **AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME**: Must be valid Secrets Manager secret name if specified

### Validation Script

```bash
#!/bin/bash
# validate-auth-config.sh

CONFIG_FILE="lib/config.json"
ENV=${1:-"dev"}

# Extract configuration for environment
AUTH_IDP_TYPE=$(jq -r ".${ENV}.AUTH_IDP_TYPE // empty" "$CONFIG_FILE")
AUTH_OIDC_URL=$(jq -r ".${ENV}.AUTH_OIDC_URL // empty" "$CONFIG_FILE")
AUTH_OIDC_CLIENT_ID=$(jq -r ".${ENV}.AUTH_OIDC_CLIENT_ID // empty" "$CONFIG_FILE")
AUTH_SESSION_TTL_HOURS=$(jq -r ".${ENV}.AUTH_SESSION_TTL_HOURS // 24" "$CONFIG_FILE")

# Validate required parameters
if [ "$AUTH_IDP_TYPE" != "oidc" ]; then
  echo "ERROR: AUTH_IDP_TYPE must be 'oidc'"
  exit 1
fi

if [ -z "$AUTH_OIDC_URL" ]; then
  echo "ERROR: AUTH_OIDC_URL is required when AUTH_IDP_TYPE is 'oidc'"
  exit 1
fi

if [ -z "$AUTH_OIDC_CLIENT_ID" ]; then
  echo "ERROR: AUTH_OIDC_CLIENT_ID is required when AUTH_IDP_TYPE is 'oidc'"
  exit 1
fi

if [ "$AUTH_SESSION_TTL_HOURS" -lt 1 ] || [ "$AUTH_SESSION_TTL_HOURS" -gt 168 ]; then
  echo "ERROR: AUTH_SESSION_TTL_HOURS must be between 1 and 168"
  exit 1
fi

echo "✅ Configuration validation passed for environment: $ENV"
```

## Migration Mapping

::: danger LEGACY PARAMETERS NOT SUPPORTED
All `OIDC_*` parameters listed below are **deprecated and no longer supported**. You must migrate to the corresponding `AUTH_*` parameters. Attempting to use legacy parameters will result in configuration errors.
:::

### Legacy to New Parameter Mapping

| Legacy Parameter | New Parameter | Migration Notes |
|------------------|---------------|-----------------|
| `OIDC_URL` | `AUTH_OIDC_URL` | Direct replacement - use the same OIDC issuer URL |
| `OIDC_CLIENT_NAME` | `AUTH_OIDC_CLIENT_ID` | Direct replacement - use the same client identifier |
| `OIDC_REDIRECT_URL` | _(automatic)_ | No longer needed - redirect is automatically `/auth/callback` |
| `OIDC_VERIFY_SSL` | `AUTH_OIDC_VERIFY_SSL` | Now configurable (default: true); should be true in production |
| `OIDC_VERIFY_SIGNATURE` | `AUTH_OIDC_VERIFY_SIGNATURE` | Now configurable (default: true); should be true in production |
| `IDP_ENDPOINT_SSM_PARAM` | _(removed)_ | No longer needed - use `AUTH_OIDC_URL` directly |
| `INTERNAL_OIDC_URL` | _(removed)_ | No longer needed with BFF pattern |
| _(none)_ | `AUTH_OIDC_CLIENT_SECRET_NAME` | **New** - Secrets Manager name for client secret |
| _(none)_ | `AUTH_OIDC_CLIENT_SECRET_VALUE` | **New** - Optional deployment-time secret value |
| _(none)_ | `AUTH_OIDC_USE_PKCE` | **New** - Enable PKCE flow (default: true) |
| _(none)_ | `AUTH_SESSION_TTL_HOURS` | **New** - Session duration configuration |
| _(none)_ | `AUTH_SYNC_DOMAINS` | **New** - Multi-domain cookie sync |
| _(none)_ | `AUTH_SESSION_TABLE_NAME` | **New** - DynamoDB session table name |
| _(none)_ | `AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME` | **New** - Token encryption keys (rotatable) |
| _(none)_ | `AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME` | **New** - State encryption key |

### Configuration File Migration

**Before (legacy):**
```typescript
// lib/constants.ts
export const OIDC_URL = 'https://auth.example.com';
export const OIDC_CLIENT_NAME = 'mlspace-client';
export const OIDC_VERIFY_SSL = true;
export const OIDC_VERIFY_SIGNATURE = true;
```

**After (BFF):**
```typescript
// lib/constants.ts
export const AUTH_IDP_TYPE = 'oidc';
export const AUTH_OIDC_URL = 'https://auth.example.com';
export const AUTH_OIDC_CLIENT_ID = 'mlspace-client';
export const AUTH_SESSION_TTL_HOURS = 24;
```

## Troubleshooting Configuration Issues

### Common Configuration Errors

#### Error: "Invalid AUTH_IDP_TYPE"
```
Cause: AUTH_IDP_TYPE is not set to "oidc"
Solution: Set AUTH_IDP_TYPE to "oidc" (case-sensitive)
```

#### Error: "OIDC URL not configured"
```
Cause: AUTH_OIDC_URL is missing or empty
Solution: Set AUTH_OIDC_URL to your OIDC issuer URL
```

#### Error: "OIDC Client ID not configured"
```
Cause: AUTH_OIDC_CLIENT_ID is missing or empty
Solution: Set AUTH_OIDC_CLIENT_ID to your OIDC client identifier
```

#### Error: "Invalid session TTL"
```
Cause: AUTH_SESSION_TTL_HOURS is outside valid range (1-168)
Solution: Set AUTH_SESSION_TTL_HOURS to a value between 1 and 168
```

### Configuration Testing

#### Test OIDC Connectivity
```bash
# Test OIDC discovery endpoint
curl -s "https://your-oidc-url/.well-known/openid-configuration" | jq .

# Verify required endpoints are available
curl -s "https://your-oidc-url/.well-known/openid-configuration" | \
  jq -r '.authorization_endpoint, .token_endpoint, .userinfo_endpoint'
```

#### Test Secrets Manager Access
```bash
# Verify client secret exists
aws secretsmanager describe-secret \
  --secret-id "mlspace/auth/oidc-client-secret"

# Test secret access (requires appropriate IAM permissions)
aws secretsmanager get-secret-value \
  --secret-id "mlspace/auth/oidc-client-secret" \
  --query 'SecretString' \
  --output text

# Verify token encryption keys secret
aws secretsmanager describe-secret \
  --secret-id "mlspace/auth/token-encryption-keys"

# Verify state encryption key secret
aws secretsmanager describe-secret \
  --secret-id "mlspace/auth/state-encryption-key"
```

## Security Considerations

### Parameter Security

1. **Client Secrets**: Always store in Secrets Manager (not SSM Parameter Store)
2. **URLs**: Use HTTPS for all AUTH_OIDC_URL values
3. **Domains**: Ensure AUTH_SYNC_DOMAINS use HTTPS
4. **TTL**: Set appropriate AUTH_SESSION_TTL_HOURS based on security requirements
5. **SSL Verification**: Keep AUTH_OIDC_VERIFY_SSL=true in production
6. **Signature Verification**: Keep AUTH_OIDC_VERIFY_SIGNATURE=true in production
7. **PKCE**: Keep AUTH_OIDC_USE_PKCE=true for enhanced security

### Access Control

1. **Secrets Manager Permissions**: Limit secret access to MLSpace Lambda execution role only
2. **KMS Keys**: Use appropriate KMS keys for Secrets Manager encryption
3. **Domain Validation**: Ensure sync domains are under your control
4. **Secret Rotation**: Use versioned secrets (token encryption keys) for rotation support

### Monitoring

1. **Configuration Changes**: Monitor changes to AUTH_* parameters in constants.ts and config.json
2. **Secrets Access**: Monitor access to `mlspace/auth/*` secrets in CloudTrail
3. **Failed Authentication**: Monitor authentication failures for configuration issues
4. **Secret Rotation**: Monitor secret rotation events and ensure smooth transitions

## Related Documentation

- [BFF Authentication Configuration Guide](./bff-authentication.md)
- [BFF Authentication Migration Guide](./bff-authentication-migration.md)
- [Install Guide](./install.md)
- [Security Documentation](./security/intro.md)