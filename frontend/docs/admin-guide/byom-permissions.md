---
outline: deep
---

# Enabling Access To Custom Algorithms

{{ $params.APPLICATION_NAME }} users can create SageMaker resources using custom algorithm containers. When creating resources (Training jobs, HPO jobs, Batch Transform jobs, and Models), users have the option of selecting a built-in algorithm or specifying the ECR path to a custom container image. If users will be leveraging ECR images in their resources, then the {{ $params.APPLICATION_NAME }} IAM policies must be modified to grant the necessary permissions. These policies can be scoped as necessary for your specific environment and use case. If users will not be developing their own algorithms and merely need access to existing algorithms defined in custom images, then they will not need any of the mutating actions. If users will be developing new algorithms and publishing those containers for use by others, then additional actions will need to be granted. Each of these actions can also be restricted to specific named repositories, or they can be made less restrictive depending on the needs of your organization.

## Read Only Policy

To allow users to leverage custom images in their SageMaker resources, the following policy will need to be added to the {{ $params.APPLICATION_NAME }} App Policy, the {{ $params.APPLICATION_NAME }} Notebook Policy, and the {{ $params.APPLICATION_NAME }} Permission Boundary:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage"
            ],
            "Resource": [
                "arn:{AWS_PARTITION}:ecr:{AWS_REGION}::repository/custom-repo1",
                "arn:{AWS_PARTITION}:ecr:{AWS_REGION}::repository/custom-repo2",
                "arn:{AWS_PARTITION}:ecr:{AWS_REGION}::repository/custom-repo3"
            ]
        }
    ]
}
```

The example above is scoped to specific repositories, which may or may not make sense in your environment. You will also need to substitute the appropriate region and partition if you opt to restrict the actions to specific repositories.

## Write Policy

To allow users to create their own custom images from within their Notebook Instances, some combination of the following policy will need to be added to the {{ $params.APPLICATION_NAME }} Notebook Policy and the {{ $params.APPLICATION_NAME }} Permission Boundary in addition to the Read actions above:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:SetRepositoryPolicy",
                "ecr:CompleteLayerUpload",
                "ecr:BatchDeleteImage",
                "ecr:UploadLayerPart",
                "ecr:DeleteRepositoryPolicy",
                "ecr:InitiateLayerUpload",
                "ecr:DeleteRepository",
                "ecr:PutImage",
                "ecr:CreateRepository"
            ],
            "Resource": "*"
        }
    ]
}
```

The above block should serve as a reference only. Depending on the use case, not all actions will be appropriate in all environments. If users should only be pushing to specific repositories or if they should not have the ability to create new repositories, the related actions can be more tightly scoped or removed from the policy.

## Updating The Permissions Boundary Policy

Follow these steps to update the permissions boundary to allow access to the ECR:
1. Open the AWS console for the {{ $params.APPLICATION_NAME }} Account with a role that can modify IAM permissions.
2. Search for and go to the IAM service.
3. In the side-navigation, click "Policies".
4. Search for the name of the permissions boundary policy.
5. This policy is configured during the [{{ $params.APPLICATION_NAME }} install](./install.md#default-app-policy-and-role), and the recommended name is `mlspace-project-user-permission-boundary.`
6. Click on the name link for the policy.
7. On the Policy page, click "Edit" in the "Permissions defined in this policy" section.
8. Depending on the desired ECR abilities (read only vs. mutating), add the appropriate actions from the above examples to the policy.
9. At the bottom of the edit page, click "Next".
10. On the confirmation page, click the "Save changes" button.