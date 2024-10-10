# Project User Permission Boundary Policy

---

The project user permission boundary policy showcases the maximum permission set a user can have in an MLSpace project. With secure user specific roles enabled this boundary is scoped down even further to only allow users to have access to the resources their Project and Groups enable.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region. It is broken down statement by statement for clarity. If you intend to use these statements or the full policy at the end of the page, please ensure that you adjust the partition, region, account ID, and resource names to match your specific installation. This example is intended for informational purposes only and should not be implemented without proper customization.

---

## Statement 1

These actions grant users to have access to manage Global, Group, Private, and Project datasets that are in the application dataset S3 Bucket.

```json:line-numbers
    {
      "Action": [
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectTagging"
      ],
      "Resource": [
        "arn:*:s3:::mlspace-data-012345678910/global/*",
        "arn:*:s3:::mlspace-data-012345678910/group/*",
        "arn:*:s3:::mlspace-data-012345678910/private/*",
        "arn:*:s3:::mlspace-data-012345678910/project/*"
      ],
      "Effect": "Allow"
    }
```

## Statement 2

These actions grant a role the ability to manage S3 objects within a specific prefix reserved for future use. This ensures proper access control and organization of project resources. 

```json:line-numbers
    {
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectTagging"
      ],
      "Resource": "arn:*:s3:::mlspace-data-012345678910/index/*",
      "Effect": "Allow"
    }
```

## Statement 3

These actions grant users the ability to list the contents in the Global, Group, Private, and Project datasets that are in the application dataset S3 Bucket.

```json:line-numbers
    {
      "Condition": {
        "StringLike": {
          "s3:prefix": [
            "global/*",
            "index/*",
            "private/*",
            "project/*",
            "group/*"
          ]
        }
      },
      "Action": "s3:ListBucket",
      "Resource": "arn:*:s3:::mlspace-data-012345678910",
      "Effect": "Allow"
    }
```

### Statement 4

These actions grant users the ability to get the bucket location for the application dataset s3 bucket.

```json:line-numbers
    {
      "Action": "s3:GetBucketLocation",
      "Resource": "arn:*:s3:::mlspace-data-012345678910",
      "Effect": "Allow"
    }
```

### Statement 5

These actions grant the ability to pass MLSpace prefixed roles to Sagemaker and Translate when executing and running jobs.

```json:line-numbers
    {
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": [
            "sagemaker.amazonaws.com",
            "translate.amazonaws.com"
          ]
        }
      },
      "Action": "iam:PassRole",
      "Resource": "arn:*:iam::012345678910:role/MLSpace*",
      "Effect": "Allow"
    }
```

### Statement 6

These actions grant AWSResources the ability to use the KMS key that MLSpace creates or is provided during deploy time.

```json:line-numbers
    {
      "Condition": {
        "Bool": {
          "kms:GrantIsForAWSResource": "true"
        }
      },
      "Action": "kms:CreateGrant",
      "Resource": "arn:aws:kms:us-east-1:012345678910:key/012345678910",
      "Effect": "Allow"
    }
```

### Statement 7

These actions grant the ability to interact with the networking and KMS resources within MLSpace required for various Sagemaker jobs.

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
        "arn:aws:kms:us-east-1:012345678910:key/012345678910",
        "arn:aws:ec2:us-east-1:012345678910:network-interface/*",
        "arn:aws:ec2:us-east-1:012345678910:security-group/sg-012345678910",
        "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-012345678910",
        "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-012345678910",
        "arn:aws:ec2:us-east-1:012345678910:subnet/subnet-012345678910"
      ],
      "Effect": "Allow"
    }
```

### Statement 8

These actions grant the ability for Sagemaker tags to be added. This follows our best security guidelines so that we know which user is spinning up resources or running jobs.

```json:line-numbers
    {
      "Action": "sagemaker:AddTags",
      "Resource": "arn:*:sagemaker:*:012345678910:*",
      "Effect": "Allow"
    }
```

### Statement 9

These actions grant users the ability to interact with various Cloudwatch, Comprehend, Ec2, IAM, Sagemaker, and Translate operations.

```json:line-numbers
    {
      "Action": [
        "cloudwatch:PutMetricData",
        "comprehend:BatchDetect*",
        "comprehend:Detect*",
        "ec2:DescribeDhcpOptions",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs",
        "iam:GetRole",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents",
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
    }
```

### Statement 10

These actions grant users the ability to create Sagemaker endpoints but only if the User, System, and Project tags are included in the request.

```json:line-numbers
    {
      "Condition": {
        "Null": {
          "aws:RequestTag/user": "false",
          "aws:RequestTag/system": "false",
          "aws:RequestTag/project": "false"
        }
      },
      "Action": "sagemaker:CreateEndpoint",
      "Resource": "arn:*:sagemaker:*:012345678910:endpoint/*",
      "Effect": "Allow"
    }
```

### Statement 11

These actions grant users the ability to create Sagemaker endpoint configurations.

```json:line-numbers
    {
      "Action": "sagemaker:CreateEndpoint",
      "Resource": "arn:*:sagemaker:*:012345678910:endpoint-config/*",
      "Effect": "Allow"
    }
```

### Statement 12

These actions grant users the ability to create Sagemaker models but only if the Sagemaker VPC info, User, System, and Project tags are included in the request.

```json:line-numbers
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
      "Resource": "arn:*:sagemaker:*:012345678910:model/*",
      "Effect": "Allow"
    }
```

### Statement 13

These actions grant users the ability to create labeling jobs but only if the User, System, and Project tags are included in the request.

```json:line-numbers
    {
      "Condition": {
        "Null": {
          "aws:RequestTag/user": "false",
          "aws:RequestTag/system": "false",
          "aws:RequestTag/project": "false"
        }
      },
      "Action": "sagemaker:CreateLabelingJob",
      "Resource": "arn:*:sagemaker:*:012345678910:labeling-job/*",
      "Effect": "Allow"
    }
```

### Statement 14

These actions grant users the ability to delete, describe, invoke, stop, and update Sagemaker resources but only if the User, System, and Project tags are included in the request.

```json:line-numbers
    {
      "Condition": {
        "Null": {
          "aws:ResourceTag/project": "false",
          "aws:ResourceTag/system": "false",
          "aws:ResourceTag/user": "false"
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
      "Resource": "arn:*:sagemaker:*:012345678910:*",
      "Effect": "Allow"
    }
```

### Statement 15

These actions grant users the ability to read and list the s3 contents for MLSpace configuration files, MLSpace Readonly files, and Sagemaker sample files.

```json:line-numbers
    {
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:*:s3:::mlspace-config-012345678910",
        "arn:*:s3:::mlspace-config-012345678910/*",
        "arn:*:s3:::mlspace-data-012345678910/global-read-only/*",
        "arn:*:s3:::sagemaker-sample-files",
        "arn:*:s3:::sagemaker-sample-files/*"
      ],
      "Effect": "Allow"
    }
```

### Statement 16

These actions grant users the ability to list the content of the global read only data in the MLSpace data bucket.

```json:line-numbers
    {
      "Condition": {
        "StringLike": {
          "s3:prefix": "global-read-only/*"
        }
      },
      "Action": "s3:ListBucket",
      "Resource": "arn:*:s3:::mlspace-data-012345678910",
      "Effect": "Allow"
    }
```

### Statement 17

These actions grant the ability to pass MLSpace prefixed roles to Translate when executing and running jobs.

```json:line-numbers
    {
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "translate.amazonaws.com"
        }
      },
      "Action": "iam:PassRole",
      "Resource": "arn:*:iam::012345678910:role/MLSpace*",
      "Effect": "Allow"
    }
```

### Statement 18    

These actions grant users the ability to create Sagemaker endpoint configurations but only if the User, System, and Project tags are included in the request.

```json:line-numbers
    {
      "Condition": {
        "Null": {
          "aws:RequestTag/user": "false",
          "aws:RequestTag/system": "false",
          "aws:RequestTag/project": "false"
        }
      },
      "Action": "sagemaker:CreateEndpointConfig",
      "Resource": "arn:*:sagemaker:*:012345678910:endpoint-config/*",
      "Effect": "Allow"
    }
```

### Statement 19

These actions grant users the ability to create HPO and Training jobs but only if the Sagemaker VPC info, User, System, and Project tags are included in the request.

```json:line-numbers
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
      "Action": [
        "sagemaker:CreateHyperParameterTuningJob",
        "sagemaker:CreateTrainingJob"
      ],
      "Resource": [
        "arn:*:sagemaker:*:012345678910:hyper-parameter-tuning-job/*",
        "arn:*:sagemaker:*:012345678910:training-job/*"
      ],
      "Effect": "Allow"
    }
```

### Statement 20

These actions grant users the ability to create Transform jobs but only if the User, System, and Project tags are included in the request.

```json:line-numbers
    {
      "Condition": {
        "Null": {
          "aws:RequestTag/user": "false",
          "aws:RequestTag/system": "false",
          "aws:RequestTag/project": "false"
        }
      },
      "Action": "sagemaker:CreateTransformJob",
      "Resource": "arn:*:sagemaker:*:012345678910:transform-job/*",
      "Effect": "Allow"
    }
```

## Full Policy

<<< ./project-user-permission-boundary-raw.json