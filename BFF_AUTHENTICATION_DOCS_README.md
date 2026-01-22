# Enhanced Authentication Documentation

This document summarizes the deployment documentation created for the enhanced authentication feature.

## OIDC Client Secret Configuration

### Secrets Manager Integration
The OIDC client secret is now stored in AWS Secrets Manager instead of Systems Manager Parameter Store for enhanced security:

- **Secret Name**: `mlspace/auth/oidc-client-secret`
- **Configuration Parameter**: `AUTH_OIDC_CLIENT_SECRET_NAME` (default: `mlspace/auth/oidc-client-secret`)
- **Optional Deployment Configuration**: `AUTH_OIDC_CLIENT_SECRET_VALUE`

### Deployment-Time Configuration
You can set the OIDC client secret during deployment by adding it to your `lib/config.json`:

```json
{
  "AUTH_OIDC_CLIENT_SECRET_VALUE": "your-actual-client-secret-here"
}
```

If not provided during deployment, the secret will be created with a placeholder that you can update manually via AWS Console or CLI.

### Manual Configuration
If you need to update the client secret after deployment:

```bash
aws secretsmanager update-secret \
  --secret-id mlspace/auth/oidc-client-secret \
  --secret-string '{"client_secret":"your-new-secret","configured":true}'
```

## Complete AUTH_* Parameter List

All authentication configuration now uses `AUTH_*` parameters. **Legacy `OIDC_*` parameters are deprecated and not supported.**

### Required Parameters
- **AUTH_IDP_TYPE**: Identity Provider type (currently only `"oidc"` is supported)
- **AUTH_OIDC_URL**: OIDC issuer URL (replaces `OIDC_URL`)
- **AUTH_OIDC_CLIENT_ID**: OIDC client identifier (replaces `OIDC_CLIENT_NAME`)

### Optional Parameters
- **AUTH_OIDC_CLIENT_SECRET_NAME**: Secrets Manager secret name for OIDC client secret (default: `mlspace/auth/oidc-client-secret`)
- **AUTH_OIDC_CLIENT_SECRET_VALUE**: Optional OIDC client secret value for deployment-time configuration
- **AUTH_OIDC_USE_PKCE**: Whether to use PKCE flow (default: `true`)
- **AUTH_OIDC_VERIFY_SSL**: Whether to verify SSL certificates for OIDC requests (default: `true`)
- **AUTH_OIDC_VERIFY_SIGNATURE**: Whether to verify OIDC token signatures (default: `true`)
- **AUTH_SESSION_TTL_HOURS**: Session duration in hours (default: `24`)
- **AUTH_SYNC_DOMAINS**: Optional comma-separated list of additional domains for cookie sync
- **AUTH_SESSION_TABLE_NAME**: DynamoDB table name for authentication sessions (default: `mlspace-auth-sessions`)
- **AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME**: Secrets Manager secret name for token encryption keys (default: `mlspace/auth/token-encryption-keys`)
- **AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME**: Secrets Manager secret name for state encryption key (default: `mlspace/auth/state-encryption-key`)

## Created Documentation Files

### 1. Enhanced Authentication Configuration Guide
**File**: `frontend/docs/admin-guide/bff-authentication.md`
**Purpose**: Comprehensive configuration guide for enhanced authentication
**Contents**:
- Overview of enhanced authentication benefits
- Complete AUTH_* parameter reference
- Configuration setup instructions
- SSM parameter setup for client secrets
- Multi-domain cookie synchronization configuration
- Migration instructions from legacy OIDC
- Troubleshooting guide
- Security considerations
- Performance monitoring

### 2. Enhanced Authentication Migration Guide
**File**: `frontend/docs/admin-guide/bff-authentication-migration.md`
**Purpose**: Detailed step-by-step migration instructions
**Contents**:
- Pre-migration assessment and planning
- Step-by-step migration procedure
- Configuration file updates
- OIDC provider configuration changes
- Deployment and testing procedures
- Rollback procedures
- Troubleshooting common migration issues
- Post-migration optimization
- Migration checklist

### 3. AUTH_* Configuration Reference
**File**: `frontend/docs/admin-guide/auth-configuration-reference.md`
**Purpose**: Quick reference for all AUTH_* parameters
**Contents**:
- Complete parameter reference with types and examples
- Environment-specific configuration examples
- Configuration validation rules and scripts
- Legacy to new parameter mapping
- Troubleshooting configuration issues
- Security considerations for parameters

### 4. Updated Install Guide
**File**: `frontend/docs/admin-guide/install.md` (updated)
**Changes**:
- Added warning about enhanced authentication for new deployments
- Updated OIDC parameter descriptions to indicate legacy status
- Added references to enhanced authentication documentation
- Maintained backward compatibility information

### 5. Updated VitePress Navigation
**File**: `frontend/docs/.vitepress/config.mts` (updated)
**Changes**:
- Added "Enhanced Authentication Configuration" to System Administrator Guide
- Added "Enhanced Authentication Migration" to System Administrator Guide  
- Added "AUTH_* Configuration Reference" to Advanced Configuration

## Documentation Structure

```
frontend/docs/admin-guide/
├── install.md (updated)
├── bff-authentication.md (new)
├── bff-authentication-migration.md (new)
└── auth-configuration-reference.md (new)
```

## Key Features Documented

### Configuration Parameters
- **AUTH_IDP_TYPE**: Identity Provider type selection (currently only `"oidc"` is supported)
- **AUTH_OIDC_URL**: OIDC issuer URL (replaces deprecated `OIDC_URL`)
- **AUTH_OIDC_CLIENT_ID**: OIDC client identifier (replaces deprecated `OIDC_CLIENT_NAME`)
- **AUTH_OIDC_CLIENT_SECRET_NAME**: Secrets Manager secret name for OIDC client secret
- **AUTH_OIDC_CLIENT_SECRET_VALUE**: Optional deployment-time client secret configuration
- **AUTH_OIDC_USE_PKCE**: Whether to use PKCE flow (default: `true`)
- **AUTH_OIDC_VERIFY_SSL**: Whether to verify SSL certificates (default: `true`)
- **AUTH_OIDC_VERIFY_SIGNATURE**: Whether to verify OIDC token signatures (default: `true`)
- **AUTH_SESSION_TTL_HOURS**: Session duration configuration (default: `24`)
- **AUTH_SYNC_DOMAINS**: Multi-domain cookie synchronization
- **AUTH_SESSION_TABLE_NAME**: DynamoDB table name for sessions
- **AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME**: Versioned token encryption keys (rotatable)
- **AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME**: State encryption key

### Secrets Manager Setup
- Client secret storage in `mlspace/auth/oidc-client-secret`
- Token encryption keys in `mlspace/auth/token-encryption-keys` (versioned for rotation)
- State encryption key in `mlspace/auth/state-encryption-key`
- IAM permissions for Lambda access
- Security best practices

### Deprecated Parameters
**All legacy `OIDC_*` parameters are deprecated and not supported:**
- `OIDC_URL` → Use `AUTH_OIDC_URL`
- `OIDC_CLIENT_NAME` → Use `AUTH_OIDC_CLIENT_ID`
- `OIDC_REDIRECT_URL` → No longer needed (automatic `/auth/callback`)
- `OIDC_VERIFY_SSL` → Use `AUTH_OIDC_VERIFY_SSL`
- `OIDC_VERIFY_SIGNATURE` → Use `AUTH_OIDC_VERIFY_SIGNATURE`
- `IDP_ENDPOINT_SSM_PARAM` → No longer needed
- `INTERNAL_OIDC_URL` → No longer needed with server-side authentication

### Multi-Domain Cookie Synchronization
- OTAC (One-Time Authentication Code) flow
- Cross-domain security considerations
- Configuration examples
- Troubleshooting sync issues

### Migration Process
- Pre-migration assessment
- Configuration file updates
- OIDC provider reconfiguration
- Deployment procedures
- Testing and validation
- Rollback procedures

### Security Considerations
- HttpOnly and Secure cookie flags
- Token encryption in DynamoDB
- Cross-domain security
- Monitoring and alerting

## Usage Instructions

### For New Deployments
1. Follow the [Enhanced Authentication Configuration Guide](frontend/docs/admin-guide/bff-authentication.md)
2. Use the [AUTH_* Configuration Reference](frontend/docs/admin-guide/auth-configuration-reference.md) for parameter details

### For Existing Deployments
1. Review the [Enhanced Authentication Migration Guide](frontend/docs/admin-guide/bff-authentication-migration.md)
2. Follow the step-by-step migration process
3. Use the troubleshooting sections for common issues

### For Quick Reference
- Use the [AUTH_* Configuration Reference](frontend/docs/admin-guide/auth-configuration-reference.md) for parameter lookup
- Check the migration guide for legacy parameter mapping

## Integration with Existing Documentation

The new documentation integrates seamlessly with existing MLSpace documentation:
- References existing security documentation
- Links to install guide for prerequisites
- Maintains consistency with existing documentation style
- Uses VitePress features like tabs and warnings

## Validation and Testing

All documentation includes:
- Configuration validation scripts
- Testing procedures
- Troubleshooting guides
- Performance monitoring instructions
- Security validation steps

## Maintenance

The documentation should be updated when:
- New AUTH_* parameters are added
- SAML support is implemented
- Additional IdP types are supported
- Security requirements change
- Performance optimization recommendations change

## Requirements Satisfied

This documentation satisfies all requirements from task 19:

✅ **Document new AUTH_* configuration parameters**
- Complete parameter reference with types, defaults, and examples
- Environment-specific configuration examples
- Validation rules and scripts

✅ **Document migration steps from legacy OIDC configuration**
- Detailed step-by-step migration guide
- Pre-migration assessment procedures
- Configuration file update instructions
- Rollback procedures

✅ **Document SSM parameter setup for client secret**
- Complete SSM parameter creation instructions
- IAM permission requirements
- Security best practices
- Troubleshooting SSM access issues

✅ **Document how to configure multi-domain cookie synchronization**
- OTAC flow explanation
- Configuration examples
- Security considerations
- Troubleshooting sync issues

The documentation is comprehensive, well-structured, and provides both high-level guidance and detailed technical instructions for all aspects of enhanced authentication configuration and deployment.