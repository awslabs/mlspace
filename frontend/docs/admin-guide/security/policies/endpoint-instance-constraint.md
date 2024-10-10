# Endpoint Instance Constraint Policy

---

The Endpoint Instance Constraint Policy is designed to restrict users to creating SageMaker Endpoints using only approved instance types. This policy ensures that resource allocation aligns with organizational guidelines, promoting cost control and performance optimization across MLSpace.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region. It is presented statement by statement for clarity. In standard installations, the Endpoint Instance Constraint Policy is automatically managed by MLSpace and does not require manual creation.

---

## Statement 1

This statement authorizes the creation of SageMaker Endpoints for approved roles. 

The policy incorporates specific conditions that enforce additional constraints, ensuring that SageMaker Endpoints can only be initiated using instance types approved by administrators. This approach maintains strict control over resource allocation and usage within the organization, aligning with best practices for cloud resource management.

```json:line-numbers
    {
        "Effect": "Allow",
        "Action": [
            "sagemaker:CreateEndpointConfig"
        ],
        "Resource": [
            "arn:aws:sagemaker:us-east-1:012345678910:endpoint-config/*"
        ],
        "Condition": {
            "ForAnyValue:StringEquals": {
                "sagemaker:InstanceTypes": [
                    "ml.t2.medium",
                    // ...
                ]
            }
        }
    }
```

## Full Policy

```json:line-numbers
{
    "Version": "2012-10-17",
    "Statement": [
        // constrains which instance types can be used for endpoints
        {
            "Effect": "Allow",
            "Action": [
                "sagemaker:CreateEndpointConfig"
            ],
            "Resource": [
                "arn:aws:sagemaker:us-east-1:012345678910:endpoint-config/*"
            ],
            "Condition": {
                "ForAnyValue:StringEquals": {
                    "sagemaker:InstanceTypes": [
                        "ml.t2.medium",
                        // ...
                    ]
                }
            }
        }
    ]
}
``` `