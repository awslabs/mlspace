# System Policy

---

The System policy is essentially identical to the [Application Policy](./app-policy.md). It is used by the System Role to behave like an Application Role that is unconstrained by services having been disabled in the application configuration settings. This allows background tasks such as cleaning up existing EMR clusters even when EMR functionality has been disabled.

> [!IMPORTANT]
> The policy example provided below is based on a default installation in the US East 1 region. It is broken down statement by statement for clarity. If you intend to use these statements or the full policy at the end of the page, please ensure that you adjust the partition, region, account ID, and resource names to match your specific installation. This example is intended for informational purposes only and should not be implemented without proper customization.

---

## Statement 1

**Requirement Reason (Guess):** AWS EMR (Elastic MapReduce) requires the kms:RetireGrant permission to manage encryption keys for its clusters.

> [!WARNING]
> Determine if this permission is still necessary.

```json:line-numbers
    {
        "Action": "kms:RetireGrant",
        "Resource": "arn:aws:kms:us-east-1:012345678910:key/80b28a33-4686-4d87-9dda-4a87e889875a",
        "Effect": "Allow"
    },
```
## Statement 2

These actions grant the Application role various essential read-only permissions for required resources. These permissions ensure the role can access and retrieve necessary information without modification capabilities, maintaining the principle of least privilege while enabling required functionality.

> [!TIP]
> See in-line comments for an explanation of the permissions this statement provides.

```json:line-numbers
    {
        "Action": [
            /**
            * EC2 permissions required to list available instance types for various
            * resources including endpoints, notebooks, and training jobs
            */
            "ec2:DescribeInstanceTypeOfferings",
            "ec2:DescribeInstanceTypes",

            /**
            * Notebook Permissions
            * Additional EC2 permission needed for managing SageMaker Notebook
            * Instances (starting, stopping, deleting). For more information, refer to
            * the StartNotebookInstance section in the AWS documentation:
            * https://docs.aws.amazon.com/sagemaker/latest/dg/api-permissions-reference.html
            */
            "ec2:DescribeVpcEndpoints",

            /**
            * EMR-specific EC2 permissions
            */
            "ec2:DescribeInstances",
            "ec2:DescribeRouteTables",

            /**
            * EMR Permissions
            * Policy actions necessary for the creation, termination, and management
            * of EMR clusters within the MLSpace environment
            */
            "elasticmapreduce:ListClusters",
            "elasticmapreduce:ListReleaseLabels",
            "elasticmapreduce:RunJobFlow",

            /**
            * General Permissions - IAM Permissions for Secure User Scoped Roles
            * The following actions are essential when implementing managed IAM roles
            */
            "iam:GetPolicy",
            "iam:GetRole",
            "iam:ListAttachedRolePolicies",
            "iam:ListEntitiesForPolicy",
            "iam:ListPolicyVersions",
            "iam:ListRoleTags",
            "iam:ListRoles",

            /**
            * Logging Permissions
            * Required to retrieve and display logs for SageMaker resources,
            * EMR clusters, and other entities through the logs lambda function
            */
            "logs:FilterLogEvents",

            /**
            * Notebook Permissions - Not restricted by specific identifiers
            */
            "sagemaker:ListNotebookInstanceLifecycleConfigs",
            "sagemaker:ListNotebookInstances"
        ],
        "Resource": "*",
        "Effect": "Allow"
    },
```
## Statement 3

These actions grant the Application role the authority to pass specifically defined roles to various services. This permission allows these services to execute actions on behalf of the Application role, ensuring proper delegation of responsibilities while maintaining security and access control.

```json:line-numbers
        {
            "Action": [
                "iam:ListRoleTags",
                "iam:PassRole"
            ],
            "Resource": [
                "arn:aws:iam::012345678910:role/EMR_DefaultRole",
                "arn:aws:iam::012345678910:role/EMR_EC2_DefaultRole",
                "arn:aws:iam::012345678910:role/mlspace-app-role"
            ],
            "Effect": "Allow"
        },
```

## Statement 4

These actions grant the Application role essential [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) (DDB) permissions for interacting with tables used to track and manage resources created through the MLSpace application. These permissions enable efficient data storage, retrieval, and manipulation within the MLSpace ecosystem.

```json:line-numbers
        {
            "Action": [
                "dynamodb:DeleteItem",
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:UpdateItem"
            ],
            "Resource": "arn:aws:dynamodb:us-east-1:012345678910:table/mlspace-*",
            "Effect": "Allow"
        },
```

## Statement 5

This action provides EMR specific permission to allow communication between Notebook Instances and EMR clusters.

```json:line-numbers
        {
            "Action": "ec2:AuthorizeSecurityGroupIngress",
            "Resource": "arn:aws:ec2:us-east-1:012345678910:security-group/*",
            "Effect": "Allow"
        },
```

## Statement 6

These actions grant the Application role essential permissions for working with Datasets effectively.

```json:line-numbers
        {
            "Action": [
                "s3:DeleteObject",
                "s3:Get*",
                "s3:List*",
                "s3:PutBucketNotification",
                "s3:PutObject",
                "s3:PutObjectTagging"
            ],
            "Resource": "arn:aws:s3:::*",
            "Effect": "Allow"
        },
```

## Statement 7

This action grants the Application role essential permissions for creating SageMaker Notebook Instances.

The statement includes conditions that enforce additional constraints, ensuring adherence to security requirements, networking configurations, and appropriate tagging for assured attribution. These measures help maintain consistent access control and adhere to the principle of least privilege within the MLSpace environment.

```json:line-numbers
        {
            "Condition": {
                "StringEquals": {
                    "sagemaker:DirectInternetAccess": "Disabled",
                    "sagemaker:RootAccess": "Disabled"
                },
                "Null": {
                    "sagemaker:VpcSubnets": "false",
                    "aws:RequestTag/user": "false",
                    "aws:RequestTag/system": "false",
                    "aws:RequestTag/project": "false",
                    "sagemaker:VpcSecurityGroupIds": "false"
                }
            },
            "Action": "sagemaker:CreateNotebookInstance",
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:notebook-instance/*",
            "Effect": "Allow"
        },
```

## Statement 8

These actions grant the Application role essential permissions for managing Notebooks Livecycle Configurations effectively.

```json:line-numbers
        {
            "Action": [
                "sagemaker:CreateNotebookInstanceLifecycleConfig",
                "sagemaker:DeleteNotebookInstanceLifecycleConfig",
                "sagemaker:DescribeNotebookInstanceLifecycleConfig",
                "sagemaker:UpdateNotebookInstanceLifecycleConfig"
            ],
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:notebook-instance-lifecycle-config/*",
            "Effect": "Allow"
        },
```

## Statement 9

These actions grant the Application role essential permissions for managing Notebooks effectively.

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
                "sagemaker:DeleteNotebookInstance",
                "sagemaker:DescribeNotebookInstance",
                "sagemaker:StartNotebookInstance",
                "sagemaker:StopNotebookInstance",
                "sagemaker:UpdateNotebookInstance"
            ],
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:notebook-instance/*",
            "Effect": "Allow"
        },
```


## Statement 10

This action grants the Application role the capability to generate presigned URLs for SageMaker Notebook Instances. This functionality is crucial as it enables users to securely access and interact with their notebooks within the MLSpace environment, ensuring a seamless and controlled user experience.

```json:line-numbers
        {
            "Action": "sagemaker:CreatePresignedNotebookInstanceUrl",
            "Resource": "arn:aws:sagemaker:us-east-1:012345678910:notebook-instance/*",
            "Effect": "Allow"
        },
```

## Statement 11

This action grants the Application role permission to invoke MLSpace Lambda functions. It ensures that the role can execute specific serverless functions integral to the MLSpace application's functionality.

```json:line-numbers
        {
            "Action": "lambda:InvokeFunction",
            "Resource": "arn:aws:lambda:us-east-1:012345678910:function:mls-lambda-*",
            "Effect": "Allow"
        },
```

## Statement 12

These actions grant the Application role essential permissions for managing EMR clusters effectively.

```json:line-numbers
        {
            "Action": [
                "elasticmapreduce:AddTags",
                "elasticmapreduce:DescribeCluster",
                "elasticmapreduce:ListInstances",
                "elasticmapreduce:SetTerminationProtection",
                "elasticmapreduce:TerminateJobFlows"
            ],
            "Resource": "arn:aws:elasticmapreduce:us-east-1:012345678910:cluster/*",
            "Effect": "Allow"
        },
```

## Statement 13

This action grants the Application role the capability to create specifically designated MLSpace-managed roles.

The statement includes a condition that enforces additional constraints, ensuring that all created roles must have the appropriate permission boundary attached. This measure helps maintain consistent access control and adheres to the principle of least privilege within the MLSpace environment.

```json:line-numbers
        {
            "Condition": {
                "StringEquals": {
                    "iam:PermissionsBoundary": "arn:aws:iam::012345678910:policy/mlspace-project-user-permission-boundary"
                },
                "StringEqualsIgnoreCase": {
                    "iam:ResourceTag/system": "MLSpace"
                }
            },
            "Action": "iam:CreateRole",
            "Resource": "arn:aws:iam::012345678910:role/MLSpace*",
            "Effect": "Allow"
        },
```

## Statement 14

These actions enable MLSpace to maintain a minimal set of permissions for all users by providing the capability to manage roles and policies.

A condition statement on this policy imposes additional constraints, ensuring that these actions can only be performed on MLSpace-managed policies. This security measure helps maintain proper access control and resource management within the MLSpace environment while limiting the scope of where these actions are allowed.

```json:line-numbers
        {
            "Condition": {
                "StringEqualsIgnoreCase": {
                    "iam:ResourceTag/system": "MLSpace"
                }
            },
            "Action": [
                "iam:AttachRolePolicy",
                "iam:DeleteRole",
                "iam:DeleteRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PutRolePolicy"
            ],
            "Resource": "arn:aws:iam::012345678910:role/MLSpace*",
            "Effect": "Allow"
        },
```

## Statement 15

These actions enable MLSpace to maintain a minimal set of permissions for all users by attaching the [Service Configuration](./app-denied-services.md) policy to specific roles. This policy explicitly denies access to disabled MLSpace services, as configured in the administrative settings.

The Application role is granted these permissions exclusively for MLSpace-managed roles. This restriction serves as a critical security measure, ensuring proper access control and resource management within the MLSpace environment. By limiting the scope of these actions, the system maintains a robust security posture while allowing necessary operations on designated resources.

```json:line-numbers
        {
            "Condition": {
                "StringEqualsIgnoreCase": {
                    "iam:PolicyARN": "arn:aws:iam::012345678910:policy/MLSpace-app-denied-services",
                    "iam:ResourceTag/system": "MLSpace"
                }
            },
            "Action": [
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy"
            ],
            "Resource": [
                "arn:aws:iam::012345678910:role/MLSpace*",
                "arn:aws:iam::012345678910:role/mlspace-app-role",
                "arn:aws:iam::012345678910:role/mlspace-notebook-role"
            ],
            "Effect": "Allow"
        },
```

## Statement 15

These actions enable MLSpace to maintain a minimal set of permissions for all users by providing the capability to manage and tag policies.

A condition statement on this policy imposes additional constraints, ensuring that these actions can only be performed on MLSpace-managed policies. This security measure helps maintain proper access control and resource management within the MLSpace environment while limiting the scope of where these actions are allowed.

```json:line-numbers
        {
            "Action": [
                "iam:CreatePolicy",
                "iam:CreatePolicyVersion",
                "iam:DeletePolicy",
                "iam:DeletePolicyVersion",
                "iam:TagPolicy"
            ],
            "Resource": "arn:aws:iam::012345678910:policy/MLSpace*",
            "Effect": "Allow"
        },

```

## Statement 16

These actions enable MLSpace to maintain a minimal set of permissions for all users by providing the capability to attach policies to roles and tag those roles accordingly.

The Application role is granted this permission exclusively for MLSpace-managed roles. This restriction serves as a crucial security measure, ensuring proper access control and resource management within the MLSpace environment. By limiting the scope of these actions, the system maintains a robust security posture while allowing necessary operations on designated resources.

```json:line-numbers
        {
            "Action": [
                "iam:AttachRolePolicy",
                "iam:SimulatePrincipalPolicy",
                "iam:TagRole"
            ],
            "Resource": "arn:aws:iam::012345678910:role/MLSpace*",
            "Effect": "Allow"
        },
```


## Statement 16

When creating SageMaker resources (such as Training, Transform, and HPO jobs, as well as Models) through the MLSpace Web Application, the API calls utilize the user-scoped role to make the request. The `iam:PassRole` action is essential for executing these resources under the role associated with the user.

A condition statement on this policy provides additional constraints, ensuring that only MLSpace-managed roles can be passed. This security measure helps maintain proper access control and resource management within the MLSpace environment while limiting the scope of where these actions are allowed.

```json:line-numbers
        {
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": "sagemaker.amazonaws.com"
                }
            },
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::012345678910:role/MLSpace*",
            "Effect": "Allow"
        },
```

## Statement 17

Allows passing the Application role to the Translate service to ensure the Translate service has the necessary permissions to perform tasks on behalf of the Application role.

```json:line-numbers
    {
        "Condition": {
            "StringEquals": {
                "iam:PassedToService": "translate.amazonaws.com"
            }
        },
        "Action": "iam:PassRole",
        "Resource": "arn:aws:iam::012345678910:role/mlspace-app-role",
        "Effect": "Allow"
    }
```

---

## Full Policy

<<< ./system-policy-raw.json