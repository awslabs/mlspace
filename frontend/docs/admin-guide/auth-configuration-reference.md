---
outline: deep
---

# Authentication Configuration Reference

## Quick Reference

This page provides a quick reference for all AUTH_* configuration parameters used in the authentication system.

::: danger OIDC_* PARAMETERS NOT SUPPORTED
The deprecated `OIDC_*` configuration parameters (such as `OIDC_URL`, `OIDC_CLIENT_NAME`, `OIDC_VERIFY_SSL`, etc.) are **no longer supported**. You must use the `AUTH_*` parameters documented on this page. See the [Migration Mapping](#migration-mapping) section below for the complete mapping from deprecated to new parameters.
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
- **Notes**: Replaces deprecated `OIDC_URL` parameter

### AUTH_OIDC_CLIENT_ID
- **Type**: String
- **Required**: Yes (when `AUTH_IDP_TYPE` is `"oidc"`)
- **Default**: None
- **Description**: OIDC client identifier
- **Example**: `"mlspace-client"`
- **Notes**: Replaces deprecated `OIDC_CLIENT_NAME` parameter

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
- **Description**: **Not currently needed.** Reserved for future multi-domain cookie sync functionality
- **Example**: `"notebooks.mlspace.com,admin.mlspace.com"`
- **Notes**: This parameter is not currently used or expected to be set. It is reserved for future functionality to enable seamless authentication across multiple domains.

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

## Environment-Specific Examples

### Development Environment (Minimal)
```json
{
  "AUTH_OIDC_URL": "https://auth.dev.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
}
```

### Development Environment (With Client Secret)
```json
{
  "AUTH_OIDC_URL": "https://auth.dev.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "dev-client-secret-here",
  "AUTH_SESSION_TTL_HOURS": 8,
  "AUTH_OIDC_VERIFY_SSL": false,
  "AUTH_OIDC_VERIFY_SIGNATURE": false
}
```

### Production Environment
```json
{
  "AUTH_OIDC_URL": "https://auth.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-prod-client",
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "prod-client-secret-here",
  "AUTH_SESSION_TTL_HOURS": 24,
}
```

## Configuration Validation

### Required Validation Rules

1. **AUTH_OIDC_URL**: Must be valid HTTPS URL when `AUTH_IDP_TYPE` is `"oidc"`
2. **AUTH_OIDC_CLIENT_ID**: Must be non-empty string when `AUTH_IDP_TYPE` is `"oidc"`
3. **AUTH_SESSION_TTL_HOURS**: Must be positive integer between 1 and 168

### Optional Validation Rules

1. **AUTH_SYNC_DOMAINS**: Not currently used; reserved for future functionality
2. **AUTH_OIDC_USE_PKCE**: Must be boolean (true/false)
4. **AUTH_OIDC_VERIFY_SSL**: Must be boolean (true/false); should be true in production
5. **AUTH_OIDC_VERIFY_SIGNATURE**: Must be boolean (true/false); should be true in production
6. **AUTH_OIDC_CLIENT_SECRET_NAME**: Must be valid Secrets Manager secret name if specified
7. **AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME**: Must be valid Secrets Manager secret name if specified
8. **AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME**: Must be valid Secrets Manager secret name if specified


## Migration Mapping

::: danger DEPRECATED PARAMETERS NOT SUPPORTED
All `OIDC_*` parameters listed below are **no longer supported**. You must migrate to the corresponding `AUTH_*` parameters. Attempting to use deprecated parameters will result in configuration errors.
:::

### Deprecated to New Parameter Mapping

| Deprecated Parameter | New Parameter | Migration Notes |
|------------------|---------------|-----------------|
| `OIDC_URL` | `AUTH_OIDC_URL` | Direct replacement - use the same OIDC issuer URL |
| `OIDC_CLIENT_NAME` | `AUTH_OIDC_CLIENT_ID` | Direct replacement - use the same client identifier |
| `OIDC_REDIRECT_URL` | _(automatic)_ | No longer needed - redirect is automatically `/auth/callback` |
| `OIDC_VERIFY_SSL` | `AUTH_OIDC_VERIFY_SSL` | Now configurable (default: true); should be true in production |
| `OIDC_VERIFY_SIGNATURE` | `AUTH_OIDC_VERIFY_SIGNATURE` | Now configurable (default: true); should be true in production |
| `IDP_ENDPOINT_SSM_PARAM` | _(removed)_ | No longer needed - use `AUTH_OIDC_URL` directly |
| `INTERNAL_OIDC_URL` | _(removed)_ | No longer needed with server-side authentication |
| _(none)_ | `AUTH_OIDC_CLIENT_SECRET_NAME` | **New** - Secrets Manager name for client secret |
| _(none)_ | `AUTH_OIDC_CLIENT_SECRET_VALUE` | **New** - Optional deployment-time secret value |
| _(none)_ | `AUTH_OIDC_USE_PKCE` | **New** - Enable PKCE flow (default: true) |
| _(none)_ | `AUTH_SESSION_TTL_HOURS` | **New** - Session duration configuration |
| _(none)_ | `AUTH_SYNC_DOMAINS` | **New** - Reserved for future multi-domain cookie sync (not currently used) |
| _(none)_ | `AUTH_SESSION_TABLE_NAME` | **New** - DynamoDB session table name |
| _(none)_ | `AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME` | **New** - Token encryption keys (rotatable) |
| _(none)_ | `AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME` | **New** - State encryption key |

## Security Considerations

### Parameter Security

1. **Client Secrets**: Always store in Secrets Manager (not SSM Parameter Store)
2. **URLs**: Use HTTPS for all AUTH_OIDC_URL values
3. **TTL**: Set appropriate AUTH_SESSION_TTL_HOURS based on security requirements
5. **SSL Verification**: Keep AUTH_OIDC_VERIFY_SSL=true in production
6. **Signature Verification**: Keep AUTH_OIDC_VERIFY_SIGNATURE=true in production
7. **PKCE**: Keep AUTH_OIDC_USE_PKCE=true for enhanced security

### Access Control

1. **Secrets Manager Permissions**: Limit secret access to MLSpace Lambda execution role only
2. **Domain Validation**: Ensure sync domains are under your control
3. **Secret Rotation**: Use versioned secrets (token encryption keys) for rotation support

## Related Documentation

- [Authentication Configuration Guide](./bff-authentication.md)
- [Authentication Migration Guide](./bff-authentication-migration.md)
- [Install Guide](./install.md)
- [Security Documentation](./security/intro.md)