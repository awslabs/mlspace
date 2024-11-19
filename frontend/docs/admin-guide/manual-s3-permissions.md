# Enabling Access To S3 Buckets

{{ $params.APPLICATION_NAME }} is configured with one data S3 bucket during deployment. If {{ $params.APPLICATION_NAME }} users need to access files stored in other S3 buckets, this can be enabled using the following instructions.

For examples in this documentation, the name of the bucket we will be enabling permissions for is `BucketToBeShared`.

**NOTE**: After following these instructions, {{ $params.APPLICATION_NAME }} users will be able to access the S3 buckets in their notebooks and for job inputs, but {{ $params.APPLICATION_NAME }} will not display these buckets as options in job inputs since these buckets were not created with {{ $params.APPLICATION_NAME }}.

## Enable Access To An S3 Bucket

To make a bucket available in {{ $params.APPLICATION_NAME }}, follow the steps in these sections:

1. [Configure the Bucket's IAM Policy](#bucket-policy-configuration-non-mlspace-account-bucket-only)
2. [Configure the Permissions Boundary](#configure-the-permissions-boundary)
3. [Configure Access Permissions For The S3 Bucket](#controlling-permissions-to-the-s3-bucket)

### Bucket Policy Configuration (External Account Bucket Only)

To allow the {{ $params.APPLICATION_NAME }} account access to an external bucket, the bucket's policy will need to be configured to trust the {{ $params.APPLICATION_NAME }} account.

#### Update Bucket Policy Through AWS Console

To do this through the AWS console:

- Open the AWS console for the account that owns the bucket to be shared.
- Search for 'S3' and go to the S3 service page.
- In the 'Buckets' table on the S3 main page, search for the bucket to be shared.
- Click on the name link for the desired bucket.
- On the bucket's details page, click on the "Permissions" tab.
- Scroll down to the "Bucket policy" section and click "Edit".
- Create a policy that shares the bucket with the {{ $params.APPLICATION_NAME }} account [like the example provided below](#example-bucket-policy).

#### Update Bucket Policy Through AWS CLI

- Assume credentials for the account that owns the bucket.
- Use a `put-bucket-policy` command. For information on the `put-bucket-policy` command, more information can be found in [the Amazon CLI documentation](https://docs.aws.amazon.com/cli/latest/reference/s3api/put-bucket-policy.html).

Example `put-bucket-policy` command (use a policy [like the example provided below](#example-bucket-policy)):

```bash
aws s3api put-bucket-policy --region "us-east-1" --bucket BucketToBeShared --policy file://policy.json

policy.json:
{
  "Statement": [
      {
         "Effect": "Allow",
         ...
      },
      ...
   ]
}
```

#### Example Bucket Policy

Here is an example of a basic bucket policy that will allow the {{ $params.APPLICATION_NAME }} account to access the bucket:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "<MLSpace Account ID>"
            },
            "Action": [
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObject",
                "s3:PutObjectTagging"
            ],
            "Resource": [
                "arn:aws:s3:::BucketToBeShared/*"
            ]
        }
    ]
}
```

**Notes**:
- If the bucket has an existing policy, add the statement object to the existing statements array to avoid interfering with existing permissions.
- Only add the actions users should be able to take for this bucket. If only read access should be available, then only use the `s3:GetObject` action and remove the others.

## Controlling Permissions To The S3 Bucket

Use the instructions below to configure IAM permissions so that the desired users and projects have access to the bucket.

### Configure The Permissions Boundary

{{ $params.APPLICATION_NAME }} is designed to scope down IAM permissions to the minimum required by using a permissions boundary. In order for the IAM permissions to access the bucket not to be scoped down, the permissions boundary will need to be modified.

#### Updating The Permissions Boundary Policy

Follow these steps to update the permissions boundary to allow access to the bucket:

- Open the AWS console for the {{ $params.APPLICATION_NAME }} Account with a role that can modify IAM permissions.
- Search for and go to the IAM service.
- In the side-navigation, click "Policies".
- Search for the name of the permissions boundary policy.
  - This policy is configured during the [{{ $params.APPLICATION_NAME }} install](./install.md#default-app-policy-and-role), and the recommended name is `mlspace-project-user-permission-boundary.`
- Click on the name link for the policy.
- On the Policy page, click on "Edit" in the "Permissions defined in this policy" section.
- Follow the instructions from the [Updating The IAM Policy Permissions section](#updating-the-iam-policy-permissions) for the policy and then resume these instructions.
- At the bottom of the edit page, click "Next".
- On the confirmation page, click the "Save changes" button.

### Examples For Allowing Permissions Configured With Secure User Scoped Roles

#### Make Bucket Available To All New Users

To make the bucket available to all users, modify the code used for secure user scoped policies for all users. This can be found in the backend code in the `ml_space_lambda/utils/iam_manager.py` file.

Go to where `self.user_policy` is defined and find the section where S3 permissions are added.

Follow the instructions from the [Updating The IAM Policy Permissions section](#updating-the-iam-policy-permissions) for the `self.user_policy`.

Finally, for these changes to take effect, the application will need to be redeployed to the {{ $params.APPLICATION_NAME }} account.

All {{ $params.APPLICATION_NAME }} user accounts created from now on will have the updated permissions.

#### Limiting Access To the Bucket For Certain Projects

If access to the bucket should be scoped to only specific projects, those projects' policies should be modified.

- Open the AWS console for the {{ $params.APPLICATION_NAME }} Account with a role that can modify IAM permissions.
- Search for and go to the IAM service.
- In the side-navigation, click "Policies".
- Search for the name of the project that should have access to the bucket.
  - In the results, identify the policy with a name like `MLSpace-project-<ProjectName>.`
- Click on the name link for the policy.
- On the Policy page, click on "Edit" in the "Permissions defined in this policy" section.
- Follow the instructions from the [Updating The IAM Policy Permissions section](#updating-the-iam-policy-permissions) for the policy and then resume these instructions.
- At the bottom of the edit page, click "Next".
- On the confirmation page, click the "Save changes" button.

After completing this step, all users for the project will now have the assigned permission access to the bucket.

This can be applied to all projects that need access to the bucket.

#### Limiting Access To the Bucket For Certain Users

If access to a bucket should be limited to certain users, user-specific policy updates can be performed.

**NOTE**: For a large number of users, it is recommended to create a separate project and add project permissions instead of adding permissions directly to the user. It is only recommended to do this when it applies to a small number of users.

- Open the AWS console for the {{ $params.APPLICATION_NAME }} Account with a role that can modify IAM permissions.
- Search for and go to the IAM service.
- In the side-navigation, click "Policies".
- Search for the name of the user that should have access to the bucket.
  - In the results, identify the policy with a name like `MLSpace-user-<UserName>.`
- Click on the name link for the policy.
- On the Policy page, click on "Edit" in the "Permissions defined in this policy" section.
- Follow the instructions from the [Updating The IAM Policy Permissions section](#updating-the-iam-policy-permissions) for the policy and then resume these instructions.
- At the bottom of the edit page, click "Next".
- On the confirmation page, click the "Save changes" button.

After this step is completed, the designated user will now have the assigned permission access to the bucket on all of their projects.

This can be applied to all users that need access to the bucket.

### Examples For Allowing Permissions Configured With Secure User Scoped Roles

Permissions for this {{ $params.APPLICATION_NAME }} configuration are controlled by the notebook and application policy configured in the [installation of {{ $params.APPLICATION_NAME }}](./install.md#default-app-policy-and-role).

The two policies that control permissions for {{ $params.APPLICATION_NAME }} users are:
- The Notebook policy
  - This policy governs permissions for users within notebooks.
- The Application policy
  - This policy governs permissions for users in all other forms and services.

Identify which policy the updated permissions should be added to and what the name of that policy is.

Perform the following instructions for the desired policy:

- Open the AWS console for the {{ $params.APPLICATION_NAME }} Account with a role that can modify IAM permissions.
- Search for and go to the IAM service.
- In the side-navigation, click "Policies".
- Search for the name of the user that should have access to the bucket.
  - In the results, identify the policy with a name like `MLSpace-user-<UserName>.`
- Click on the name link for the policy.
- On the Policy page, click on "Edit" in the "Permissions defined in this policy" section.
- Follow the instructions from the [Updating The IAM Policy Permissions section](#updating-the-iam-policy-permissions) for the policy and then resume these instructions.
- At the bottom of the edit page, click "Next".
- On the confirmation page, click the "Save changes" button.

Once the permissions have been updated, they should immediately take effect for the services that policy applies to.

## Updating The IAM Policy Permissions

Once the policy to be updated has been identified, it should look similar to this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    ...
    {
        "Effect": "Allow",
        "Action": [
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:PutObject",
            "s3:PutObjectTagging"
        ],
        "Resource": [
            "arn:aws:s3:::mlspace-data-<AccountId>/private/$USER_NAME/*",
            "arn:aws:s3:::mlspace-data-<AccountId>/global/*"
        ]
    }
    ...
  ]
}
```

Create a separate statement with only the desired action permissions for the bucket, like in the example below.

For example, for read-only permissions, only `s3:GetObject` will be required in the "Actions" section.

```json
{
    "Effect": "Allow",
    "Action": [
        <Desired action permissions>
    ],
    "Resource": [
        "arn:aws:s3:::BucketToBeShared/*"
    ]
}
```

## Testing That The Changes Worked

To verify that access to the bucket is working as expected, open a notebook that is owned by the project or user to which access permissions were added.

Run the following code block:

```python
import boto3

s3 = boto3.client("s3")
s3.list_objects(Bucket="BucketToBeShared")
```

If the code block runs without an error, then the {{ $params.APPLICATION_NAME }} user/project has been successfully given permissions for the bucket.