# Notebook Policy

---

The Notebook Policy outlines the necessary permissions and access controls required for securely utilizing Amazon SageMaker services within a notebook environment, ensuring a seamless and governed experience for data scientists and developers.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region. It is broken down statement by statement for clarity. For standard installations the Notebook policy is automatically managed by MLSpace and don't need to be manually created.

---

## Statement 1

This statement enables secure access to a customer master key (CMK) without exposing the key itself, facilitating the use of EBS volume encryption by EMR clusters.

```json:line-numbers
    {
        "Condition": {
            "Bool": {
                "kms:GrantIsForAWSResource": "true"
            }
        },
        "Action": "kms:CreateGrant",
        "Resource": "arn:aws:kms:us-east-1:012345678910:key/80b28a33-4686-4d87-9dda-4a87e889875a",
        "Effect": "Allow"
    },
```

## Statement 2

These actions provide the necessary permissions for managing training, hyperparameter optimization, and transform jobs.

```json:line-numbers
    {
        "Action": [
            "ec2:CreateNetworkInterface",
            "ec2:CreateNetworkInterfacePermission",
            "ec2:DeleteNetworkInterface",
            "ec2:DeleteNetworkInterfacePermission",
            "kms:Decrypt",
            "kms:DescribeKey",
            "kms:Encrypt",
            "kms:GenerateDataKey"
        ],
        "Resource": [
            "arn:aws:kms:us-east-1:012345678910:key/80b28a33-4686-4d87-9dda-4a87e889875a",
            "arn:aws:ec2:us-east-1:012345678910:network-interface/*",
            "arn:aws:ec2:us-east-1:012345678910:security-group/sg-0c001c111cbcdcdf6",
            "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-0f9f0555e69d3d687",
            "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-06cbb3ec6591a31ad",
            "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-0c0e994c58823e1c3"
        ],
        "Effect": "Allow"
    },
```

## Statement 3

This statement grants the necessary permissions for tagging SageMaker resources, enabling data scientists and developers to categorize and manage their resources effectively.

```json:line-numbers
    {
        "Action": "sagemaker:AddTags",
        "Resource": "arn:aws:sagemaker:us-east-1:012345678910:*",
        "Effect": "Allow"
    },
```

## Statement 4

This statement authorizes the Notebook to perform various read operations on multiple services, including Amazon S3, Amazon CloudWatch, and Amazon SageMaker, as well as write metric data to CloudWatch. This enables data scientists and developers to access and analyze their data effectively.

> [!TIP]
> See in-line comments for an explanation of the permissions this statement provides.

```json:line-numbers

    // General Permissions - Read Only + Metric Write permissions
    {
        "Action": [
            /**
            *
            */
            "comprehend:BatchDetect*",
            "comprehend:Detect*",

            /**
            * EC2 describe actions that are not bound by resource identifier.
            */
            "ec2:DescribeDhcpOptions",
            "ec2:DescribeNetworkInterfaces",
            "ec2:DescribeSecurityGroups",
            "ec2:DescribeSubnets",
            "ec2:DescribeVpcs",

            /*
            * Permissions not bound to specific resources. Log groups and metrics are created as
            * part of various SageMaker resources that can be launched by users (training jobs,
            * endpoints, etc). The iam:GetRole permission is used to allow users to get the current
            * role the notebook is executing under so that they can use that role to create
            * SageMaker resources.
            */
            "iam:GetRole",
            "cloudwatch:PutMetricData",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:DescribeLogStreams",
            "logs:PutLogEvents",

            /**
            * SageMaker list actions that are not bound by resource identifier.
            */
            "sagemaker:DescribeWorkteam",
            "sagemaker:ListEndpointConfigs",
            "sagemaker:ListEndpoints",
            "sagemaker:ListHyperParameterTuningJobs",
            "sagemaker:ListLabelingJobs",
            "sagemaker:ListModels",
            "sagemaker:ListTags",
            "sagemaker:ListTrainingJobs",
            "sagemaker:ListTrainingJobsForHyperParameterTuningJob",
            "sagemaker:ListTransformJobs",
            "sagemaker:ListWorkteams",

            /**
            * translate permissions
            */
            "translate:DescribeTextTranslationJob",
            "translate:ListLanguages",
            "translate:ListTerminologies",
            "translate:ListTextTranslationJobs",
            "translate:StartTextTranslationJob",
            "translate:StopTextTranslationJob",
            "translate:TranslateDocument",
            "translate:TranslateText"
        ],
        "Resource": "*",
        "Effect": "Allow"
    },
```

## Statement 5

This statement grants the necessary permissions for creating a SageMaker Endpoint, enabling data scientists and developers to deploy their models effectively.

The statement includes conditions that enforce additional constraints, ensuring adherence to security requirements, networking configurations, and appropriate tagging for assured attribution. These measures help maintain consistent access control and adhere to the principle of least privilege within the MLSpace environment.

```json:line-numbers
    {
        "Condition": {
            "Null": {
                "aws:RequestTag/user": "false",
                "aws:RequestTag/project": "false"
            },
            "StringEqualsIgnoreCase": {
                "aws:RequestTag/system": "MLSpace"
            }
        },
        "Action": "sagemaker:CreateEndpoint",
        "Resource": "arn:aws:sagemaker:us-east-1:012345678910:endpoint/*",
        "Effect": "Allow"
    },

```

## Statement 6

This statement grants the necessary permissions for creating a SageMaker Endpoint Config, enabling data scientists and developers to deploy their models effectively.

The statement includes conditions that enforce additional constraints, ensuring adherence to security requirements, networking configurations, and appropriate tagging for assured attribution. These measures help maintain consistent access control and adhere to the principle of least privilege within the MLSpace environment.

```json:line-numbers
    {
        "Action": "sagemaker:CreateEndpoint",
        "Resource": "arn:aws:sagemaker:us-east-1:012345678910:endpoint-config/*",
        "Effect": "Allow"
    },
```

## Statement 7

This statement grants the necessary permissions for creating a SageMaker Model, enabling data scientists and developers to deploy their machine learning models effectively within the MLSpace environment.

The statement includes conditions that enforce additional constraints, ensuring adherence to security requirements, networking configurations, and appropriate tagging for assured attribution. These measures help maintain consistent access control and adhere to the principle of least privilege within the MLSpace environment.

```json:line-numbers
    {
        "Condition": {
            "Null": {
                "sagemaker:VpcSubnets": "false",
                "aws:RequestTag/user": "false",
                "aws:RequestTag/project": "false",
                "sagemaker:VpcSecurityGroupIds": "false"
            },
            "StringEqualsIgnoreCase": {
                "aws:RequestTag/system": "MLSpace"
            }
        },
        "Action": "sagemaker:CreateModel",
        "Resource": "arn:aws:sagemaker:us-east-1:012345678910:model/*",
        "Effect": "Allow"
    },
```

## Statement 8

This statement grants the necessary permissions for creating a SageMaker Labeling Job.

The statement includes conditions that enforce additional constraints, ensuring adherence to security requirements, networking configurations, and appropriate tagging for assured attribution. These measures help maintain consistent access control and adhere to the principle of least privilege within the MLSpace environment.

```json:line-numbers
    {
        "Condition": {
            "Null": {
                "aws:RequestTag/user": "false",
                "aws:RequestTag/project": "false"
            },
            "StringEqualsIgnoreCase": {
                "aws:RequestTag/system": "MLSpace"
            }
        },
        "Action": "sagemaker:CreateLabelingJob",
        "Resource": "arn:aws:sagemaker:us-east-1:012345678910:labeling-job/*",
        "Effect": "Allow"
    },
```

## Statement 9

This statement grants the necessary permissions for managing SageMaker resources within the MLSpace environment.

The statement includes conditions that restrict access to appropriately tagged resources. A separate user-scoped policy provides additional constraints, ensuring that users can only interact with resources tagged with their username or project name. This layered approach to access control helps maintain the principle of least privilege and enhances overall security within the MLSpace ecosystem.

```json:line-numbers
    {
        "Condition": {
            "Null": {
                "aws:RequestTag/user": "false",
                "aws:RequestTag/project": "false"
            },
            "StringEqualsIgnoreCase": {
                "aws:RequestTag/system": "MLSpace"
            }
        },
        "Action": [
            "sagemaker:DeleteEndpoint",
            "sagemaker:DeleteEndpointConfig",
            "sagemaker:DeleteModel",
            "sagemaker:DescribeEndpoint",
            "sagemaker:DescribeEndpointConfig",
            "sagemaker:DescribeHyperParameterTuningJob",
            "sagemaker:DescribeLabelingJob",
            "sagemaker:DescribeModel",
            "sagemaker:DescribeTrainingJob",
            "sagemaker:DescribeTransformJob",
            "sagemaker:InvokeEndpoint",
            "sagemaker:StopHyperParameterTuningJob",
            "sagemaker:StopLabelingJob",
            "sagemaker:StopTrainingJob",
            "sagemaker:StopTransformJob",
            "sagemaker:UpdateEndpoint",
            "sagemaker:UpdateEndpointWeightsAndCapacities"
        ],
        "Resource": "arn:aws:sagemaker:us-east-1:012345678910:*",
        "Effect": "Allow"
    },
```

## Statement 10

Allow read access to MLSpace config and examples bucket as well as SageMaker public examples bucket.

```json:line-numbers
    {
        "Action": [
            "s3:GetObject",
            "s3:ListBucket"
        ],
        "Resource": [
            "arn:aws:s3:::mlspace-config-012345678910",
            "arn:aws:s3:::mlspace-config-012345678910/*",
            "arn:aws:s3:::mlspace-data-012345678910/global-read-only/*",
            "arn:aws:s3:::sagemaker-sample-files",
            "arn:aws:s3:::sagemaker-sample-files/*"
        ],
        "Effect": "Allow"
    },
```

## Statement 11

This statement permits the listing of contents within the MLSpace example data bucket. This access is essential for users to browse and utilize the provided example datasets effectively within the MLSpace environment.

```json:line-numbers
    {
        "Condition": {
            "StringLike": {
                "s3:prefix": "global-read-only/*"
            }
        },
        "Action": "s3:ListBucket",
        "Resource": "arn:aws:s3:::mlspace-data-012345678910",
        "Effect": "Allow"
    },
```

## Statement 11

```json:line-numbers
    {
        "Condition": {
            "StringEquals": {
                "iam:PassedToService": "translate.amazonaws.com"
            }
        },
        "Action": "iam:PassRole",
        "Resource": "arn:aws:iam::012345678910:role/MLSpace*",
        "Effect": "Allow"
    },
```

## Statement 12

This statement denies the necessary permissions for creating a SageMaker Endpoint Config and Transform Jobs if the resource isn't tagged appropriately. The policy ensures that all Endpoint Configs and Transform Jobs are properly tagged with user, system, and project information, maintaining consistent resource management and adhering to organizational tagging standards within the MLSpace environment.

The statement includes conditions that enforce additional constraints, ensuring adherence to security requirements, networking configurations, and appropriate tagging for assured attribution. These measures help maintain consistent access control and adhere to the principle of least privilege within the MLSpace environment.

```json:line-numbers
    {
        "Condition": {
            "Null": {
                "aws:RequestTag/user": "true",
                "aws:RequestTag/project": "true"
            },
            "StringNotEqualsIgnoreCase": {
                "aws:RequestTag/system": "MLSpace"
            }
        },
        "Action": ["sagemaker:CreateEndpointConfig", "sagemaker:CreateTransformJob"],
        "Resource": "arn:aws:sagemaker:us-east-1:012345678910:*",
        "Effect": "Deny"
    },
```

## Statement 13

This statement denies the necessary permissions for creating a SageMaker Training or Hyperparameter Optimization jobs if the resource isn't tagged appropriately. The policy ensures that all Endpoint Configs are properly tagged with user, system, and project information, maintaining consistent resource management and adhering to organizational tagging standards within the MLSpace environment.

The statement includes conditions that enforce additional constraints, ensuring adherence to security requirements, networking configurations, and appropriate tagging for assured attribution. These measures help maintain consistent access control and adhere to the principle of least privilege within the MLSpace environment.

```json:line-numbers
    // HPO Permissions
    {
        "Condition": {
            "Null": {
                "sagemaker:VpcSubnets": "true",
                "aws:RequestTag/user": "true",
                "aws:RequestTag/project": "true",
                "sagemaker:VpcSecurityGroupIds": "true"
            },
            "StringNotEqualsIgnoreCase": {
                "aws:RequestTag/system": "MLSpace"
            }
        },
        "Action": [
            "sagemaker:CreateHyperParameterTuningJob",
            "sagemaker:CreateTrainingJob"
        ],
        "Resource": [
            "arn:aws:sagemaker:us-east-1:012345678910:hyper-parameter-tuning-job/*",
            "arn:aws:sagemaker:us-east-1:012345678910:training-job/*"
        ],
        "Effect": "Deny"
    },
```

## Statement 14

This statement allows the necessary permissions for interacting with Amazon Bedrock if it is tagged appropriately. The policy ensures that all Bedrock resources are properly tagged with user, system, and project information, maintaining consistent resource management and adhering to organizational tagging standards within the MLSpace environment.

The statement includes conditions that enforce additional constraints, ensuring adherence to security requirements, networking configurations, and appropriate tagging for assured attribution. These measures help maintain consistent access control and adhere to the principle of least privilege within the MLSpace environment.

```json:line-numbers
    // HPO Permissions
    {
        "Condition": {
            "Null": {
                "aws:RequestTag/user": "true",
                "aws:RequestTag/project": "true",
                "aws:ResourceTag/user": "true",
                "aws:ResourceTag/system": "true",
                "aws:ResourceTag/project": "true",
            },
            "StringNotEqualsIgnoreCase": {
                "aws:RequestTag/system": "MLSpace"
            }
        },
        "Action": [
            // mutating
            "bedrock:Associate*",
            "bedrock:Create*",
            "bedrock:BatchDelete*",
            "bedrock:Delete*",
            "bedrock:Put*",
            "bedrock:Retrieve*",
            "bedrock:Start*",
            "bedrock:Update*",
            
            // non-mutating
            "bedrock:Apply*",
            "bedrock:Detect*",
            "bedrock:List*",
            "bedrock:Get*",
            "bedrock:Invoke*",
            "bedrock:Retrieve*",
        ],
        "Resource": "arn:aws:sagemaker:us-east-1:012345678910:*",
        "Effect": "Allow"
    },
```