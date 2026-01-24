---
outline: deep
---

# Authentication Configuration

## Overview

Authentication is handled server-side, enabling support for enterprise IdPs that require client secrets, while providing better security through secure cookies (HttpOnly cookies that can't be accessed by JavaScript and are only sent to the server with requests) and simplified application code.

::: danger DEPRECATED OIDC_* PARAMETERS NOT SUPPORTED
The deprecated `OIDC_*` configuration parameters (such as `OIDC_URL`, `OIDC_CLIENT_NAME`, `OIDC_VERIFY_SSL`, `OIDC_REDIRECT_URL`, etc.) are **no longer supported**. You must use the `AUTH_*` parameters documented below. See the [Migration from Deprecated OIDC Configuration](#migration-from-deprecated-oidc-configuration) section for migration instructions.
:::

## Configuration Parameters

### Required AUTH_* Parameters

The authentication system uses `AUTH_*` configuration parameters that replace the deprecated `OIDC_*` parameters:

| Parameter | Description | Example | Required |
|-----------|-------------|---------|----------|
| `AUTH_OIDC_URL` | OIDC issuer URL (replaces `OIDC_URL`) | `"https://auth.example.com"` | Yes (for OIDC) |
| `AUTH_OIDC_CLIENT_ID` | OIDC client identifier (replaces `OIDC_CLIENT_NAME`) | `"mlspace-client"` | Yes (for OIDC) |

### Optional AUTH_* Parameters

| Parameter | Description | Example | Default |
|-----------|-------------|---------|---------|
| `AUTH_IDP_TYPE` | Identity Provider type | `"oidc"` | No |
| `AUTH_SESSION_TTL_HOURS` | Session duration in hours | `24` | No (default: 24) |
| `AUTH_SYNC_DOMAINS` | **Not currently needed.** Reserved for future multi-domain cookie sync functionality | `"notebooks.mlspace.com,admin.mlspace.com"` | None |
| `AUTH_OIDC_CLIENT_SECRET_NAME` | Secrets Manager secret name for OIDC client secret | `"mlspace/auth/oidc-client-secret"` | `"mlspace/auth/oidc-client-secret"` |
| `AUTH_OIDC_CLIENT_SECRET_VALUE` | Optional OIDC client secret value for deployment-time configuration | `"your-secret-here"` | None |
| `AUTH_OIDC_USE_PKCE` | Whether to use PKCE flow (recommended) | `true` | `true` |
| `AUTH_OIDC_VERIFY_SSL` | Whether to verify SSL certificates for OIDC requests | `true` | `true` |
| `AUTH_OIDC_VERIFY_SIGNATURE` | Whether to verify OIDC token signatures | `true` | `true` |
| `AUTH_SESSION_TABLE_NAME` | DynamoDB table name for authentication sessions | `"mlspace-auth-sessions"` | `"mlspace-auth-sessions"` |
| `AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME` | Secrets Manager secret name for token encryption keys (versioned) | `"mlspace/auth/token-encryption-keys"` | `"mlspace/auth/token-encryption-keys"` |
| `AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME` | Secrets Manager secret name for state encryption key | `"mlspace/auth/state-encryption-key"` | `"mlspace/auth/state-encryption-key"` |

## Configuration Setup

### Update lib/config.json or lib/constants.ts

Update your environment-specific configuration file:

```json
{
    "AUTH_IDP_TYPE": "oidc",
    "AUTH_OIDC_URL": "https://auth.dev.example.com",
    "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
    "AUTH_OIDC_CLIENT_SECRET_VALUE": "dev-client-secret-here",
    "AUTH_OIDC_USE_PKCE": true,
    "AUTH_OIDC_VERIFY_SSL": true,
    "AUTH_OIDC_VERIFY_SIGNATURE": true,
    "AUTH_SESSION_TTL_HOURS": 8,
}
```

## Migration from Deprecated OIDC Configuration

If you're migrating from the deprecated `OIDC_*` parameters, see the [Authentication Migration Guide](./bff-authentication-migration.md) for detailed step-by-step instructions.