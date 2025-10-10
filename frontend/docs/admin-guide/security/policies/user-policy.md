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
            "sagemaker:DescribeEndpointConfig",
            "sagemaker:DescribeLabelingJob",
            "sagemaker:StopLabelingJob",
            "sagemaker:DescribeTrainingJob",
            "sagemaker:StopTrainingJob",
            "sagemaker:DescribeProcessingJob",
            "sagemaker:StopProcessingJob",
            "sagemaker:DescribeHyperParameterTuningJob",
            "sagemaker:StopHyperParameterTuningJob",
            "sagemaker:DescribeTransformJob",
            "sagemaker:StopTransformJob",
            "sagemaker:UpdateEndpoint",
            "sagemaker:UpdateEndpointWeightsAndCapacities"
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

### Statement 8

These actions authorize users to create Bedrock resources, subject to a specific condition. The request must include User tags. This requirement ensures proper resource attribution, facilitates effective management, and maintains compliance with organizational tagging policies. This tagging requirement ensures proper resource management, auditing, and access control.

```json:line-numbers
		{
			"Sid": "DenyBedrockCreateWithoutMLSpaceTag",
			"Effect": "Deny",
			"Action": [
				"bedrock:Create*",
				"bedrock:InvokeDataAutomationAsync",
				"bedrock:PutResourcePolicy",
				"bedrock:InvokeModel"
			],
			"NotResource": [
				"arn:*:bedrock:*:*:data-automation-profile/*",
				"arn:*:bedrock:*:*:bedrock-marketplace-model-endpoint/*",
				"arn:*:bedrock:*:*:flow-execution/*",
				"arn:*:bedrock:*:*:guardrail-profile/*",
				"arn:*:bedrock:*:*:prompt-router/*",
				"arn:*:bedrock:*:*:inference-profile/*",
				"arn:*:bedrock:*:*:default-prompt-router/*",
				"arn:*:bedrock:*::foundation-model/*"
			],
			"Condition": {
				"StringNotEquals": {
					"aws:RequestTag/user": "jdoe"
				}
			}
		}
```

### Statement 9

These actions authorize users to access Bedrock resources, subject to a specific condition. The request must include User tags. This requirement ensures proper resource attribution, facilitates effective management, and maintains compliance with organizational tagging policies. This tagging requirement ensures proper resource management, auditing, and access control.

```json:line-numbers
		{
			"Sid": "DenyBedrockActionsWithoutSystemMLSpaceTag",
			"Effect": "Deny",
			"NotAction": [
				"bedrock:Create*",
				"bedrock:InvokeDataAutomationAsync",
				"bedrock:PutResourcePolicy",
				"bedrock:InvokeModel"
			],
			"Resource": [
				"arn:*:bedrock:*:*:agent-alias/*/*",
				"arn:*:bedrock:*:*:agent/*",
				"arn:*:bedrock:*:*:application-inference-profile/*",
				"arn:*:bedrock:*:*:async-invoke/*",
				"arn:*:bedrock:*:*:automated-reasoning-policy-version/*",
				"arn:*:bedrock:*:*:automated-reasoning-policy/*",
				"arn:*:bedrock:*:*:blueprint/*",
				"arn:*:bedrock:*:*:custom-model-deployment/*",
				"arn:*:bedrock:*:*:custom-model/*",
				"arn:*:bedrock:*:*:data-automation-invocation-job/*",
				"arn:*:bedrock:*:*:data-automation-project/*",
				"arn:*:bedrock:*:*:evaluation-job/*",
				"arn:*:bedrock:*:*:flow-alias/*",
				"arn:*:bedrock:*:*:flow/*",
				"arn:*:bedrock:*:*:guardrail/*",
				"arn:*:bedrock:*:*:imported-model/*",
				"arn:*:bedrock:*:*:knowledge-base/*",
				"arn:*:bedrock:*:*:model-copy-job/*",
				"arn:*:bedrock:*:*:model-customization-job/*",
				"arn:*:bedrock:*:*:model-evaluation-job/*",
				"arn:*:bedrock:*:*:model-import-job/*",
				"arn:*:bedrock:*:*:model-invocation-job/*",
				"arn:*:bedrock:*:*:prompt-version/*",
				"arn:*:bedrock:*:*:prompt/*",
				"arn:*:bedrock:*:*:provisioned-model/*",
				"arn:*:bedrock:*:*:session/*"
			],
			"Condition": {
				"StringNotEquals": {
					"aws:ResourceTag/user": "jdoe"
				}
			}
		}
```

## Full Policy

<<< ./user-policy-raw.json
