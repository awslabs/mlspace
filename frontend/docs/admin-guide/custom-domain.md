---
outline: deep
---

# Custom Domain Configuration

This guide explains how to configure {{ $params.APPLICATION_NAME }} to use a custom domain name instead of the default API Gateway URL.

## Overview

By default, {{ $params.APPLICATION_NAME }} uses the auto-generated API Gateway URL (e.g., `https://abc123xyz.execute-api.us-east-1.amazonaws.com/Prod/`). You can configure a custom domain to provide a more user-friendly URL like `https://mlspace.mycompany.com`.

## Prerequisites

Before configuring a custom domain, ensure you have:

- A registered domain name
- A valid SSL/TLS certificate for your domain
  - AWS Certificate Manager (ACM) is commonly used, but any valid certificate method supported by API Gateway will work
  - For CloudFront distributions or edge-optimized API Gateway endpoints, the certificate must be in us-east-1
  - For regional API Gateway endpoints, the certificate must be in the same region as your API
- Appropriate DNS access to create CNAME or A records
- Admin access to your AWS account

## Configuration Steps

### Step 1: Update CDK Configuration

1. Open `lib/config.json` in your {{ $params.APPLICATION_NAME }} deployment directory.

2. Set the `WEB_CUSTOM_DOMAIN_NAME` constant to your custom domain URL:

```typescript
// An optional custom domain name to use in place of the default API Gateway URL
// eg: 'https://mlspace.mycompany.com'
  "WEB_CUSTOM_DOMAIN_NAME": 'https://mlspace.mycompany.com'
```

::: warning
Include the full URL with `https://` protocol. Do not include a trailing slash or path segments.
:::

### Step 2: Configure Frontend Homepage (Optional)

If you're **not** using a stage name in your custom domain path (e.g., using `https://mlspace.mycompany.com` instead of `https://mlspace.mycompany.com/Prod`), update the frontend package.json:

1. Open `frontend/package.json`

2. Update the `homepage` attribute:

```json
{
  "name": "@amzn/mlspace",
  "homepage": "/",
  "version": "1.6.11",
  ...
}
```

If you're keeping the stage name in your path (e.g., `https://mlspace.mycompany.com/Prod`), set:

```json
{
  "homepage": "/Prod/",
  ...
}
```

::: tip
The `homepage` value should match the base path where your application will be served. This affects how static assets are referenced.
:::

### Step 3: Configure Documentation Base Path (Optional)

If you're changing the base path for your application, you should also update the documentation site configuration:

1. Open `frontend/docs/.vitepress/config.mts`

2. Update the `base` parameter (around line 65):

```typescript
export default defineConfig({
    title: `${APPLICATION_NAME} Documentation`,
    description: 'A collaborative data science environment',
    outDir: '../public/docs',
    base: process.env.DOCS_BASE_PATH || '/docs/',  // Update this line
    themeConfig: {
        // ...
    }
})
```

**Examples**:
- For root path: `base: '/docs/'` (default)
- For stage path: `base: '/Prod/docs/'`
- Using environment variable: `base: process.env.DOCS_BASE_PATH || '/docs/'`

::: tip
The `base` value determines where the documentation site assets are served from. It should match your application's base path plus `/docs/`.
:::

### Step 4: Build Frontend and Deploy CDK Changes

After making configuration changes, you need to rebuild the frontend application before deploying:

1. Navigate to the frontend directory and build the application:

```bash
cd frontend
npm run build
cd ..
```

This will generate a production-optimized build of the web application with your updated configuration.

2. Deploy your updated {{ $params.APPLICATION_NAME }} stack:

```bash
cdk deploy --all
```

This will update the application configuration to use your custom domain for:
- Authentication redirects
- API endpoint references in the frontend
- Session management

### Step 5: Create API Gateway Custom Domain

After deploying the CDK changes, you must manually configure the API Gateway custom domain and API mapping.

#### Using AWS Console

1. Navigate to **API Gateway** in the AWS Console
2. Select **Custom domain names** from the left navigation
3. Click **Create**
4. Configure the custom domain:
   - **Domain name**: Enter your domain (e.g., `mlspace.mycompany.com`)
   - **Endpoint type**: Choose **Regional** (recommended) or **Edge optimized**
   - **Certificate**: Select your SSL/TLS certificate from the dropdown (e.g., from ACM or imported certificate)
   - **Security policy**: Choose **TLS 1.2** (recommended)
5. Click **Create domain name**
6. Note the **API Gateway domain name** (e.g., `d-abc123xyz.execute-api.us-east-1.amazonaws.com`) - you'll need this for DNS configuration

#### Create API Mapping

1. After creating the custom domain, select it from the list
2. Navigate to the **API mappings** tab
3. Click **Configure API mappings**
4. Click **Add new mapping**
5. Configure the mapping:
   - **API**: Select your {{ $params.APPLICATION_NAME }} API (typically named with your stack name)
   - **Stage**: Select your deployment stage (e.g., `Prod`)
   - **Path**: Leave empty if not using a stage path, or enter `Prod` if keeping the stage in the URL
6. Click **Save**

#### Using AWS CLI

The following example uses an ACM certificate, but you can use any valid certificate method supported by API Gateway:

```bash
# Create custom domain (example using ACM certificate)
aws apigateway create-domain-name \
  --domain-name mlspace.mycompany.com \
  --regional-certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/abc-123 \
  --endpoint-configuration types=REGIONAL \
  --security-policy TLS_1_2

# Create base path mapping
aws apigateway create-base-path-mapping \
  --domain-name mlspace.mycompany.com \
  --rest-api-id abc123xyz \
  --stage Prod \
  --base-path ''  # Leave empty for root path, or use 'Prod' for /Prod path
```

### Step 6: Configure DNS

Create a DNS record pointing your custom domain to the API Gateway domain name:

#### For Regional Endpoints

Create a **CNAME** record:

```
Type: CNAME
Name: mlspace.mycompany.com
Value: d-abc123xyz.execute-api.us-east-1.amazonaws.com
TTL: 300
```

#### For Edge-Optimized Endpoints (with CloudFront)

Create an **A** record with an alias to the CloudFront distribution:

```
Type: A (Alias)
Name: mlspace.mycompany.com
Value: d-abc123xyz.cloudfront.net
TTL: 300
```

#### Using Route 53

If using Route 53, you can create an A record with an alias:

1. Navigate to **Route 53** in the AWS Console
2. Select your hosted zone
3. Click **Create record**
4. Configure:
   - **Record name**: `mlspace` (or leave empty for apex domain)
   - **Record type**: A
   - **Alias**: Yes
   - **Route traffic to**: Alias to API Gateway API
   - **Region**: Select your API region
   - **API Gateway endpoint**: Select your custom domain
5. Click **Create records**

### Step 7: Verify Configuration

1. Wait for DNS propagation (typically 5-15 minutes, but can take up to 48 hours)

2. Test DNS resolution:
```bash
nslookup mlspace.mycompany.com
# or
dig mlspace.mycompany.com
```

3. Access your custom domain in a browser:
```
https://mlspace.mycompany.com
```

4. Verify that:
   - The application loads correctly
   - Authentication redirects work properly
   - API calls are successful
   - No mixed content warnings appear in the browser console

## Troubleshooting

### Certificate Validation Errors

**Problem**: API Gateway cannot validate your certificate.

**Solution**:
- Ensure the certificate is in the correct region (us-east-1 for edge-optimized, same region as API for regional)
- Verify the certificate status is valid and issued
- Check that the certificate covers your domain (wildcard certificates like `*.mycompany.com` work for subdomains)
- If using ACM, ensure the certificate status shows as "Issued"
- If using an imported certificate, verify it's properly formatted and includes the full certificate chain

### DNS Not Resolving

**Problem**: Custom domain doesn't resolve to API Gateway.

**Solution**:
- Verify the CNAME/A record is correctly configured
- Check DNS propagation status using online tools
- Ensure there are no conflicting DNS records
- Wait longer for DNS propagation (can take up to 48 hours)

### Authentication Redirect Errors

**Problem**: After login, users are redirected to the wrong URL.

**Solution**:
- Verify `WEB_CUSTOM_DOMAIN_NAME` is set correctly in `lib/constants.ts`
- Ensure the value includes `https://` and has no trailing slash
- Redeploy the CDK stack after making changes
- Update your identity provider's allowed redirect URIs to include the custom domain

### Mixed Content Warnings

**Problem**: Browser shows mixed content warnings or blocks resources.

**Solution**:
- Ensure your custom domain uses HTTPS
- Verify the SSL/TLS certificate is valid and trusted
- Check that all API calls use HTTPS
- Update any hardcoded HTTP URLs in your configuration

### API Mapping Not Working

**Problem**: Requests to custom domain return 403 or 404 errors.

**Solution**:
- Verify the API mapping is correctly configured in API Gateway
- Check that the stage name matches your deployment
- Ensure the base path matches your `homepage` setting in package.json
- Verify the API Gateway has been deployed to the stage

## Path Configuration Examples

### Example 1: Root Path (No Stage)

**Configuration**:
- `WEB_CUSTOM_DOMAIN_NAME`: `https://mlspace.mycompany.com`
- `frontend/package.json` homepage: `/`
- API Gateway base path: `` (empty)

**Result**: Application accessible at `https://mlspace.mycompany.com/`

### Example 2: With Stage Path

**Configuration**:
- `WEB_CUSTOM_DOMAIN_NAME`: `https://mlspace.mycompany.com`
- `frontend/package.json` homepage: `/Prod/`
- API Gateway base path: `Prod`

**Result**: Application accessible at `https://mlspace.mycompany.com/Prod/`

### Example 3: Subdomain with Root Path

**Configuration**:
- `WEB_CUSTOM_DOMAIN_NAME`: `https://ml.mycompany.com`
- `frontend/package.json` homepage: `/`
- API Gateway base path: `` (empty)

**Result**: Application accessible at `https://ml.mycompany.com/`

## Security Considerations

- Always use HTTPS for custom domains
- Use TLS 1.2 or higher for API Gateway security policy
- Regularly rotate SSL/TLS certificates before expiration
- Update your identity provider configuration to only allow redirects to your custom domain
- Enable API Gateway access logging to monitor traffic to your custom domain

## Additional Resources

- [AWS API Gateway Custom Domain Names](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)
- [AWS Certificate Manager User Guide](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html)
- [Route 53 Developer Guide](https://docs.aws.amazon.com/route53/index.html)
- [{{ $params.APPLICATION_NAME }} Authentication Configuration](./bff-authentication.md)
