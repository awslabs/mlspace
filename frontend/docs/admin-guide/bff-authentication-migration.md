---
outline: deep
---

# Authentication Migration Guide

## Overview

This guide provides detailed step-by-step instructions for migrating from the deprecated OIDC authentication system to the current authentication system.

## Migration Benefits

- **Enhanced Security**: Session-based authentication with HttpOnly cookies prevents token exposure in browser
- **Enterprise IdP Support**: Support for OIDC with client secrets and SAML protocol
- **Simplified Application**: No token management in browser JavaScript
- **Cross-Domain Support**: Seamless authentication across multiple domains
- **Automatic Token Refresh**: Server-side token management and automatic refresh

## Pre-Migration Checklist

Before starting the migration, ensure you have:

- [ ] Backup of current `lib/constants.ts` and `lib/config.json`
- [ ] OIDC client secret (if using confidential client flow)
- [ ] Understanding of your current OIDC configuration
- [ ] Planned maintenance window for deployment
- [ ] Reviewed the [Authentication Configuration Guide](./bff-authentication.md)

## Pre-Migration Assessment

### Current Configuration Review

Before starting the migration, document your current configuration:

1. **Current OIDC Settings:**
   ```bash
   # Review current constants
   grep -E "OIDC_|IDP_" lib/constants.ts
   
   # Review current config
   cat lib/config.json | jq '.OIDC_URL, .OIDC_CLIENT_NAME'
   ```

2. **OIDC Provider Configuration:**
   - Current redirect URI
   - Client type (public vs confidential)
   - Available client secret (if confidential client)
   - Supported authentication flows

3. **Current Deployment:**
   - Environment (dev/staging/prod)
   - Custom domains in use

### Compatibility Check

Verify your OIDC provider supports the authentication requirements:

- ✅ Authorization Code flow
- ✅ Client secret support (for confidential clients)
- ✅ Token refresh capability
- ✅ Configurable redirect URIs

## Migration Planning

### Maintenance Window

Plan for a maintenance window during migration:

- **Estimated Downtime**: 15-30 minutes
- **User Impact**: All users will need to re-authenticate
- **Rollback Time**: 10-15 minutes if needed

### Backup Strategy

Create backups before migration:

```bash
# Backup configuration files
cp lib/constants.ts lib/constants.ts.backup
cp lib/config.json lib/config.json.backup
```

## Step-by-Step Migration

### Step 1: Update Configuration Files (example)

#### 1.1 Update lib/constants.ts (if this was used for previous configuration)

```typescript
// REMOVE these deprecated constants:
export const OIDC_URL = 'https://auth.example.com';
export const OIDC_CLIENT_NAME = 'mlspace-client';
export const OIDC_REDIRECT_URL = undefined;
export const OIDC_VERIFY_SSL = true;
export const OIDC_VERIFY_SIGNATURE = true;

// ADD these new AUTH constants:
export const AUTH_OIDC_URL = 'https://auth.example.com';
export const AUTH_OIDC_CLIENT_ID = 'mlspace-client';

// ADD any additioanl AUTH_OIDC* configuration parameters.
```

#### 1.2 Update lib/config.json (if this was used for previous configuration)

```json
{
  // REMOVE deprecated OIDC config:
  // "OIDC_URL": "https://auth.dev.example.com",
  // "OIDC_CLIENT_NAME": "mlspace-dev-client",
  
  // ADD new AUTH config:
  "AUTH_IDP_TYPE": "oidc",
  "AUTH_OIDC_URL": "https://auth.dev.example.com",
  "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
  "AUTH_SESSION_TTL_HOURS": 24
}
```




### Step 2: Update OIDC Provider Configuration

Update your OIDC provider's redirect URI configuration:

#### 2.1 Current Redirect URI
```
https://your-api-gateway.execute-api.region.amazonaws.com/Prod/
```

#### 2.2 New Redirect URI
```
https://your-api-gateway.execute-api.region.amazonaws.com/Prod/auth/callback
```

#### 2.3 Provider-Specific Instructions

**AWS Cognito:**
1. Go to AWS Cognito Console
2. Select your User Pool
3. Go to "App integration" → "App clients"
4. Edit your MLSpace app client
5. Update "Allowed callback URLs" to include `/auth/callback`

**Azure AD:**
1. Go to Azure Portal → Azure Active Directory
2. Select "App registrations" → Your MLSpace app
3. Go to "Authentication"
4. Update redirect URI to include `/auth/callback`

**Keycloak:**
1. Go to Keycloak Admin Console
2. Select your realm → Clients → Your MLSpace client
3. Update "Valid Redirect URIs" to include `/auth/callback`

### Step 3: Build and Deploy

#### 3.1 Build Frontend

Follow the [instructions](./install.md#production-web-app) for building the frontend.

#### 3.2 Deploy CDK Changes

Follow the [instructions](./install.md#deploying-the-cdk-application) for deploying the CDK application.



## Rollback Procedure

If issues occur during migration, follow this rollback procedure:

### Step 1: Revert Configuration Files

```bash
# Restore backup files
cp lib/constants.ts.backup lib/constants.ts
cp lib/config.json.backup lib/config.json
```

### Step 2: Revert OIDC Provider Configuration

Restore the original redirect URI in your OIDC provider:
```
https://your-api-gateway.execute-api.region.amazonaws.com/Prod/
```

### Step 3: Build and Deploy

#### 3.1 Build Frontend

Follow the [instructions](./install.md#production-web-app) for building the frontend.

#### 3.2 Deploy CDK Changes

Follow the [instructions](./install.md#deploying-the-cdk-application) for deploying the CDK application.

### Step 4: Verify Rollback

Test the deprecated authentication flow to ensure it's working correctly.