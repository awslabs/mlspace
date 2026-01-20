# BFF Authentication Documentation

This document summarizes the deployment documentation created for the BFF authentication feature.

## OIDC Client Secret Configuration

### Secrets Manager Integration
The OIDC client secret is now stored in AWS Secrets Manager instead of Systems Manager Parameter Store for enhanced security:

- **Secret Name**: `mlspace/auth/oidc-client-secret`
- **Configuration Parameter**: `AUTH_OIDC_CLIENT_SECRET_NAME` (replaces `AUTH_OIDC_CLIENT_SECRET_SSM_PARAM`)
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

## Key Rotation Integration
The OIDC client secret is managed alongside other authentication secrets in the `AuthSecretsConstruct` with proper encryption and access controls.

## Created Documentation Files

### 1. BFF Authentication Configuration Guide
**File**: `frontend/docs/admin-guide/bff-authentication.md`
**Purpose**: Comprehensive configuration guide for BFF authentication
**Contents**:
- Overview of BFF authentication benefits
- Complete AUTH_* parameter reference
- Configuration setup instructions
- SSM parameter setup for client secrets
- Multi-domain cookie synchronization configuration
- Migration instructions from legacy OIDC
- Troubleshooting guide
- Security considerations
- Performance monitoring

### 2. BFF Authentication Migration Guide
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
- Added warning about BFF authentication for new deployments
- Updated OIDC parameter descriptions to indicate legacy status
- Added references to BFF authentication documentation
- Maintained backward compatibility information

### 5. Updated VitePress Navigation
**File**: `frontend/docs/.vitepress/config.mts` (updated)
**Changes**:
- Added "BFF Authentication Configuration" to System Administrator Guide
- Added "BFF Authentication Migration" to System Administrator Guide  
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
- **AUTH_IDP_TYPE**: Identity Provider type selection
- **AUTH_OIDC_URL**: OIDC issuer URL (replaces OIDC_URL)
- **AUTH_OIDC_CLIENT_ID**: OIDC client identifier (replaces OIDC_CLIENT_NAME)
- **AUTH_SESSION_TTL_HOURS**: Session duration configuration
- **AUTH_PRIMARY_DOMAIN**: Custom domain configuration
- **AUTH_SYNC_DOMAINS**: Multi-domain cookie synchronization

### SSM Parameter Setup
- Client secret storage in `/mlspace/auth/oidc-client-secret`
- Encryption key management
- IAM permissions for Lambda access
- Security best practices

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
1. Follow the [BFF Authentication Configuration Guide](frontend/docs/admin-guide/bff-authentication.md)
2. Use the [AUTH_* Configuration Reference](frontend/docs/admin-guide/auth-configuration-reference.md) for parameter details

### For Existing Deployments
1. Review the [BFF Authentication Migration Guide](frontend/docs/admin-guide/bff-authentication-migration.md)
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

The documentation is comprehensive, well-structured, and provides both high-level guidance and detailed technical instructions for all aspects of BFF authentication configuration and deployment.