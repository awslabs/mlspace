---
outline: deep
---

# CDK Deployment

## Deployment Prerequisites

### Software

In order to build and deploy {{ $params.APPLICATION_NAME }} to your AWS account, you will need the following software installed on your machine:

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [awscli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [nodejs](https://nodejs.org/en/download/)
- cdk (`npm install -g cdk`)


### Information

In addition to the required software, you will also need to have the following information:

- AWS account Id and region you'll be deploying {{ $params.APPLICATION_NAME }} into (you'll need admin credentials or similar)
- Identity provider (IdP) information including the OIDC endpoint and client name

### EMR Roles

::: warning
When deploying in isolated regions, you must ensure that the [EMR Service Linked Role](https://docs.aws.amazon.com/emr/latest/ManagementGuide/using-service-linked-roles.html) has been manually created prior to launching EMR Clusters.
:::

{{ $params.APPLICATION_NAME }} leverages the default EMR roles which may already exist in your account if you've previously
launched an EMR cluster in your account. If these roles do not exist, {{ $params.APPLICATION_NAME }} can create these for
you as part of the CDK deployment. However, if you prefer to create these separately, you can set
`EMR_DEFAULT_ROLE_ARN` and `EMR_EC2_INSTANCE_ROLE_ARN` in `constants.ts` and {{ $params.APPLICATION_NAME }} will use your
exisiting roles. If you need to create these roles outside of the CDK deployment, the two roles should
be configured as follows:

#### Service Role

1. Login to your AWS account and go to the Roles section of the IAM Service in the AWS Console.
2. Click the "Create role" button and then click the "AWS service" card under "Trusted entity type".
3. Select the "EMR" service from the dropdown and select the radio button for "EMR" under use case.
4. Click the next button to advance to the policy screen; the necessary policy will already be attached. Click next to continue.
5. You can name the role whatever you'd like. Optionally add a description and tags and then click "Create role"
6. Once the role has been created, record the role ARN as we'll need to use it later.

#### Instance Role

1. Login to your AWS account and go to the Roles section of the IAM Service in the AWS Console.
2. Click the "Create role" button and then click the "AWS service" card under "Trusted entity type".
3. Select the "EMR" service from the dropdown and select the radio button for "EMR Role for EC2" under use case.
4. Click the next button to advance to the policy screen; the necessary policy will already be attached. Click next to continue.
5. You can name the role whatever you'd like. Optionally add a description and tags and then click "Create role"
6. Once the role has been created, record the role ARN as we'll need to use it later.

#### Cleanup Role

_The cleanup role needs to exist but we do not need the ARN_.

1. Login to your AWS account and go to the Roles section of the IAM Service in the AWS Console.
2. Click the "Create role" button and then click the "AWS service" card under "Trusted entity type".
3. Select the "EMR" service from the dropdown and select the radio button for "EMR - Cleanup" under use case.
4. Click the next button to advance to the policy screen; the necessary policy will already be attached. Click next to continue.
5. The role has a default name that you cannot change. You can update the description if you want and then click "Create role"

### Application Roles

We generally expect customers to use their own roles for the {{ $params.APPLICATION_NAME }} APIGW and lambda execution role as well as for the default notebook role.
While customers may scope these roles down based on the guidelines of their own organization, the following can be used to quickly stand up
an instance of {{ $params.APPLICATION_NAME }} for demo purposes only. As written, these roles and policies should not be used for production use cases.

The policies below include a number of placeholder variables that you'll need to replace. These policies are meant to serve as a starting point and are tightly scoped
to the resources {{ $params.APPLICATION_NAME }} expects to use. You can relax these restrictions as necessary
or make any additional changes required for your environment.

| Variable | Expected Value | Example |
|----------|----------------|---------|
| `{AWS_PARTITION}` | The partition into which {{ $params.APPLICATION_NAME }} is being deployed | `aws` |
| `{AWS_REGION}` | The region into which {{ $params.APPLICATION_NAME }} is being deployed | `us-east-1` |
| `{AWS_ACCOUNT}` | The account number of the account into which {{ $params.APPLICATION_NAME }} is being deployed | `123456789012` |
| `{MLSPACE_KMS_KEY_ID}` | The ID of the KMS Key which is being used to encrypt data in {{ $params.APPLICATION_NAME }} | `eeecf0d8-44f3-4b29-8b78-55de1b5dc153` |
| `{MLSPACE_PRIVATE_SUBNET_1}` | The subnet ID of one of the {{ $params.APPLICATION_NAME }} VPC private subnets | `subnet-0a11b2c3333dd44e5` |
| `{MLSPACE_PRIVATE_SUBNET_2}` | The subnet ID of one of the {{ $params.APPLICATION_NAME }} VPC private subnets | `subnet-0a11b2c3333dd44e5` |
| `{MLSPACE_PRIVATE_SUBNET_3}` | The subnet ID of one of the {{ $params.APPLICATION_NAME }} VPC private subnets | `subnet-0a11b2c3333dd44e5` |
| `{MLSPACE_VPC_SECURITY_GROUP}` | The ID of the default security group for the {{ $params.APPLICATION_NAME }} VPC | `sg-903004f8` |
| `{EMR_DEFAULT_ROLE_ARN}` | The ARN of the role that will be used as the "ServiceRole" for all EMR Clusters created via {{ $params.APPLICATION_NAME }} | `arn:aws:iam::123456789012:role/EMR_DefaultRole` |
| `{EMR_EC2_INSTANCE_ROLE_ARN}` | The ARN of the role that will be used as the "JobFlowRole" and "AutoScalingRole" for all EMR Clusters created via {{ $params.APPLICATION_NAME }} | `arn:aws:iam::123456789012:role/EMR_EC2_DefaultRole` |
| `{MLSPACE_APP_ROLE_NAME}` | The name of the {{ $params.APPLICATION_NAME }} application role | `mlspace-app-role` |
| `{MLSPACE_SYSTEM_ROLE_NAME}` | The name of the {{ $params.APPLICATION_NAME }} system role | `mlspace-system-role` |
| `{MLSPACE_NOTEBOOK_ROLE_NAME}` | The name of the {{ $params.APPLICATION_NAME }} notebook role | `mlspace-notebook-role` |
| `{ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN}` | ARN for policy constraining the instance size that can be used when creating Endpoint configurations from a notebook. | - |
| `{JOB_INSTANCE_CONSTRAINT_POLICY_ARN}` | ARN for policy constraining the instance size that can be used when creating HPO/Training/Transform jobs from a notebook. | - |

#### Notebook Role

In order to create the default {{ $params.APPLICATION_NAME }} notebook policy and role, do the following:

1. Log in to your AWS account and go to the Policies section of the IAM Service in the AWS Console.
2. Create a new policy using the JSON editor and paste the following in the text area (after replacing the placeholder variables):

:::tabs
== Dynamic Roles Enabled
```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Condition": {
                "Bool": {
                    "kms:GrantIsForAWSResource": "true"
                }
            },
            "Action": "kms:CreateGrant",
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:CreateNetworkInterface",
                "ec2:CreateNetworkInterfacePermission",
                "ec2:DeleteNetworkInterface",
                "ec2:DeleteNetworkInterfacePermission"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_1}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_2}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_3}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:security-group/{MLSPACE_VPC_SECURITY_GROUP}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:network-interface/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:Encrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Action": "sagemaker:AddTags",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeDhcpOptions",
                "ec2:DescribeSubnets",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeVpcs"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:DescribeWorkteam",
                "sagemaker:ListEndpointConfigs",
                "sagemaker:ListEndpoints",
                "sagemaker:ListLabelingJobs",
                "sagemaker:ListModels",
                "sagemaker:ListTags",
                "sagemaker:ListTrainingJobs",
                "sagemaker:ListTransformJobs",
                "sagemaker:ListHyperParameterTuningJobs",
                "sagemaker:ListTrainingJobsForHyperParameterTuningJob"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:GetRole",
                "cloudwatch:PutMetricData",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false"
                }
            },
            "Action": "sagemaker:CreateEndpoint",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint/*",
            "Effect": "Allow"
        },
        {
            "Action": "sagemaker:CreateEndpoint",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint-config/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "true",
                    "aws:RequestTag/system": "true",
                    "aws:RequestTag/project": "true",
                    "sagemaker:VolumeKmsKey": "true"
                }
            },
            "Action": "sagemaker:CreateEndpointConfig",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint-config/*",
            "Effect": "Deny"
        },
        {
            "Condition": {
                "Null": {
                    "sagemaker:VpcSubnets": "true",
                    "aws:RequestTag/user": "true",
                    "aws:RequestTag/system": "true",
                    "aws:RequestTag/project": "true",
                    "sagemaker:VpcSecurityGroupIds": "true"
                }
            },
            "Action": "sagemaker:CreateModel",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Deny"
        },
        {
            "Condition": {
                "Null": {
                    "sagemaker:VpcSubnets": "true",
                    "aws:RequestTag/user": "true",
                    "aws:RequestTag/system": "true",
                    "aws:RequestTag/project": "true",
                    "sagemaker:VpcSecurityGroupIds": "true",
                    "sagemaker:VolumeKmsKey": "true"
                }
            },
            "Action": [
                "sagemaker:CreateHyperParameterTuningJob",
                "sagemaker:CreateTrainingJob"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:training-job/*",
                "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:hyper-parameter-training-job/*",
            ],
            "Effect": "Deny"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "true",
                    "aws:RequestTag/system": "true",
                    "aws:RequestTag/project": "true",
                    "sagemaker:VolumeKmsKey": "true"
                }
            },
            "Action": "sagemaker:CreateTransformJob",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:transform-job/*",
            "Effect": "Deny"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": "sagemaker:CreateLabelingJob",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:labeling-job/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:ResourceTag/project": "false",
                    "aws:ResourceTag/system": "false",
                    "aws:ResourceTag/user": "false"
                }
            },
            "Action": [
                "sagemaker:DescribeTrainingJob",
                "sagemaker:StopTrainingJob",
                "sagemaker:DescribeTransformJob",
                "sagemaker:StopTransformJob",
                "sagemaker:DescribeModel",
                "sagemaker:DeleteModel",
                "sagemaker:DescribeHyperParameterTuningJob",
                "sagemaker:StopHyperParameterTuningJob",
                "sagemaker:DescribeEndpoint",
                "sagemaker:DeleteEndpoint",
                "sagemaker:InvokeEndpoint",
                "sagemaker:UpdateEndpoint",
                "sagemaker:UpdateEndpointWeightsAndCapacities",
                "sagemaker:DescribeEndpointConfig",
                "sagemaker:DeleteEndpointConfig",
                "sagemaker:DescribeLabelingJob",
                "sagemaker:StopLabelingJob"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "comprehend:Detect*",
                "comprehend:BatchDetect*",
                "translate:TranslateText"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:s3:::mlspace-config-{AWS_ACCOUNT}",
                "arn:{AWS_PARTITION}:s3:::mlspace-config-{AWS_ACCOUNT}/*",
                "arn:{AWS_PARTITION}:s3:::sagemaker-sample-files",
                "arn:{AWS_PARTITION}:s3:::sagemaker-sample-files/*",
                "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}/global-read-only/*"
            ],
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringLike": {
                    "s3:prefix": "global-read-only/*"
                }
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}",
            "Effect": "Allow"
        }
    ]
}
```
== Dynamic Roles Disabled
```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "iam:GetRole",
                "cloudwatch:PutMetricData",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:Encrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Bool": {
                    "kms:GrantIsForAWSResource": "true"
                }
            },
            "Action": "kms:CreateGrant",
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:CreateNetworkInterface",
                "ec2:CreateNetworkInterfacePermission",
                "ec2:DeleteNetworkInterface",
                "ec2:DeleteNetworkInterfacePermission"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_1}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_2}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_3}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:security-group/{MLSPACE_VPC_SECURITY_GROUP}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:network-interface/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeDhcpOptions",
                "ec2:DescribeSubnets",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeVpcs"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": "sagemaker:AddTags",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:DescribeWorkteam",
                "sagemaker:ListEndpointConfigs",
                "sagemaker:ListEndpoints",
                "sagemaker:ListLabelingJobs",
                "sagemaker:ListModels",
                "sagemaker:ListTags",
                "sagemaker:ListTrainingJobs",
                "sagemaker:ListTransformJobs",
                "sagemaker:ListHyperParameterTuningJobs",
                "sagemaker:ListTrainingJobsForHyperParameterTuningJob"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false"
                }
            },
            "Action": "sagemaker:CreateEndpoint",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint/*",
            "Effect": "Allow"
        },
        {
            "Action": "sagemaker:CreateEndpoint",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint-config/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": "sagemaker:CreateEndpointConfig",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint-config/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "sagemaker:VpcSubnets": "false",
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VpcSecurityGroupIds": "false"
                }
            },
            "Action": "sagemaker:CreateModel",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "sagemaker:VpcSubnets": "false",
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VpcSecurityGroupIds": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": [
                "sagemaker:CreateHyperParameterTuningJob",
                "sagemaker:CreateTrainingJob"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": "sagemaker:CreateTransformJob",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:transform-job/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": "sagemaker:CreateLabelingJob",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:labeling-job/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:ResourceTag/project": "false",
                    "aws:ResourceTag/system": "false",
                    "aws:ResourceTag/user": "false"
                }
            },
            "Action": [
                "sagemaker:DescribeTrainingJob",
                "sagemaker:StopTrainingJob",
                "sagemaker:DescribeTransformJob",
                "sagemaker:StopTransformJob",
                "sagemaker:DescribeModel",
                "sagemaker:DeleteModel",
                "sagemaker:DescribeHyperParameterTuningJob",
                "sagemaker:StopHyperParameterTuningJob",
                "sagemaker:DescribeEndpoint",
                "sagemaker:DeleteEndpoint",
                "sagemaker:InvokeEndpoint",
                "sagemaker:UpdateEndpoint",
                "sagemaker:UpdateEndpointWeightsAndCapacities",
                "sagemaker:DescribeEndpointConfig",
                "sagemaker:DeleteEndpointConfig",
                "sagemaker:DescribeLabelingJob",
                "sagemaker:StopLabelingJob"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "comprehend:Detect*",
                "comprehend:BatchDetect*",
                "translate:TranslateText"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:s3:::mlspace-config-{AWS_ACCOUNT}",
                "arn:{AWS_PARTITION}:s3:::mlspace-config-{AWS_ACCOUNT}/*",
                "arn:{AWS_PARTITION}:s3:::sagemaker-sample-files",
                "arn:{AWS_PARTITION}:s3:::sagemaker-sample-files/*",
                "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}/global-read-only/*"
            ],
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringLike": {
                    "s3:prefix": "global-read-only/*"
                }
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}",
            "Effect": "Allow"
        }
    ]
}
```
:::

3. Click next and optionally add tags to this policy.
4. Click next again and enter a name for this policy. You can name the policy whatever you'd like, but ensure you remember it as you'll need it when creating the role.
5. After the policy has been created, you are now ready to create the role. From the IAM Service page, click "Roles" on the left-hand side.
6. Click the "Create role" button and then click the "Custom trust policy" card under "Trusted entity type".
7. Copy and paste the following content into the "Custom trust policy" text area:

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "sagemaker.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

8. Click the next button and then select the checkbox next to the name of the policy you created in step 4 above.
9. After selecting the checkbox for the policy, click next and enter a name for the role. The name should begin with "MLSpace" (Ex: MLSpaceNotebookRole). Optionally add a description and tags, and then click "Create role".
10. Once the role has been created, record the role ARN as we'll need to use it later.

#### App Role

In order to create the default {{ $params.APPLICATION_NAME }} Application policy and role, do the following:

1. Log in to your AWS account and go to the Policies section of the IAM Service in the AWS Console.
2. Create a new managed policy which will be used as a permissions boundary for dynamically created
project users' roles. This policy assumes you're using the default value for the S3 data and config
bucket names (`mlspace-data-{AWS_ACCOUNT}` and `mlspace-config-{AWS_ACCOUNT}`).
If you're using a custom data bucket name, you'll need to update the resource values within the policy.
Using the JSON editor, paste the following into the text area (after replacing the placeholder variables):

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "s3:DeleteObject",
                "s3:GetObject",
                "s3:PutObject",
                "s3:PutObjectTagging"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}/project/*",
                "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}/global/*",
                "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}/private/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:PutObjectTagging"
            ],
            "Resource": "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}/index/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringLike": {
                    "s3:prefix": [
                        "global/*",
                        "index/*",
                        "private/*",
                        "project/*"
                    ]
                }
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}",
            "Effect": "Allow"
        },
        {
            "Action": "s3:GetBucketLocation",
            "Resource": "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": "sagemaker.amazonaws.com"
                }
            },
            "Action": "iam:PassRole",
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:GetRole",
                "cloudwatch:PutMetricData",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "kms:Decrypt",
                "kms:Encrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Bool": {
                    "kms:GrantIsForAWSResource": "true"
                }
            },
            "Action": "kms:CreateGrant",
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:CreateNetworkInterface",
                "ec2:CreateNetworkInterfacePermission",
                "ec2:DeleteNetworkInterface",
                "ec2:DeleteNetworkInterfacePermission"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_1}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_2}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_3}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:security-group/{MLSPACE_VPC_SECURITY_GROUP}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:network-interface/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeDhcpOptions",
                "ec2:DescribeSubnets",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeVpcs"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": "sagemaker:AddTags",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:DescribeWorkteam",
                "sagemaker:ListEndpointConfigs",
                "sagemaker:ListEndpoints",
                "sagemaker:ListLabelingJobs",
                "sagemaker:ListModels",
                "sagemaker:ListTags",
                "sagemaker:ListTrainingJobs",
                "sagemaker:ListTransformJobs",
                "sagemaker:ListHyperParameterTuningJobs",
                "sagemaker:ListTrainingJobsForHyperParameterTuningJob"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false"
                }
            },
            "Action": "sagemaker:CreateEndpoint",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint/*",
            "Effect": "Allow"
        },
        {
            "Action": "sagemaker:CreateEndpoint",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint-config/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": "sagemaker:CreateEndpointConfig",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:endpoint-config/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "sagemaker:VpcSubnets": "false",
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VpcSecurityGroupIds": "false"
                }
            },
            "Action": "sagemaker:CreateModel",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "sagemaker:VpcSubnets": "false",
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VpcSecurityGroupIds": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": [
                "sagemaker:CreateHyperParameterTuningJob",
                "sagemaker:CreateTrainingJob"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": "sagemaker:CreateTransformJob",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:transform-job/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": "sagemaker:CreateLabelingJob",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:labeling-job/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:ResourceTag/project": "false",
                    "aws:ResourceTag/system": "false",
                    "aws:ResourceTag/user": "false"
                }
            },
            "Action": [
                "sagemaker:DescribeTrainingJob",
                "sagemaker:StopTrainingJob",
                "sagemaker:DescribeTransformJob",
                "sagemaker:StopTransformJob",
                "sagemaker:DescribeModel",
                "sagemaker:DeleteModel",
                "sagemaker:DescribeHyperParameterTuningJob",
                "sagemaker:StopHyperParameterTuningJob",
                "sagemaker:DescribeEndpoint",
                "sagemaker:DeleteEndpoint",
                "sagemaker:InvokeEndpoint",
                "sagemaker:UpdateEndpoint",
                "sagemaker:UpdateEndpointWeightsAndCapacities",
                "sagemaker:DescribeEndpointConfig",
                "sagemaker:DeleteEndpointConfig",
                "sagemaker:DescribeLabelingJob",
                "sagemaker:StopLabelingJob"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "comprehend:Detect*",
                "comprehend:BatchDetect*",
                "translate:TranslateText"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:s3:::mlspace-config-{AWS_ACCOUNT}",
                "arn:{AWS_PARTITION}:s3:::mlspace-config-{AWS_ACCOUNT}/*",
                "arn:{AWS_PARTITION}:s3:::sagemaker-sample-files",
                "arn:{AWS_PARTITION}:s3:::sagemaker-sample-files/*",
                "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}/global-read-only/*"
            ],
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringLike": {
                    "s3:prefix": "global-read-only/*"
                }
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:{AWS_PARTITION}:s3:::mlspace-data-{AWS_ACCOUNT}",
            "Effect": "Allow"
        }
    ]
}
```

3. Click next and optionally add tags to this policy.
4. Click next again and enter a name for this policy. You can name the policy whatever you'd like,
but ensure you remember it as you'll need it when creating the role. The example below assumes you've
named the policy `mlspace-project-user-permission-boundary`. If you've named it something different,
you'll need to update the `iam:PermissionsBoundary` condition in the `iam:CreateRole` statement below.
5. After the permission boundary policy has been created, you are now ready to create the application
policy. From the IAM Service page, click "Policies" on the left-hand side.
6. Create a new policy using the JSON editor and paste the following into the text area (after replacing the placeholder variables):

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "kms:RetireGrant",
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Action": "logs:FilterLogEvents",
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:PassRole",
                "iam:ListRoleTags"
            ],
            "Resource": [
                "{EMR_DEFAULT_ROLE_ARN}",
                "{EMR_EC2_INSTANCE_ROLE_ARN}",
                "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/{MLSPACE_APP_ROLE_NAME}"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:Scan",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:UpdateItem"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:dynamodb:{AWS_REGION}:{AWS_ACCOUNT}:table/mlspace-*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": "ec2:AuthorizeSecurityGroupIngress",
            "Resource": "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:security-group/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:DescribeInstances",
                "ec2:DescribeRouteTables",
                "ec2:DescribeInstanceTypeOfferings",
                "ec2:DescribeVpcEndpoints"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:List*",
                "s3:Get*",
                "s3:PutObject",
                "s3:PutObjectTagging",
                "s3:DeleteObject",
                "s3:PutBucketNotification"
            ],
            "Resource": "arn:{AWS_PARTITION}:s3:::*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEquals": {
                    "sagemaker:DirectInternetAccess": "Disabled",
                    "sagemaker:RootAccess": "Disabled"
                },
                "Null": {
                    "sagemaker:VpcSubnets": "false",
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VpcSecurityGroupIds": "false",
                    "sagemaker:VolumeKmsKey": "false"
                }
            },
            "Action": "sagemaker:CreateNotebookInstance",
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:notebook-instance/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:CreateNotebookInstanceLifecycleConfig",
                "sagemaker:UpdateNotebookInstanceLifecycleConfig",
                "sagemaker:DeleteNotebookInstanceLifecycleConfig",
                "sagemaker:DescribeNotebookInstanceLifecycleConfig"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:notebook-instance-lifecycle-config/*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:ResourceTag/project": "false",
                    "aws:ResourceTag/system": "false",
                    "aws:ResourceTag/user": "false"
                }
            },
            "Action": [
                "sagemaker:DeleteNotebookInstance",
                "sagemaker:DescribeNotebookInstance",
                "sagemaker:StartNotebookInstance",
                "sagemaker:StopNotebookInstance",
                "sagemaker:UpdateNotebookInstance"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:notebook-instance/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:CreatePresignedNotebookInstanceUrl"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:notebook-instance/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:ListNotebookInstanceLifecycleConfigs",
                "sagemaker:ListNotebookInstances"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": "lambda:InvokeFunction",
            "Resource": "arn:{AWS_PARTITION}:lambda:{AWS_REGION}:{AWS_ACCOUNT}:function:mls-lambda-*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "elasticmapreduce:RunJobFlow",
                "elasticmapreduce:ListClusters",
                "elasticmapreduce:ListReleaseLabels"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "elasticmapreduce:DescribeCluster",
                "elasticmapreduce:ListInstances",
                "elasticmapreduce:AddTags",
                "elasticmapreduce:TerminateJobFlows",
                "elasticmapreduce:SetTerminationProtection"
            ],
            "Resource": "arn:{AWS_PARTITION}:elasticmapreduce:{AWS_REGION}:{AWS_ACCOUNT}:cluster/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "translate:StopTextTranslationJob",
                "translate:ListTextTranslationJobs",
                "translate:StartTextTranslationJob",
                "translate:DescribeTextTranslationJob",
                "translate:TranslateDocument",
                "translate:TranslateText",
                "translate:ListTerminologies",
                "translate:ListLanguages"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEquals": {
                    "iam:PermissionsBoundary": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:policy/mlspace-project-user-permission-boundary"
                },
                "StringEqualsIgnoreCase": {
                    "iam:ResourceTag/system": "MLSpace"
                }
            },
            "Action": "iam:CreateRole",
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEqualsIgnoreCase": {
                    "iam:ResourceTag/system": "MLSpace"
                }
            },
            "Action": [
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:DeleteRole",
                "iam:DeleteRolePolicy",
                "iam:PutRolePolicy"
            ],
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/{MLSPACE_APP_ROLE_NAME}",
                "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/{MLSPACE_NOTEBOOK_ROLE_NAME}",
                "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/MLSpace*",
            ],
            "Condition": {
                "StringEqualsIgnoreCase": {
                    "iam:ResourceTag/system": "MLSpace"
                },
                "ForAnyValue:StringLike": {
                    "iam:PolicyARN": [
                        "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:policy/MLSpace-app-denied-services",
                        "{ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN}",
                        "{JOB_INSTANCE_CONSTRAINT_POLICY_ARN}"
                    ]
                }
            },
        },
        {
            "Action": [
                "iam:ListRoles",
                "iam:ListEntitiesForPolicy",
                "iam:ListPolicyVersions",
                "iam:ListAttachedRolePolicies",
                "iam:GetRole",
                "iam:GetPolicy"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:CreatePolicy",
                "iam:CreatePolicyVersion",
                "iam:DeletePolicy",
                "iam:DeletePolicyVersion",
                "iam:TagPolicy"
            ],
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:policy/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:SimulatePrincipalPolicy",
                "iam:TagRole"
            ],
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": "sagemaker.amazonaws.com"
                }
            },
            "Action": "iam:PassRole",
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": "translate.amazonaws.com"
                }
            },
            "Action": "iam:PassRole",
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/{MLSPACE_APP_ROLE_NAME}",
            "Effect": "Allow"
        }
    ]
}
```

7. Click next and optionally add tags to this policy.
8. Click next again and enter a name for this policy. You can name the policy whatever you'd like, but ensure you remember it as you'll need it when creating the role.
9. After the policy has been created, you are now ready to create the role. From the IAM Service page, click "Roles" on the left-hand side.
10. Click the "Create role" button and then click the "Custom trust policy" card under "Trusted entity type".
11. Copy and paste the following content into the "Custom trust policy" text area:

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

12. Click the next button and then select the checkbox next to the name of the policy you created in step 8 above. You will also need to attach the default notebook policy you previously created, as well as the AWS managed policy `AWSLambdaVPCAccessExecutionRole`. In total, you should have 3 policies attached to the role.
13. After selecting the 3 policies, click next and enter a name for the role. You can name the role whatever you'd like. Optionally add a description and tags, and then click "Create role".
14. Once the role has been created, record the role ARN as we'll need to use it later.

#### System Role

1. The example below assumes you've created the permission boundary policy above in the [App Role](App Role) section and named the policy `mlspace-project-user-permission-boundary`. If you've named it something different
you'll need to update the `"iam:PermissionsBoundary` condition in the `iam:CreateRole` statement below.
2. After the permission boundary policy has been created you are now ready to create the system
policy. From the IAM Service page click "Policies" on the left hand side. **Note**: alternatively, you can re-use the policy you created in the prior section for the App Role as well as the notebook policy you created in the Notebook Role section. If you do so, you may skip to step 6. Alternatively if you wish to create a policy with least-privilege, proceed to step 3.
3. Create a new policy using the JSON editor and paste the following in the text area (after replacing the placeholder variables):

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "kms:RetireGrant",
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Action": "logs:FilterLogEvents",
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:PassRole",
                "iam:ListRoleTags"
            ],
            "Resource": [
                "{EMR_DEFAULT_ROLE_ARN}",
                "{EMR_EC2_INSTANCE_ROLE_ARN}",
                "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/{MLSPACE_SYSTEM_ROLE_NAME}"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:Scan",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:UpdateItem"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:dynamodb:{AWS_REGION}:{AWS_ACCOUNT}:table/mlspace-*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": "ec2:AuthorizeSecurityGroupIngress",
            "Resource": "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:security-group/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:DescribeInstances",
                "ec2:DescribeRouteTables",
                "ec2:DescribeInstanceTypeOfferings",
                "ec2:DescribeVpcEndpoints"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:List*",
                "s3:Get*",
                "s3:DeleteObject",
                "s3:PutBucketNotification"
            ],
            "Resource": "arn:{AWS_PARTITION}:s3:::*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:ResourceTag/project": "false",
                    "aws:ResourceTag/system": "false",
                    "aws:ResourceTag/user": "false"
                }
            },
            "Action": [
                "sagemaker:UpdateNotebookInstance",
                "sagemaker:DeleteNotebookInstance",
                "sagemaker:DescribeNotebookInstance",
                "sagemaker:StopNotebookInstance"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:notebook-instance/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:UpdateNotebookInstanceLifecycleConfig",
                "sagemaker:DeleteNotebookInstanceLifecycleConfig",
                "sagemaker:DescribeNotebookInstanceLifecycleConfig"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:notebook-instance-lifecycle-config/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:ListNotebookInstanceLifecycleConfigs",
                "sagemaker:ListNotebookInstances"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": "lambda:InvokeFunction",
            "Resource": "arn:{AWS_PARTITION}:lambda:{AWS_REGION}:{AWS_ACCOUNT}:function:mls-lambda-*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "elasticmapreduce:ListClusters"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "elasticmapreduce:DescribeCluster",
                "elasticmapreduce:ListInstances",
                "elasticmapreduce:TerminateJobFlows",
                "elasticmapreduce:SetTerminationProtection"
            ],
            "Resource": "arn:{AWS_PARTITION}:elasticmapreduce:{AWS_REGION}:{AWS_ACCOUNT}:cluster/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "translate:StopTextTranslationJob",
                "translate:ListTextTranslationJobs",
                "translate:DescribeTextTranslationJob"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEqualsIgnoreCase": {
                    "iam:ResourceTag/system": "MLSpace"
                }
            },
            "Action": [
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:DeleteRole",
                "iam:DeleteRolePolicy"
            ],
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:ListRoles",
                "iam:ListEntitiesForPolicy",
                "iam:ListPolicyVersions",
                "iam:ListAttachedRolePolicies",
                "iam:GetRole",
                "iam:GetPolicy",
                "cloudwatch:PutMetricData",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:Encrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Bool": {
                    "kms:GrantIsForAWSResource": "true"
                }
            },
            "Action": "kms:CreateGrant",
            "Resource": "arn:{AWS_PARTITION}:kms:{AWS_REGION}:{AWS_ACCOUNT}:key/{MLSPACE_KMS_KEY_ID}",
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:CreateNetworkInterface",
                "ec2:CreateNetworkInterfacePermission",
                "ec2:DeleteNetworkInterface",
                "ec2:DeleteNetworkInterfacePermission"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_1}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_2}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:subnet/{MLSPACE_PRIVATE_SUBNET_3}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:security-group/{MLSPACE_VPC_SECURITY_GROUP}",
                "arn:{AWS_PARTITION}:ec2:{AWS_REGION}:{AWS_ACCOUNT}:network-interface/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeDhcpOptions",
                "ec2:DescribeSubnets",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeVpcs"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "sagemaker:DescribeWorkteam",
                "sagemaker:ListEndpointConfigs",
                "sagemaker:ListEndpoints",
                "sagemaker:ListLabelingJobs",
                "sagemaker:ListModels",
                "sagemaker:ListTags",
                "sagemaker:ListTrainingJobs",
                "sagemaker:ListTransformJobs",
                "sagemaker:ListHyperParameterTuningJobs",
                "sagemaker:ListTrainingJobsForHyperParameterTuningJob"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "Null": {
                    "aws:ResourceTag/project": "false",
                    "aws:ResourceTag/system": "false",
                    "aws:ResourceTag/user": "false"
                }
            },
            "Action": [
                "sagemaker:DescribeTrainingJob",
                "sagemaker:StopTrainingJob",
                "sagemaker:DescribeTransformJob",
                "sagemaker:StopTransformJob",
                "sagemaker:DescribeModel",
                "sagemaker:DeleteModel",
                "sagemaker:DescribeHyperParameterTuningJob",
                "sagemaker:StopHyperParameterTuningJob",
                "sagemaker:DescribeEndpoint",
                "sagemaker:DeleteEndpoint",
                "sagemaker:InvokeEndpoint",
                "sagemaker:UpdateEndpoint",
                "sagemaker:UpdateEndpointWeightsAndCapacities",
                "sagemaker:DescribeEndpointConfig",
                "sagemaker:DeleteEndpointConfig",
                "sagemaker:DescribeLabelingJob",
                "sagemaker:StopLabelingJob"
            ],
            "Resource": "arn:{AWS_PARTITION}:sagemaker:{AWS_REGION}:{AWS_ACCOUNT}:*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:CreatePolicy",
                "iam:CreatePolicyVersion",
                "iam:TagPolicy",
                "iam:DeletePolicy",
                "iam:DeletePolicyVersion"
            ],
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:policy/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": "sagemaker.amazonaws.com"
                }
            },
            "Action": "iam:PassRole",
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/MLSpace*",
            "Effect": "Allow"
        },
        {
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": "translate.amazonaws.com"
                }
            },
            "Action": "iam:PassRole",
            "Resource": "arn:{AWS_PARTITION}:iam::{AWS_ACCOUNT}:role/{MLSPACE_SYSTEM_ROLE_NAME}",
            "Effect": "Allow"
        }
    ]
}
```

4. Click next and optionally add tags to this policy
5. Click next again and enter a name for this policy. You can name the policy whatever you'd like (ex: systemPolicy) but ensure you remember it as you'll need it when creating the role.
6. After the policy has been created you are now ready to create the role. From the IAM Service page click "Roles" on the left hand side.
7. Click the "Create role" button and then click the "Custom trust policy" card under "Trusted entity type".
8. Copy and paste the following content into the "Custom trust policy" text area:

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

9. Click the next button and then select the checkbox next to the name of the policy you created in step 5 above (or the app policy and notebook policy if re-using those). You will also need to attach the AWS managed policy `AWSLambdaVPCAccessExecutionRole`. In total you should have 3 policies attached to the role.
10. After selecting the 3 policies click next and enter a name for the role. You can name the role whatever you'd like. Optionally add a description and tags and then click "Create role"
11. Once the role has been created record the role ARN as we'll need to use it later.

#### S3 Reader Role

The {{ $params.APPLICATION_NAME }} React app is hosted statically in S3 and accessed via an API Gateway S3 proxy integration. This proxy resource will use the role associated with the `S3_READER_ROLE_ARN` in `constants.ts` if specified. If you do not specify an ARN, {{ $params.APPLICATION_NAME }} will attempt to create a new role. You can manually create the necessary policy and role using the following steps:

1. Log in to your AWS account and go to the Policies section of the IAM Service in the AWS Console.
2. Create a new policy using the JSON editor and paste the following into the text area (after replacing the placeholder variables):

```JSON
{
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Action": ["s3:GetObject"],
        "Resource": ["arn:{AWS_PARTITION}:s3:::mlspace-website-{AWS_ACCOUNT}/*"]
    }]
}
```

3. Click next and optionally add tags to this policy.
4. Click next again and enter a name for this policy. You can name the policy whatever you'd like, but ensure you remember it as you'll need it when creating the role.
5. After the policy has been created, you are now ready to create the role. From the IAM Service page, click "Roles" on the left-hand side.
6. Click the "Create role" button and then click the "Custom trust policy" card under "Trusted entity type".
7. Copy and paste the following content into the "Custom trust policy" text area:

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "apigateway.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

8. Click the next button and then select the checkbox next to the name of the policy you created in step 4 above.
9. After selecting the policy, click next and enter a name for the role. You can name the role whatever you'd like. Optionally add a description and tags, and then click "Create role".
10. Once the role has been created, record the role ARN as you'll need to update `constants.ts` to use it.

#### API Gateway CloudWatch Role

When `ENABLE_ACCESS_LOGGING` is set to `true`, [API Gateway uses a single role account-wide](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-logging.html#set-up-access-logging-permissions) for interacting with CloudWatch. If you would like to provide that role to {{ $params.APPLICATION_NAME }}, you can set the `APIGATEWAY_CLOUDWATCH_ROLE_ARN` property in `constants.ts`. Otherwise, the role will be automatically created during deployment. To create the API Gateway CloudWatch role manually, you can follow these steps:

1. Log in to your AWS account and go to the Roles section of the IAM Service in the AWS Console.
2. Click the "Create role" button and then click the "Custom trust policy" card under "Trusted entity type".
3. Copy and paste the following content into the "Custom trust policy" text area:

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "apigateway.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

4. Click the next button and then select the checkbox next to the AWS managed policy `AmazonAPIGatewayPushToCloudWatchLogs`.
5. After selecting the managed policy, click next and enter a name for the role. You can name the role whatever you'd like. Optionally add a description and tags, and then click "Create role".
6. Once the role has been created, record the role ARN and update the `APIGATEWAY_CLOUDWATCH_ROLE_ARN` property in `constants.ts` to use the ARN of the newly created role.

### Deployment Parameters

Use the MLSpace Config Wizard by running `npm run config` and select "Advanced Configuration" for an interactive prompt which will set configuration values on your behalf in a generated `/lib/config.json` file. Alternatively, update the values in `/lib/constants.ts` based on your specific deployment needs. Some of these will directly impact whether new resources are created within your account or whether existing resources (VPC, KMS, Roles, etc.) will be leveraged.

| Variable   |      Description      |  Default |
|----------|:-------------|------:|
| `AWS_ACCOUNT` | The account number that {{ $params.APPLICATION_NAME }} is being deployed into. Used to disambiguate S3 buckets within a region | - |
| `AWS_REGION` | The region that {{ $params.APPLICATION_NAME }} is being deployed into. This is only needed when you are using an existing VPC or KMS key and `EXISTING_KMS_MASTER_KEY_ARN` or `EXISTING_VPC_ID` is set | - |
| `IDP_ENDPOINT_SSM_PARAM` | If set, {{ $params.APPLICATION_NAME }} will use the value of this parameter as the `OIDC_URL`. During deployment, the value of this parameter will be read from SSM. This value takes precedence over `OIDC_URL` if both are set | - |
| `OIDC_URL` | The OIDC endpoint that will be used for {{ $params.APPLICATION_NAME }} authentication | - |
| `OIDC_CLIENT_NAME` | The OIDC client name that should be used by {{ $params.APPLICATION_NAME }} for authentication | `web-client` |
| `OIDC_REDIRECT_URL` | The redirect URL that should be used after successfully authenticating with the OIDC provider. This will default to the API gateway URL generated by the CDK deployment but can be manually set if you're using custom DNS | `undefined` |
| `OIDC_VERIFY_SSL` | Whether or not calls to the OIDC endpoint specified in the `OIDC_URL` environment variable should validate the server certificate | `True` |
| `OIDC_VERIFY_SIGNATURE` | Whether or not the lambda authorizer should verify the JWT token signature | `True` |
| `ADDITIONAL_LAMBDA_ENVIRONMENT_VARS` | A map of key-value pairs which will be set as environment variables on every {{ $params.APPLICATION_NAME }} lambda | `{}` |
| `SYSTEM_BANNER_TEXT` | The text to display on the system banner displayed at the top and bottom of the {{ $params.APPLICATION_NAME }} web application. If set to a blank string, no banner will be displayed | `` |
| `SYSTEM_BANNER_BACKGROUND_COLOR` | The background color of the system banner if enabled. Supports valid CSS colors including predefined color names, hex values, and RGB values | `black` |
| `SYSTEM_BANNER_TEXT_COLOR` | The color of the text displayed in the system banner if enabled. Supports valid CSS colors including predefined color names, hex values, and RGB values | `white` |
| `RESOURCE_TERMINATION_INTERVAL` | Interval (in minutes) to run the resource termination cleanup lambda | `60` |
| `DATASETS_TABLE_NAME` | DynamoDB table to hold dataset-related metadata | `mlspace-datasets` |
| `PROJECTS_TABLE_NAME` | DynamoDB table to hold project-related metadata | `mlspace-projects` |
| `PROJECT_USERS_TABLE_NAME` | DynamoDB table to hold project membership-related metadata. Including permissions and project/user-specific IAM role data | `mlspace-project-users` |
| `USERS_TABLE_NAME` | DynamoDB table to hold user-related metadata | `mlspace-users` |
| `APP_CONFIGURATION_TABLE_NAME` | DynamoDB table to hold dynamic configuration settings. These are settings that can be modified after the app has been deployed | `mlspace-app-configuration` |
| `CONFIG_BUCKET_NAME` | S3 bucket used to store {{ $params.APPLICATION_NAME }} configuration files (notebook lifecycle configs, notebook params, etc.) | `mlspace-config` |
| `DATA_BUCKET_NAME` | S3 bucket used to store user uploaded dataset files | `mlspace-datasets` |
| `LOGS_BUCKET_NAME` | S3 bucket used to store logs from EMR clusters launched in {{ $params.APPLICATION_NAME }} and, if configured, {{ $params.APPLICATION_NAME }} cloudtrail events | `mlspace-logs` |
| `ACCESS_LOGS_BUCKET_NAME` | S3 bucket which will store access logs if `ENABLE_ACCESS_LOGGING` is `true` | `mlspace-access-logs` |
| `WEBSITE_BUCKET_NAME` | S3 bucket used to store the static {{ $params.APPLICATION_NAME }} website | `mlspace-website` |
| `MLSPACE_LIFECYCLE_CONFIG_NAME` | Name of the default lifecycle config that should be used with {{ $params.APPLICATION_NAME }} notebooks (will be generated as part of the CDK deployment) | `mlspace-notebook-lifecycle-config` |
| `NOTEBOOK_PARAMETERS_FILE_NAME` | Filename of the default notebook parameters that is generated

 as part of the CDK deployment | `mlspace-website` |
| `PERMISSIONS_BOUNDARY_POLICY_NAME` | Name of the managed policy used as a permissions boundary for dynamically created {{ $params.APPLICATION_NAME }} roles | `mlspace-project-user-permission-boundary` |
| `KEY_MANAGER_ROLE_NAME` | Name of the IAM role with permissions to manage the KMS Key. If this property is set, you _do not_ need to set `EXISTING_KMS_MASTER_KEY_ARN`. | - |
| `EXISTING_KMS_MASTER_KEY_ARN` | ARN of existing KMS key to use with {{ $params.APPLICATION_NAME }}. This key should allow the roles associated with the `NOTEBOOK_ROLE_ARN`, `APP_ROLE_ARN`, `SYSTEM_ROLE_ARN`, `ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN`, and `JOB_INSTANCE_CONSTRAINT_POLICY_ARN` usage of the key. This value takes precedence over `KEY_MANAGER_ROLE_NAME` if both are set. If this property is set, you _do not_ need to set `KEY_MANAGER_ROLE_NAME` |
| `SYSTEM_TAG` | Tag which will be applied to all {{ $params.APPLICATION_NAME }} resources created with the AWS account to which {{ $params.APPLICATION_NAME }} is deployed | `MLSpace` |
| `IAM_RESOURCE_PREFIX` | Value prepended to {{ $params.APPLICATION_NAME }} dynamic roles and policies when `MANAGE_IAM_ROLES` is set to `true` | `MLSpace` |
| `MANAGE_IAM_ROLES` | This setting determines whether or not {{ $params.APPLICATION_NAME }} will dynamically create unique roles per project/user combinations | `true` |
| `EXISTING_VPC_NAME` | If {{ $params.APPLICATION_NAME }} is being deployed into an existing VPC this should be the name of that VPC (must also set `EXISTING_VPC_ID`) | - |
| `EXISTING_VPC_ID` | If {{ $params.APPLICATION_NAME }} is being deployed into an existing VPC this should be the id of that VPC (must also set `EXISTING_VPC_NAME`) | - |
| `EXISTING_VPC_DEFAULT_SECURITY_GROUP` | If {{ $params.APPLICATION_NAME }} is being deployed into an existing VPC this should be the default security group of that VPC | - |
| `APP_ROLE_ARN` | ARN of an existing IAM role to use for executing the {{ $params.APPLICATION_NAME }} lambdas. This value must be set to an existing role because the default CDK deployment will not create one | - |
| `NOTEBOOK_ROLE_ARN` | ARN of an existing IAM role to associate with all notebooks created in {{ $params.APPLICATION_NAME }}. If using dynamic roles based on project/user combinations, the specific combination role will be used instead. This value must be set to an existing role because the default CDK deployment will not create one | - |
| `SYSTEM_ROLE_ARN` | ARN of an existing IAM role to use for executing the {{ $params.APPLICATION_NAME }} system lambdas. System lambdas are responsible for maintaining the {{ $params.APPLICATION_NAME }} system by cleaning up resources when a project is suspended or deleted, when a user is suspended, or when services are activated/deactivated. | - |
| `ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN` | ARN for policy constraining the instance size that can be used when creating Endpoint configurations from a notebook. | - |
| `JOB_INSTANCE_CONSTRAINT_POLICY_ARN` | ARN for policy constraining the instance size that can be used when creating HPO/Training/Transform jobs from a notebook. | - |
| `S3_READER_ROLE_ARN` | ARN of an existing IAM role to use for reading from the static website S3 bucket. If not specified, a new role with the correct privileges will be created | - |
| `EMR_DEFAULT_ROLE_ARN` | Role that will be used as the "ServiceRole" for all EMR clusters | - |
| `EMR_EC2_INSTANCE_ROLE_ARN` | Role that will be used as the "JobFlowRole" and "AutoScalingRole" for all EMR clusters | - |
| `ENABLE_ACCESS_LOGGING` | Whether or not to enable access logging for S3 and APIGW in {{ $params.APPLICATION_NAME }} | `true` |
| `APIGATEWAY_CLOUDWATCH_ROLE_ARN` | If API Gateway access logging is enabled (`ENABLE_ACCESS_LOGGING` is true) then this is the ARN of the role that will be used to push those access logs | - |
| `CREATE_MLSPACE_CLOUDTRAIL_TRAIL` | Whether or not to create an {{ $params.APPLICATION_NAME }} trail within the account | `true` |
| `NEW_USERS_SUSPENDED` | Whether or not new user accounts will be created in a suspended state by default | `true` |
| `ENABLE_TRANSLATE` | Whether or not translate capabilities will be deployed/enabled in {{ $params.APPLICATION_NAME }}. If translate is not available in the region you are deploying to you should set this to `false` | `true` |
| `LAMBDA_RUNTIME` | The lambda runtime to use for {{ $params.APPLICATION_NAME }} lambda functions and layers. This needs to be a python runtime available in the region in which {{ $params.APPLICATION_NAME }} is being deployed | Python 3.11 |
| `LAMBDA_ARCHITECTURE` | The architecture on which to deploy the {{ $params.APPLICATION_NAME }} lambda functions. All lambda layers will also need to be built for the selected architecture. You can do this by ensuring you run the `cdk deploy` command from a machine with the same architecture you're targeting | x86 |

### Production Web App

In addition to updating the necessary parameters in the CDK constants file, you will also need to create a production build of the web application. You can do this by changing to the web application directory (`MLSpace/frontend/`) and running:

```bash
npm run clean && npm install
```

This will generate a production-optimized build of the web application and place the required artifacts in the `build/` directory.

There are no web application specific configuration parameters that need to be set as the configuration will be dynamically generated as part of the CDK deployment based on the variables set there.

## Deploying the CDK Application

Enusre that the required role ARNs (`APP_ROLE_ARN`, `NOTEBOOK_ROLE_ARN`, `SYSTSTEM_ROLE_ARN`, `ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN`, `JOB_INSTANCE_CONSTRAINT_POLICY_ARN`), role names (`KEY_MANAGER_ROLE_NAME` if `EXISTING_KMS_MASTER_KEY_ARN` is not set), and `AWS_ACCOUNT` (used to ensure unique S3 bucket names) have been properly set in `lib/constants.ts`.



The {{ $params.APPLICATION_NAME }} application is a standard CDK application and can be deployed just as any CDK application is deployed. From the `MLSpace/deployment/` directory, you can run the following:

```bash
npm install && cdk bootstrap <REPLACE WITH YOUR ACCOUNT NUMBER>/<REPLACE WITH TARGET REGION>
```

Once the account has been bootstrapped, you can deploy the application. (Optionally include `--require-approval never` in the below command if you don't want to confirm changes):

```bash
cdk deploy --all
```
