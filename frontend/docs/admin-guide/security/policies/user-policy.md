# User Policy

---

User policies govern access to specific S3 path prefixes tailored to individual users. These policies also enforce appropriate resource tagging, ensuring accurate attribution of resources within the system.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region for a User called `jdoe`. It is broken down statement by statement for clarity. For standard installations User policies are automatically managed by MLSpace and don't need to be manually created.

---

## Statement 1

These actions grant a role the ability to manage S3 objects within a specific prefix designated for User-owned objects. This ensures proper access control and organization of project resources.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": [
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:PutObject",
            "s3:PutObjectTagging"
        ],
        "Resource": [
            "arn:aws:s3:::mlspace-data-012345678910/private/jdoe/*",
            "arn:aws:s3:::mlspace-data-012345678910/global/*"
        ]
    },
```

## Statement 2

These actions grant a role the ability to manage S3 objects within a specific prefix reserved for future use. This ensures proper access control and organization of project resources.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": [
            "s3:GetObject",
            "s3:PutObject",
            "s3:PutObjectTagging"
        ],
        "Resource": "arn:aws:s3:::mlspace-data-012345678910/index/*"
    },
```

## Statement 3

These actions grant a role the ability to list S3 objects within a specific prefix designated for User-owned objects. This ensures proper access control and organization of project resources.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": "s3:ListBucket",
        "Resource": "arn:aws:s3:::mlspace-data-012345678910",
        "Condition": {
            "StringLike": {
                "s3:prefix": [
                    "private/jdoe/*",
                    "global/*",
                    "index/*"
                ]
            }
        }
    },
```

## Statement 4

These actions grant a role the ability to retrieve the location of an S3 bucket.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": "s3:GetBucketLocation",
        "Resource": "arn:aws:s3:::mlspace-data-012345678910"
    },
```

## Statement 5

This action grants a role the ability to create a SageMaker Endpoint, with the condition that it must be tagged with the appropriate User name. This ensures proper resource attribution and management for User resources.

```json:line-numbers
    {
        "Effect": "Deny",
        "Action": [
            "sagemaker:CreateEndpoint"
        ],
        "Resource": "arn:aws:sagemaker:*:*:endpoint/*",
        "Condition": {
            "StringNotEqualsIgnoreCase": {
                "aws:RequestTag/user": "jdoe"
            }
        }
    },
```

## Statement 6

This action grants a role the ability to create a SageMaker Endpoint Conifguration, with the condition that it must be tagged with the appropriate User name. This ensures proper resource attribution and management for User resources.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": [
            "sagemaker:CreateEndpoint"
        ],
        "Resource": "arn:aws:sagemaker:*:*:endpoint-config/*"
    },
```

## Statement 7

These actions grants a role the ability to create the specified SageMaker and Bedrock resources, with the condition that they must be tagged with the appropriate User name. This ensures proper resource attribution and management for User resources.

```json:line-numbers
    {
        "Effect": "Deny",
        "Action": [
            "sagemaker:CreateModel",
            "sagemaker:CreateEndpointConfig",
            "sagemaker:CreateTrainingJob",
            "sagemaker:CreateProcessingJob",
            "sagemaker:CreateHyperParameterTuningJob",
            "sagemaker:CreateTransformJob",
            "sagemaker:DeleteModel",
            "sagemaker:DescribeModel",
            "sagemaker:DeleteEndpoint",
            "sagemaker:DescribeEndpoint",
            "sagemaker:InvokeEndpoint",
            "sagemaker:DeleteEndpointConfig",
            "sageamker:DescribeEndpointConfig",
            "sagemaker:DescribeLabelingJob",
            "sagemaker:StopLabelingJob",
            "sagemaker:DescribeTrainingJob",
            "sagemaker:StopTrainingJob",
            "sagemaker:DescribeProcessingJob",
            "sageamker:StopProcessingJob",
            "sagemaker:DescribeHyperParameterTuningJob",
            "sagemaker:StopHyperParameterTuningJob",
            "sagemaker:DescribeTransformJob",
            "sagemaker:StopTransformJob",
            "sagemaker:UpdateEndpoint",
            "sagemaker:UpdateEndpointWeightsAndCapacities",
            "bedrock:Associate*",
            "bedrock:Create*",
            "bedrock:BatchDelete*",
            "bedrock:Delete*",
            "bedrock:Put*",
            "bedrock:Retrieve*",
            "bedrock:Start*",
            "bedrock:Update*",
            "bedrock:Apply*",
            "bedrock:Detect*",
            "bedrock:List*",
            "bedrock:Get*",
            "bedrock:Invoke*",
            "bedrock:Retrieve*",
        ],
        "Resource": "*",
        "Condition": {
            "StringNotEqualsIgnoreCase": {
                "aws:RequestTag/user": "jdoe",
                "aws:ResourceTag/user": "jdoe"
            }
        }
    }
```

## Full Policy

<<< ./user-policy-raw.json
