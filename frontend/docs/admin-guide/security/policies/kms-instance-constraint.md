# KMS Instance Constraint Policy

---

This KMS policy enforces the use of a KMS key for SageMaker resources that utilize instance types supporting EBS volume encryption. Conversely, it allows SageMaker resources that provide their own volume encryption keys to operate without requiring a KMS key. This policy ensures appropriate encryption practices are maintained across different SageMaker resource configurations.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region. It is broken down statement by statement for clarity. For standard installations the KMS Instance Constraint Policy is automatically managed by MLSpace and doesn't need to be manually created.

---

## Statement 1

This statement defines a set of SageMaker actions that are subject to specific conditions. The policy enforces the use of KMS keys for EBS volume encryption when supported by the instance type.

The conditions in this statement serve two primary purposes:
1. They ensure that a KMS key is specified for volume encryption when applicable.
2. They allow for exceptions when using instance types that do not support EBS volume encryption.

By implementing these constraints, the policy maintains a high standard of security across MLSpace, ensuring appropriate encryption practices are followed for different SageMaker resource configurations.

```json:line-numbers
    {
        "Action": [
            "sagemaker:CreateEndpointConfig",
            "sagemaker:CreateHyperParameterTuningJob",
            "sagemaker:CreateNotebookInstance",
            "sagemaker:CreateTrainingJob",
            "sagemaker:CreateTransformJob"
        ],
        "Resource": "*",
        "Effect": "Deny",
        "Condition": {
            "Null": {
                "sagemaker:VolumeKmsKey": "true"
            },
            "ForAllValues:StringNotLike": {
                "sagemaker:InstanceTypes": [
                    "m5.*",
                    // ...
                ]
            }
        }
    }
```

## Full Policy

<<< ./kms-instance-constraint-raw.json
