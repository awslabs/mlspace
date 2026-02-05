---
outline: deep
---

# Custom CDK Synthesizer Configuration

This guide explains how to configure custom CDK synthesizers for {{ $params.APPLICATION_NAME }} deployments, with a focus on using custom IAM roles and choosing the right synthesizer for your environment.

## Overview

The CDK synthesizer controls how CloudFormation templates are generated and how assets (Lambda code, Docker images, etc.) are published to AWS. By default, {{ $params.APPLICATION_NAME }} uses the standard CDK bootstrap configuration, but you can customize this behavior through the `synthesizer` section in `cdk.json`.

Custom synthesizers are particularly useful when:
- Your organization requires specific IAM roles for deployments
- You need to use custom S3 buckets or ECR repositories
- You're deploying in environments with strict security policies
- You need to integrate with existing CI/CD pipelines
- You're working in air-gapped or restricted environments

## Configuration Location

All synthesizer configuration is managed in the `cdk.json` file at the root of the {{ $params.APPLICATION_NAME }} repository:

```json
{
  "synthesizer": {
    "type": "default"
  }
}
```

## Choosing a Synthesizer Type

### DefaultStackSynthesizer (Recommended)

The default synthesizer works with CDK bootstrap and provides the most flexibility.

**Use when:**
- You can run `cdk bootstrap` in your target account
- You need fine-grained control over IAM roles
- You want to use custom asset buckets or repositories
- You're deploying in a standard AWS environment

**Basic configuration:**
```json
{
  "synthesizer": {
    "type": "default"
  }
}
```

### CliCredentialsStackSynthesizer

Uses your CLI credentials directly without requiring CDK bootstrap.

**Use when:**
- You cannot or don't want to run `cdk bootstrap`
- You're doing quick prototypes or demos
- You have full admin access via CLI credentials
- You want to manage asset buckets manually

**Configuration:**
```json
{
  "synthesizer": {
    "type": "cli",
    "fileAssetsBucketName": "my-deployment-bucket-${AWS::AccountId}"
  }
}
```

**Note:** You must manually create the S3 bucket and ECR repository before deployment.

### LegacyStackSynthesizer

Backward compatibility with older CDK versions (pre-bootstrap).

**Use when:**
- Migrating from very old CDK versions
- You have existing deployments using the legacy synthesizer

**Configuration:**
```json
{
  "synthesizer": {
    "type": "legacy"
  }
}
```

**Warning:** Limited support for large assets. Not recommended for new deployments.

## Using Custom IAM Roles

### Why Use Custom Roles?

Organizations often require:
- Specific naming conventions for IAM roles
- Custom permission boundaries
- Integration with existing deployment roles
- Compliance with security policies that restrict role creation
- Separation of duties between deployment operations

### Configuring Custom Roles

The `DefaultStackSynthesizer` supports specifying custom IAM roles for different deployment operations:

```json
{
  "synthesizer": {
    "type": "default",
    "cloudFormationExecutionRole": "arn:aws:iam::123456789012:role/MLSpaceCFNExecutionRole",
    "deployRoleArn": "arn:aws:iam::123456789012:role/MLSpaceDeployRole",
    "fileAssetPublishingRoleArn": "arn:aws:iam::123456789012:role/MLSpaceFilePublishRole",
    "imageAssetPublishingRoleArn": "arn:aws:iam::123456789012:role/MLSpaceImagePublishRole",
    "lookupRoleArn": "arn:aws:iam::123456789012:role/MLSpaceLookupRole"
  }
}
```

### Role Descriptions

#### CloudFormation Execution Role
**Parameter:** `cloudFormationExecutionRole`

This role is assumed by CloudFormation to create, update, and delete stack resources.

**Required Permissions:**
- Full permissions to create/modify/delete all {{ $params.APPLICATION_NAME }} resources (VPC, Lambda, API Gateway, DynamoDB, S3, IAM, KMS, etc.)
- Trust relationship allowing CloudFormation service to assume the role

**Example Trust Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudformation.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

#### Deploy Role
**Parameter:** `deployRoleArn`

This role is assumed by the CDK CLI to initiate deployments and manage CloudFormation stacks.

**Required Permissions:**
- CloudFormation stack operations (CreateStack, UpdateStack, DeleteStack, DescribeStacks, etc.)
- S3 access to read CloudFormation templates
- Permission to pass the CloudFormation execution role
- SSM parameter access for bootstrap version checking

**Example Policy Statements:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:GetTemplate"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::123456789012:role/MLSpaceCFNExecutionRole"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-*-assets-123456789012-us-east-1",
        "arn:aws:s3:::cdk-*-assets-123456789012-us-east-1/*"
      ]
    }
  ]
}
```

#### File Asset Publishing Role
**Parameter:** `fileAssetPublishingRoleArn`

This role is used to upload file assets (Lambda code, configuration files) to S3.

**Required Permissions:**
- S3 PutObject and GetObject on the asset bucket
- KMS encrypt/decrypt if using encrypted buckets

**Example Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-*-assets-123456789012-us-east-1",
        "arn:aws:s3:::cdk-*-assets-123456789012-us-east-1/*"
      ]
    }
  ]
}
```

#### Image Asset Publishing Role
**Parameter:** `imageAssetPublishingRoleArn`

This role is used to push Docker images to ECR (if your deployment uses container-based Lambda functions or custom images).

**Required Permissions:**
- ECR repository operations (PutImage, InitiateLayerUpload, UploadLayerPart, CompleteLayerUpload)
- ECR authentication (GetAuthorizationToken)

**Example Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "arn:aws:ecr:us-east-1:123456789012:repository/cdk-*-container-assets-*"
    },
    {
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    }
  ]
}
```

#### Lookup Role
**Parameter:** `lookupRoleArn`

This role is used during synthesis to look up context values (VPCs, availability zones, AMIs, etc.).

**Required Permissions:**
- Read-only access to EC2, VPC, and other services for context lookups
- SSM parameter read access

**Example Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeImages",
        "ssm:GetParameter"
      ],
      "Resource": "*"
    }
  ]
}
```

## Custom Asset Buckets and Repositories

### Using Custom S3 Buckets

If your organization requires using specific S3 buckets for CDK assets:

```json
{
  "synthesizer": {
    "type": "default",
    "fileAssetsBucketName": "my-org-cdk-assets-${AWS::AccountId}-${AWS::Region}",
    "bucketPrefix": "mlspace/"
  }
}
```

**Important Notes:**
- The bucket must exist before deployment
- The bucket must be in the same region as your deployment
- You can use CloudFormation pseudo-parameters like `${AWS::AccountId}` and `${AWS::Region}`
- Ensure your file asset publishing role has access to this bucket

### Using Custom ECR Repositories

For custom Docker image repositories:

```json
{
  "synthesizer": {
    "type": "default",
    "imageAssetsRepositoryName": "my-org-cdk-images",
    "dockerTagPrefix": "mlspace-"
  }
}
```

## Complete Configuration Examples

### Example 1: Using Pre-Existing Custom Roles

Most common scenario for enterprise deployments:

```json
{
  "synthesizer": {
    "type": "default",
    "cloudFormationExecutionRole": "arn:aws:iam::123456789012:role/MLSpace-CFN-Execution",
    "deployRoleArn": "arn:aws:iam::123456789012:role/MLSpace-Deploy",
    "fileAssetPublishingRoleArn": "arn:aws:iam::123456789012:role/MLSpace-FilePublish",
    "imageAssetPublishingRoleArn": "arn:aws:iam::123456789012:role/MLSpace-ImagePublish",
    "lookupRoleArn": "arn:aws:iam::123456789012:role/MLSpace-Lookup"
  }
}
```

### Example 2: CLI Synthesizer for Quick Deployments

No bootstrap required, uses your CLI credentials:

```json
{
  "synthesizer": {
    "type": "cli",
    "fileAssetsBucketName": "mlspace-deployment-assets-${AWS::AccountId}",
    "bucketPrefix": "cdk-assets/"
  }
}
```

**Before deploying:**
```bash
# Create the asset bucket
aws s3 mb s3://mlspace-deployment-assets-123456789012

# Enable versioning (recommended)
aws s3api put-bucket-versioning \
  --bucket mlspace-deployment-assets-123456789012 \
  --versioning-configuration Status=Enabled
```

### Example 3: Custom Roles with Custom Asset Locations

Combining custom roles and custom buckets:

```json
{
  "synthesizer": {
    "type": "default",
    "cloudFormationExecutionRole": "arn:aws:iam::123456789012:role/Enterprise-CFN-Execution",
    "deployRoleArn": "arn:aws:iam::123456789012:role/Enterprise-Deploy",
    "fileAssetPublishingRoleArn": "arn:aws:iam::123456789012:role/Enterprise-S3-Publisher",
    "fileAssetsBucketName": "enterprise-cdk-assets-${AWS::AccountId}-${AWS::Region}",
    "bucketPrefix": "mlspace/"
  }
}
```

### Example 4: Air-Gapped Environment

For restricted environments with limited internet access:

```json
{
  "synthesizer": {
    "type": "default",
    "fileAssetsBucketName": "internal-cdk-assets-${AWS::AccountId}-${AWS::Region}",
    "imageAssetsRepositoryName": "internal-cdk-images",
    "generateBootstrapVersionRule": false
  }
}
```

### Example 5: Using Custom Qualifier for Isolation

When you need to isolate bootstrap resources (e.g., multiple teams in same account):

```json
{
  "synthesizer": {
    "type": "default",
    "qualifier": "mlspace01"
  }
}
```

**Bootstrap with custom qualifier:**
```bash
cdk bootstrap aws://123456789012/us-east-1 --qualifier mlspace01
```

## Bootstrap Configuration

### Standard Bootstrap

For the default synthesizer with standard configuration:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Bootstrap with Custom Roles

If you're using pre-existing custom roles:

```bash
cdk bootstrap aws://123456789012/us-east-1 \
  --cloudformation-execution-policies arn:aws:iam::123456789012:policy/MLSpaceDeploymentPolicy \
  --trust 123456789012 \
  --trust-for-lookup 123456789012
```

### Bootstrap with Custom Bucket

To use an existing S3 bucket for assets:

```bash
cdk bootstrap aws://123456789012/us-east-1 \
  --bootstrap-bucket-name my-org-cdk-assets-123456789012-us-east-1
```

### No Bootstrap Required

When using the CLI synthesizer, no bootstrap is needed. Just ensure your asset bucket exists.

## Deployment Workflow

### Using Default Synthesizer with Custom Roles

**Step 1: Create Custom Roles**

Create your custom IAM roles with the appropriate permissions as described above.

**Step 2: Update cdk.json**

```json
{
  "synthesizer": {
    "type": "default",
    "cloudFormationExecutionRole": "arn:aws:iam::123456789012:role/YourCFNRole",
    "deployRoleArn": "arn:aws:iam::123456789012:role/YourDeployRole"
  }
}
```

**Step 3: Bootstrap Environment**

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

**Step 4: Deploy**

```bash
cdk deploy --all
```

### Using CLI Synthesizer

**Step 1: Create Asset Bucket**

```bash
aws s3 mb s3://my-deployment-bucket-123456789012
```

**Step 2: Update cdk.json**

```json
{
  "synthesizer": {
    "type": "cli",
    "fileAssetsBucketName": "my-deployment-bucket-${AWS::AccountId}"
  }
}
```

**Step 3: Deploy (No Bootstrap Needed)**

```bash
cdk deploy --all
```

## Troubleshooting

### Error: "Policy contains a statement with one or more invalid principals"

**Cause:** The CloudFormation execution role doesn't exist or the ARN is incorrect.

**Solution:** Verify the role exists and the ARN is correct in your `cdk.json`.

### Error: "User is not authorized to perform: iam:PassRole"

**Cause:** Your deploy role doesn't have permission to pass the CloudFormation execution role.

**Solution:** Add an IAM policy to your deploy role:
```json
{
  "Effect": "Allow",
  "Action": "iam:PassRole",
  "Resource": "arn:aws:iam::123456789012:role/YourCFNExecutionRole"
}
```

### Error: "Access Denied" when uploading assets

**Cause:** The file/image asset publishing role doesn't have S3/ECR permissions.

**Solution:** Verify the publishing roles have the correct permissions to the asset bucket/repository.

### Error: "Bootstrap stack version mismatch"

**Cause:** The bootstrap stack version doesn't match the CDK version requirements.

**Solution:** Update your bootstrap stack:
```bash
cdk bootstrap --force aws://ACCOUNT-ID/REGION
```

### Error: "Bucket does not exist"

**Cause:** Custom asset bucket specified in configuration doesn't exist.

**Solution:** Create the bucket before deployment or remove the `fileAssetsBucketName` parameter to use the default.

## Comparison: When to Use Each Synthesizer

| Feature | Default | CLI | Legacy |
|---------|---------|-----|--------|
| Requires Bootstrap | Yes | No | No |
| Custom Roles Support | Full | Limited | No |
| Custom Asset Locations | Yes | Yes | Limited |
| Large Asset Support | Excellent | Good | Poor |
| Security Controls | Excellent | Good | Basic |
| Setup Complexity | Medium | Low | Low |
| **Recommended For** | Production | Prototypes | Migration Only |

## Security Best Practices

1. **Principle of Least Privilege:** Grant only the minimum permissions required for each role.

2. **Separate Roles:** Use different roles for different operations (deploy, publish, lookup) to limit blast radius.

3. **Role Session Duration:** Configure appropriate session durations for your deployment roles.

4. **MFA Requirements:** Consider requiring MFA for assuming deployment roles in production.

5. **Audit Logging:** Enable CloudTrail logging for all role assumptions and API calls.

6. **Permission Boundaries:** Use IAM permission boundaries to limit the maximum permissions of created roles.

7. **Regular Reviews:** Periodically review and audit role permissions and usage.

8. **Encryption:** Ensure asset buckets use KMS encryption and grant appropriate KMS permissions.

## Additional Resources

- [AWS CDK Bootstrapping Documentation](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)
- [DefaultStackSynthesizer API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.DefaultStackSynthesizer.html)
- [CliCredentialsStackSynthesizer API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.CliCredentialsStackSynthesizer.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [{{ $params.APPLICATION_NAME }} Security Considerations](./getting-started.md#security-considerations)

## Support

For issues or questions about custom synthesizer configuration:
1. Review the troubleshooting section above
2. Check CDK CLI output for detailed error messages
3. Verify IAM role permissions using the AWS IAM Policy Simulator
4. Consult the AWS CDK GitHub repository for known issues
