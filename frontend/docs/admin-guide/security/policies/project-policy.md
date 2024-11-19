# Project Policy

---

Project policies provide access to specific S3 path prefixes designated for Project scoped Datasets and enforced that resources are tagged appropriate for assured attribution.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region for a Project called `Project001`. It is broken down statement by statement for clarity. For standard installations Project policies are automatically managed by MLSpace and don't need to be manually created.

---

## Statement 1

These actions grant a role the ability to manage S3 objects within a specific prefix designated for Project-owned Datasets. This ensures proper access control and organization of project resources.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": [
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:PutObject",
            "s3:PutObjectTagging"
        ],
        "Resource": "arn:aws:s3:::mlspace-data-012345678910/project/Project001/*"
    },
```

## Statement 2

This action grants a role the ability to create a SageMaker Endpoint, with the condition that it must be tagged with the appropriate Project name. This ensures proper resource attribution and management within the project scope.

```json:line-numbers
    {
        "Effect": "Deny",
        "Action": [
            "sagemaker:CreateEndpoint"
        ],
        "Resource": "arn:aws:sagemaker:*:*:endpoint/*",
        "Condition": {
            "StringNotEqualsIgnoreCase": {
                "aws:RequestTag/project": "Project001"
            }
        }
    },
```

## Statement 3

This action grants a role the ability to create a SageMaker Endpoint Configuration, with the condition that it must be tagged with the appropriate Project name. This ensures proper resource attribution and management within the project scope.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": [
            "sagemaker:CreateEndpoint"
        ],
        "Resource": "arn:aws:sagemaker:*:*:endpoint-config/*"
    },
```

## Statement 4

These actions grants a role the ability to create the specified SageMaker and Bedrock resources, with the condition that they must be tagged with the appropriate Project name. This ensures proper resource attribution and management within the project scope.

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
            "bedrock:Start*",
            "bedrock:Update*",  
            "bedrock:Apply*",
            "bedrock:Detect*",
            "bedrock:List*",
            "bedrock:Get*",
            "bedrock:Invoke*",
            "bedrock:Retrieve*"
        ],
        "Resource": "*",
        "Condition": {
            "StringNotEqualsIgnoreCase": {
                "aws:RequestTag/project": "Project001",
                "aws:ResourceTag/project": "Project001v20241002"
            }
        }
    },
```

## Statement 5

This action grants a role the ability to list S3 objects within a specific prefix designated for a Project. This ensures proper access control and organization of project resources.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": "s3:ListBucket",
        "Resource": "arn:aws:s3:::mlspace-data-012345678910",
        "Condition": {
            "StringLike": {
                "s3:prefix": "project/Project001/*"
            }
        }
    }
```

## Full Policy

<<< ./project-policy-raw.json
