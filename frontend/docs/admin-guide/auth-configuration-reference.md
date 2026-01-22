---
outline: deep
---

# AUTH_* Configuration Reference

## Quick Reference

This page provides a quick reference for all AUTH_* configuration parameters used in the BFF authentication system.

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

### AUTH_PRIMARY_DOMAIN
- **Type**: String
- **Required**: No
- **Default**: API Gateway domain
- **Description**: Override domain for session cookies
- **Example**: `"api.mlspace.com"`
- **Notes**: Used for custom domain deployments

### AUTH_SYNC_DOMAINS
- **Type**: String (comma-separated)
- **Required**: No
- **Default**: None
- **Description**: Additional domains for cross-domain cookie sync
- **Example**: `"notebooks.mlspace.com,admin.mlspace.com"`
- **Notes**: Enables seamless authentication across multiple domains

## SSM Parameters

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

### Development Environment
```json
{
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://auth.dev.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
  "AUTH_SESSION_TTL_HOURS": 8
}
```

### Production Environment
```json
{
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://auth.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-prod-client",
  "AUTH_SESSION_TTL_HOURS": 24,
  "AUTH_PRIMARY_DOMAIN": "api.mlspace.com",
  "AUTH_SYNC_DOMAINS": "notebooks.mlspace.com,admin.mlspace.com"
}
```

### Multi-Domain Production Environment
```json
{
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://sso.company.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-enterprise",
  "AUTH_SESSION_TTL_HOURS": 12,
  "AUTH_PRIMARY_DOMAIN": "mlspace-api.company.com",
  "AUTH_SYNC_DOMAINS": "mlspace-notebooks.company.com,mlspace-admin.company.com"
}
```

## Configuration Validation

### Required Validation Rules

1. **AUTH_IDP_TYPE**: Must be `"oidc"` (case-sensitive)
2. **AUTH_OIDC_URL**: Must be valid HTTPS URL when `AUTH_IDP_TYPE` is `"oidc"`
3. **AUTH_OIDC_CLIENT_ID**: Must be non-empty string when `AUTH_IDP_TYPE` is `"oidc"`
4. **AUTH_SESSION_TTL_HOURS**: Must be positive integer between 1 and 168

### Optional Validation Rules

1. **AUTH_PRIMARY_DOMAIN**: Must be valid domain name if specified
2. **AUTH_SYNC_DOMAINS**: Must be comma-separated list of valid domain names if specified

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

### Legacy to New Parameter Mapping

| Legacy Parameter | New Parameter | Notes |
|------------------|---------------|-------|
| `OIDC_URL` | `AUTH_OIDC_URL` | Direct replacement |
| `OIDC_CLIENT_NAME` | `AUTH_OIDC_CLIENT_ID` | Direct replacement |
| `OIDC_REDIRECT_URL` | _(automatic)_ | Now handled automatically as `/auth/callback` |
| `OIDC_VERIFY_SSL` | _(removed)_ | SSL verification always enabled |
| `OIDC_VERIFY_SIGNATURE` | _(removed)_ | Signature verification always enabled |
| `IDP_ENDPOINT_SSM_PARAM` | _(removed)_ | Use `AUTH_OIDC_URL` directly |

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

#### Test SSM Parameter Access
```bash
# Verify client secret parameter exists
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Values=mlspace/auth/oidc-client-secret"

# Test parameter access (requires appropriate IAM permissions)
aws ssm get-parameter \
  --name "mlspace/auth/oidc-client-secret" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text
```

## Security Considerations

### Parameter Security

1. **Client Secrets**: Always store in SSM Parameter Store as SecureString
2. **URLs**: Use HTTPS for all AUTH_OIDC_URL values
3. **Domains**: Ensure AUTH_PRIMARY_DOMAIN and AUTH_SYNC_DOMAINS use HTTPS
4. **TTL**: Set appropriate AUTH_SESSION_TTL_HOURS based on security requirements

### Access Control

1. **SSM Permissions**: Limit SSM parameter access to MLSpace Lambda execution role
2. **KMS Keys**: Use appropriate KMS keys for SSM parameter encryption
3. **Domain Validation**: Ensure sync domains are under your control

### Monitoring

1. **Configuration Changes**: Monitor changes to AUTH_* parameters
2. **SSM Access**: Monitor access to `mlspace/auth/*` parameters
3. **Failed Authentication**: Monitor authentication failures for configuration issues

## Related Documentation

- [BFF Authentication Configuration Guide](./bff-authentication.md)
- [BFF Authentication Migration Guide](./bff-authentication-migration.md)
- [Install Guide](./install.md)
- [Security Documentation](./security/intro.md)