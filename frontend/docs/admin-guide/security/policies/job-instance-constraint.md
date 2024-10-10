# Job Instance Constraint Policy

---

The Job Instance Constraint Policy restricts users to creating Training, Hyperparameter Optimization (HPO), and Transform jobs using only approved instance types. This policy ensures that resource allocation aligns with organizational guidelines and helps maintain cost control and performance optimization across MLSpace.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region. It is broken down statement by statement for clarity. For standard installations the Job Instance Constraint Policy is automatically managed by MLSpace and doesn't need to be manually created.

---

## Statement 1

This statement permits the creation of Training and Hyperparameter Tuning Jobs for authorized roles. 

The policy includes specific conditions that enforce additional constraints, ensuring that these job types can only be initiated using administrator-approved instance types. This approach maintains control over resource allocation and usage within the organization.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": [
            "sagemaker:CreateTrainingJob",
            "sagemaker:CreateHyperParameterTuningJob"
        ],
        "Resource": [
            "arn:aws:sagemaker:us-east-1:012345678910:training-job/*",
            "arn:aws:sagemaker:us-east-1:012345678910:hyper-parameter-tuning-job/*"
        ],
        "Condition": {
            "ForAnyValue:StringEquals": {
                "sagemaker:InstanceTypes": [
                    "ml.m4.10xlarge"
                ]
            }
        }
    },
```

## Statement 2

This statement permits the creation of Transform Jobs for authorized roles. 

The policy includes specific conditions that enforce additional constraints, ensuring that these job types can only be initiated using administrator-approved instance types. This approach maintains control over resource allocation and usage within the organization.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": [
            "sagemaker:CreateTransformJob"
        ],
        "Resource": [
            "arn:aws:sagemaker:us-east-1:012345678910:transform-job/*"
        ],
        "Condition": {
            "ForAnyValue:StringEquals": {
                "sagemaker:InstanceTypes": [
                    "ml.m4.xlarge",
                    //...
                ]
            }
        }
    }
```

## Full Policy

<<< ./kms-instance-constraint-raw.json
