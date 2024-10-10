# Project User Permission Boundary Policy

---

The project user permission boundary policy defines the maximum set of permissions a user can possess within an MLSpace project. When secure user-specific roles are enabled, this boundary is further restricted, allowing users access only to resources authorized by their assigned Project and Group permissions. This granular approach ensures a robust and tailored security model for each user within the MLSpace ecosystem.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region. It is broken down statement by statement for clarity. If you intend to use these statements or the full policy at the end of the page, please ensure that you adjust the partition, region, account ID, and resource names to match your specific installation. This example is intended for informational purposes only and should not be implemented without proper customization.

---

## Statement 1

These actions authorize users to manage Global, Group, Private, and Project datasets stored within the application's designated S3 bucket. This comprehensive access enables efficient data handling across various levels of organizational hierarchy, facilitating seamless collaboration and resource utilization within the platform.

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

These permissions grant the designated role the capability to manage Amazon S3 objects within a specified prefix, which is reserved for future utilization. This approach ensures appropriate access control and facilitates the efficient organization of project resources.

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

These permissions enable users to view and enumerate the contents within the Global, Group, Private, and Project datasets stored in the application's designated S3 bucket. Users can access and list items across these various dataset categories, facilitating efficient data management and retrieval within the application's storage infrastructure.

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

This set of permissions allows users to retrieve the location information for the S3 bucket containing the application's dataset.

```json:line-numbers
    {
      "Action": "s3:GetBucketLocation",
      "Resource": "arn:*:s3:::mlspace-data-012345678910",
      "Effect": "Allow"
    }
```

### Statement 5

These actions enable the assignment of MLSpace-prefixed roles to Amazon SageMaker and Amazon Translate services when initiating and executing jobs. This capability ensures proper role-based access control and permissions management within the MLSpace environment for these AWS services.

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

These permissions allow AWSResources to utilize the KMS key that MLSpace either generates or receives during deployment.

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

These actions provide the necessary permissions to interact with networking and Key Management Service (KMS) resources within MLSpace, which are essential for executing various Amazon SageMaker jobs.

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

This set of actions enables the addition of SageMaker tags, aligning with our best security practices. These tags allow us to identify which users are initiating resources or executing jobs, thereby enhancing our tracking and accountability measures.

```json:line-numbers
    {
      "Action": "sagemaker:AddTags",
      "Resource": "arn:*:sagemaker:*:012345678910:*",
      "Effect": "Allow"
    }
```

### Statement 9

This set of permissions enables users to perform specific operations within Amazon CloudWatch, Amazon Comprehend, Amazon EC2, AWS Identity and Access Management (IAM), Amazon SageMaker, and Amazon Translate services.

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

The specified actions authorize users to create Amazon SageMaker Endpoints, provided that the request includes the mandatory User, System, and Project tags. This tagging requirement ensures proper resource management, auditing, and access control.

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

This set of permissions allows authorized users to create Amazon SageMaker Endpoint configurations.

```json:line-numbers
    {
      "Action": "sagemaker:CreateEndpoint",
      "Resource": "arn:*:sagemaker:*:012345678910:endpoint-config/*",
      "Effect": "Allow"
    }
```

### Statement 12

These permissions authorize users to create Amazon SageMaker Models, provided that the request includes the following required elements: SageMaker VPC information, user tags, system tags, and project tags. This tagging requirement ensures proper resource management, auditing, and access control.

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

These actions authorize users to initiate labeling jobs, contingent upon the inclusion of User, System, and Project tags within the request. This tagging requirement ensures proper resource management, auditing, and access control.

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

These actions grant users the authority to delete, describe, invoke, stop, and update Amazon SageMaker resources. However, this access is contingent upon the inclusion of User, System, and Project tags in the request. This tagging requirement ensures proper resource management, auditing, and access control.

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

These actions authorize users to read and list the contents of Amazon S3 buckets specifically for MLSpace configuration files, MLSpace read-only files, and Amazon SageMaker sample files. This access enables users to retrieve essential configuration data, view read-only resources, and access sample files provided by SageMaker, facilitating efficient use of the MLSpace environment and SageMaker services.

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

This set of permissions allows users to view and list the contents of the global read-only data stored in the MLSpace data bucket.

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

These actions provide the capability to assign MLSpace-prefixed roles to Translate when executing and managing jobs.

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

These actions authorize users to create Amazon SageMaker Endpoint Configurations, contingent upon the inclusion of User, System, and Project tags in the request.  This tagging requirement ensures proper resource management, auditing, and access control.

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

These actions authorize users to initiate Hyperparameter Optimization (HPO) and Training jobs in Amazon SageMaker, subject to specific conditions. The request must include SageMaker VPC information, as well as User, System, and Project tags. This tagging requirement ensures proper resource management, auditing, and access control.

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

These actions authorize users to create Transform jobs in Amazon SageMaker, subject to a specific condition. The request must include User, System, and Project tags. This requirement ensures proper resource attribution, facilitates effective management, and maintains compliance with organizational tagging policies. This tagging requirement ensures proper resource management, auditing, and access control.

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