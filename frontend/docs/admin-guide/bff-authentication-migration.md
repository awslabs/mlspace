---
outline: deep
---

# Enhanced Authentication Migration Guide

## Overview

This guide provides detailed step-by-step instructions for migrating from the deprecated OIDC authentication system to the enhanced authentication system. The new system provides improved security, better enterprise IdP support, and simplified application code.

## Migration Benefits

- **Enhanced Security**: Session-based authentication with HttpOnly cookies prevents token exposure in browser
- **Enterprise IdP Support**: Support for OIDC with client secrets and SAML protocol
- **Simplified Application**: No token management in browser JavaScript
- **Cross-Domain Support**: Seamless authentication across multiple domains
- **Automatic Token Refresh**: Server-side token management and automatic refresh

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
   - Multi-domain setup requirements

### Compatibility Check

Verify your OIDC provider supports the enhanced authentication requirements:

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
cp lib/utils/configTypes.ts lib/utils/configTypes.ts.backup

# Backup current deployment
git tag pre-bff-migration
git push origin pre-bff-migration
```

## Step-by-Step Migration

### Step 1: Update Configuration Files

#### 1.1 Update lib/constants.ts

```typescript
// REMOVE these deprecated constants:
export const OIDC_URL = 'https://auth.example.com';
export const OIDC_CLIENT_NAME = 'mlspace-client';
export const OIDC_REDIRECT_URL = undefined;
export const OIDC_VERIFY_SSL = true;
export const OIDC_VERIFY_SIGNATURE = true;

// ADD these new AUTH constants:
export const AUTH_IDP_TYPE = 'oidc';
export const AUTH_OIDC_URL = 'https://auth.example.com';
export const AUTH_OIDC_CLIENT_ID = 'mlspace-client';
export const AUTH_SESSION_TTL_HOURS = 24;
export const AUTH_SYNC_DOMAINS = '';
```

#### 1.2 Update lib/config.json

```json
{
  "dev": {
    // REMOVE deprecated OIDC config:
    // "OIDC_URL": "https://auth.dev.example.com",
    // "OIDC_CLIENT_NAME": "mlspace-dev-client",
    
    // ADD new AUTH config:
    "AUTH_IDP_TYPE": "oidc",
    "AUTH_OIDC_URL": "https://auth.dev.example.com",
    "AUTH_OIDC_CLIENT_ID": "mlspace-dev-client",
    "AUTH_SESSION_TTL_HOURS": 8
  },
  "prod": {
    // REMOVE deprecated OIDC config:
    // "OIDC_URL": "https://auth.example.com",
    // "OIDC_CLIENT_NAME": "mlspace-prod-client",
    
    // ADD new AUTH config:
    "AUTH_IDP_TYPE": "oidc",
    "AUTH_OIDC_URL": "https://auth.example.com",
    "AUTH_OIDC_CLIENT_ID": "mlspace-prod-client",
    "AUTH_SESSION_TTL_HOURS": 24,
    "AUTH_SYNC_DOMAINS": "notebooks.mlspace.com"
  }
}
```

#### 1.3 Update lib/utils/configTypes.ts

```typescript
export interface MLSpaceConfig {
  // ... existing properties ...
  
  // REMOVE deprecated OIDC properties:
  // OIDC_URL?: string;
  // OIDC_CLIENT_NAME?: string;
  // OIDC_REDIRECT_URL?: string;
  // OIDC_VERIFY_SSL?: boolean;
  // OIDC_VERIFY_SIGNATURE?: boolean;
  
  // ADD new AUTH properties:
  AUTH_IDP_TYPE: string;
  AUTH_OIDC_URL?: string;
  AUTH_OIDC_CLIENT_ID?: string;
  AUTH_SESSION_TTL_HOURS: number;
  AUTH_SYNC_DOMAINS?: string;
}
```

### Step 2: Configure Client Secret (If Required)

If your OIDC provider requires a client secret:

#### 2.1 Store Client Secret in SSM

```bash
# For development environment
aws ssm put-parameter \
  --name "mlspace/auth/oidc-client-secret" \
  --value "your-dev-client-secret" \
  --type "SecureString" \
  --description "OIDC client secret for MLSpace development"

# For production environment
aws ssm put-parameter \
  --name "mlspace/auth/oidc-client-secret" \
  --value "your-prod-client-secret" \
  --type "SecureString" \
  --description "OIDC client secret for MLSpace production"
```

#### 2.2 Verify SSM Parameter

```bash
# Verify parameter exists
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Values=mlspace/auth/oidc-client-secret"

# Test parameter access (will show encrypted value)
aws ssm get-parameter \
  --name "mlspace/auth/oidc-client-secret" \
  --with-decryption
```

### Step 3: Update OIDC Provider Configuration

Update your OIDC provider's redirect URI configuration:

#### 3.1 Current Redirect URI
```
https://your-api-gateway.execute-api.region.amazonaws.com/Prod/
```

#### 3.2 New Redirect URI
```
https://your-api-gateway.execute-api.region.amazonaws.com/Prod/auth/callback
```

#### 3.3 Provider-Specific Instructions

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

### Step 4: Build and Deploy

#### 4.1 Build Frontend

```bash
cd frontend/
npm run clean
npm install
npm run build
```

#### 4.2 Deploy CDK Changes

```bash
cd ../
npm install
cdk deploy --all --require-approval never
```

#### 4.3 Monitor Deployment

```bash
# Monitor CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name MLSpaceStack \
  --query 'Stacks[0].StackStatus'

# Check Lambda function updates
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `mls-lambda-auth`)].FunctionName'
```

### Step 5: Verification and Testing

#### 5.1 Basic Authentication Test

1. **Clear Browser Data:**
   - Clear cookies for your MLSpace domain
   - Clear localStorage and sessionStorage

2. **Test Authentication Flow:**
   ```bash
   # Visit your MLSpace application
   curl -I https://your-mlspace-domain.com/
   
   # Should redirect to /auth/login
   # Follow redirect chain to OIDC provider
   # Complete authentication
   # Verify redirect back to /auth/callback
   # Verify final redirect to application
   ```

3. **Verify Session Cookies:**
   - Open browser developer tools
   - Check Application → Cookies
   - Verify `mlspace_session` cookie exists
   - Verify cookie has `HttpOnly` and `Secure` flags

#### 5.2 API Authentication Test

```bash
# Test API call with session cookie
curl -b "mlspace_session=your-session-id" \
  https://your-api-gateway.execute-api.region.amazonaws.com/Prod/user/current

# Should return user information without Authorization header
```

#### 5.3 Cross-Domain Test (If Configured)

If you configured `AUTH_SYNC_DOMAINS`:

1. Authenticate on primary domain
2. Visit each sync domain
3. Verify automatic authentication without re-login
4. Check that each domain has its own session cookie

#### 5.4 Token Refresh Test

```bash
# Wait for token refresh threshold (default: 5 minutes before expiry)
# Make API call to trigger refresh
curl -b "mlspace_session=your-session-id" \
  https://your-api-gateway.execute-api.region.amazonaws.com/Prod/auth/identity

# Verify response includes "refreshed": true
```

### Step 6: Post-Migration Cleanup

#### 6.1 Remove Deprecated Code References

Search for and remove any remaining deprecated OIDC references:

```bash
# Search for deprecated OIDC usage
grep -r "OIDC_URL\|OIDC_CLIENT_NAME" --exclude-dir=node_modules .
grep -r "oidc.user:" frontend/src/
grep -r "sessionStorage.*oidc" frontend/src/
```

#### 6.2 Update Documentation

Update any internal documentation that references:
- Deprecated OIDC configuration
- Frontend token management
- Authentication troubleshooting procedures

#### 6.3 Monitor CloudWatch Logs

Monitor authentication-related log groups:

```bash
# Check authentication logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/mls-lambda-auth-login" \
  --start-time $(date -d "1 hour ago" +%s)000

aws logs filter-log-events \
  --log-group-name "/aws/lambda/mls-lambda-auth-callback" \
  --start-time $(date -d "1 hour ago" +%s)000
```

## Rollback Procedure

If issues occur during migration, follow this rollback procedure:

### Step 1: Revert Configuration Files

```bash
# Restore backup files
cp lib/constants.ts.backup lib/constants.ts
cp lib/config.json.backup lib/config.json
cp lib/utils/configTypes.ts.backup lib/utils/configTypes.ts
```

### Step 2: Revert OIDC Provider Configuration

Restore the original redirect URI in your OIDC provider:
```
https://your-api-gateway.execute-api.region.amazonaws.com/Prod/
```

### Step 3: Rebuild and Redeploy

```bash
# Rebuild frontend with deprecated configuration
cd frontend/
npm run clean && npm run build

# Redeploy CDK
cd ../
cdk deploy --all --require-approval never
```

### Step 4: Verify Rollback

Test the deprecated authentication flow to ensure it's working correctly.

## Troubleshooting Common Issues

### Issue: Authentication Redirect Loop

**Symptoms:** User gets stuck redirecting between IdP and MLSpace

**Diagnosis:**
```bash
# Check redirect URI configuration
curl -I https://your-mlspace-domain.com/auth/login
# Should redirect to OIDC provider with correct callback URI
```

**Solution:**
1. Verify OIDC provider redirect URI includes `/auth/callback`
2. Check `AUTH_OIDC_CLIENT_ID` matches IdP configuration
3. Verify IdP is accessible from Lambda functions

### Issue: Session Cookies Not Set

**Symptoms:** Authentication succeeds but API calls return 401

**Diagnosis:**
```bash
# Check session creation in logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/mls-lambda-auth-callback" \
  --filter-pattern "Session created"
```

**Solution:**
1. Check cookie domain settings in browser
2. Ensure HTTPS is used (cookies won't set over HTTP)

### Issue: Client Secret Authentication Fails

**Symptoms:** "invalid_client" error during token exchange

**Diagnosis:**
```bash
# Check SSM parameter access
aws ssm get-parameter \
  --name "mlspace/auth/oidc-client-secret" \
  --with-decryption

# Check Lambda execution role permissions
aws iam simulate-principal-policy \
  --policy-source-arn "arn:aws:iam::ACCOUNT:role/MLSpaceAppRole" \
  --action-names "ssm:GetParameter" \
  --resource-arns "arn:aws:ssm:REGION:ACCOUNT:parameter/mlspace/auth/oidc-client-secret"
```

**Solution:**
1. Verify SSM parameter exists and has correct value
2. Check Lambda execution role has SSM read permissions
3. Verify KMS key permissions if using custom encryption

### Issue: Cross-Domain Sync Failures

**Symptoms:** Authentication works on primary domain but fails on sync domains

**Diagnosis:**
```bash
# Check OTAC generation and validation
aws logs filter-log-events \
  --log-group-name "/aws/lambda/mls-lambda-auth-sync" \
  --filter-pattern "OTAC"
```

**Solution:**
1. Verify `AUTH_SYNC_DOMAINS` configuration
2. Check DNS resolution for all sync domains
3. Ensure all domains point to the same API Gateway
4. Verify OTAC TTL and usage patterns

## Performance Optimization

### Session Table Scaling

Monitor DynamoDB session table performance:

```bash
# Check table metrics
aws cloudwatch get-metric-statistics \
  --namespace "AWS/DynamoDB" \
  --metric-name "ConsumedReadCapacityUnits" \
  --dimensions Name=TableName,Value=mlspace-auth-sessions \
  --start-time $(date -d "1 hour ago" --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Sum
```

### Lambda Cold Start Optimization

Monitor authentication endpoint performance:

```bash
# Check Lambda duration metrics
aws cloudwatch get-metric-statistics \
  --namespace "AWS/Lambda" \
  --metric-name "Duration" \
  --dimensions Name=FunctionName,Value=mls-lambda-auth-login \
  --start-time $(date -d "1 hour ago" --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average,Maximum
```

## Security Validation

### Session Security Audit

Verify session security configuration:

```bash
# Check session cookie attributes
curl -I https://your-mlspace-domain.com/auth/callback
# Look for: HttpOnly; Secure; SameSite=Strict

# Verify session encryption
aws dynamodb scan \
  --table-name mlspace-auth-sessions \
  --limit 1 \
  --query 'Items[0].data.session.accessToken.S'
# Should show encrypted token, not plain text
```

### Token Storage Audit

Verify tokens are not exposed in browser:

1. Open browser developer tools
2. Check Application → Local Storage (should be empty of tokens)
3. Check Application → Session Storage (should be empty of tokens)
4. Check Network → Response bodies (should not contain tokens)

## Monitoring and Alerting

Set up CloudWatch alarms for authentication health:

```bash
# Authentication failure rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "MLSpace-Auth-Failure-Rate" \
  --alarm-description "High authentication failure rate" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --threshold 10 \
  --comparison-operator "GreaterThanThreshold" \
  --dimensions Name=FunctionName,Value=mls-lambda-auth-callback

# Session creation rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "MLSpace-Session-Creation-Rate" \
  --alarm-description "Unusual session creation pattern" \
  --metric-name "Invocations" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --threshold 100 \
  --comparison-operator "GreaterThanThreshold" \
  --dimensions Name=FunctionName,Value=mls-lambda-auth-callback
```

## Migration Checklist

Use this checklist to track migration progress:

### Pre-Migration
- [ ] Document current OIDC configuration
- [ ] Verify OIDC provider compatibility
- [ ] Create configuration backups
- [ ] Plan maintenance window
- [ ] Notify users of upcoming changes

### Configuration Updates
- [ ] Update `lib/constants.ts`
- [ ] Update `lib/config.json`
- [ ] Update `lib/utils/configTypes.ts`
- [ ] Store client secret in SSM (if required)
- [ ] Update OIDC provider redirect URI

### Deployment
- [ ] Build frontend with new configuration
- [ ] Deploy CDK changes
- [ ] Monitor deployment progress
- [ ] Verify Lambda function updates

### Testing
- [ ] Test basic authentication flow
- [ ] Verify session cookie creation
- [ ] Test API authentication
- [ ] Test cross-domain sync (if configured)
- [ ] Test token refresh functionality
- [ ] Test logout functionality

### Post-Migration
- [ ] Remove deprecated code references
- [ ] Update internal documentation
- [ ] Monitor CloudWatch logs
- [ ] Set up performance monitoring
- [ ] Configure security alerts
- [ ] Validate security configuration

### Rollback (If Needed)
- [ ] Revert configuration files
- [ ] Revert OIDC provider settings
- [ ] Rebuild and redeploy
- [ ] Verify deprecated functionality

## Support and Next Steps

After successful migration:

1. **Monitor Performance**: Watch authentication metrics for the first week
2. **User Training**: Update user documentation if authentication flow changes
3. **Security Review**: Conduct security audit of new authentication system
4. **Optimization**: Tune session TTL and refresh thresholds based on usage patterns
5. **Future Enhancements**: Consider SAML integration or additional IdP support

For additional support, refer to:
- [Enhanced Authentication Configuration Guide](./bff-authentication.md)
- [MLSpace Security Documentation](./security/intro.md)
- CloudWatch logs for detailed troubleshooting