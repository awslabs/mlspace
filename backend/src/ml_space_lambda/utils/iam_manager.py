#
#   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
#   Licensed under the Apache License, Version 2.0 (the "License").
#   You may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#

import hashlib
import json
import logging
import os
from typing import List, Optional

import boto3

from ml_space_lambda.enums import IAMResourceType
from ml_space_lambda.utils.common_functions import generate_tags, retry_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables

logger = logging.getLogger(__name__)

IAM_RESOURCE_PREFIX = "MLSpace"
IAM_ROLE_NAME_MAX_LENGTH = 64
IAM_POLICY_NAME_MAX_LENGTH = 128
USER_POLICY_VERSION = 1
PROJECT_POLICY_VERSION = 1


class IAMManager:
    def __init__(self, iam_client=None, sts_client=None):
        self.sts_client = sts_client if sts_client else boto3.client("sts", config=retry_config)
        self.aws_partition = boto3.Session().get_partition_for_region(boto3.Session().region_name)
        self.iam_client = iam_client if iam_client else boto3.client("iam", config=retry_config)

        # If you update this you need to increment the PROJECT_POLICY_VERSION value
        self.project_policy = """{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:DeleteObject",
                        "s3:PutObject",
                        "s3:PutObjectTagging"
                    ],
                    "Resource": "arn:$PARTITION:s3:::$BUCKET_NAME/project/$PROJECT_NAME/*"
                },
                {
                    "Effect": "Deny",
                    "Action": [
                        "sagemaker:CreateEndpoint"
                    ],
                    "Resource": "arn:$PARTITION:sagemaker:*:*:endpoint/*",
                    "Condition": {
                        "StringNotEqualsIgnoreCase": {
                            "aws:RequestTag/project": "$PROJECT_NAME"
                        }
                    }
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "sagemaker:CreateEndpoint"
                    ],
                    "Resource": "arn:$PARTITION:sagemaker:*:*:endpoint-config/*"
                },
                {
                    "Effect": "Deny",
                    "Action": [
                        "sagemaker:CreateModel",
                        "sagemaker:CreateEndpointConfig",
                        "sagemaker:CreateTrainingJob",
                        "sagemaker:CreateProcessingJob",
                        "sagemaker:CreateHyperParameterTuningJob",
                        "sagemaker:CreateTransformJob"
                    ],
                    "Resource": "*",
                    "Condition": {
                        "StringNotEqualsIgnoreCase": {
                            "aws:RequestTag/project": "$PROJECT_NAME"
                        }
                    }
                },
                {
                    "Effect": "Allow",
                    "Action": "s3:ListBucket",
                    "Resource": "arn:$PARTITION:s3:::$BUCKET_NAME",
                    "Condition": {
                        "StringLike": {
                            "s3:prefix": "project/$PROJECT_NAME/*"
                        }
                    }
                }
            ]
        }
        """
        # If you update this you need to increment the USER_POLICY_VERSION value
        self.user_policy = """{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:DeleteObject",
                        "s3:PutObject",
                        "s3:PutObjectTagging"
                    ],
                    "Resource": [
                        "arn:$PARTITION:s3:::$BUCKET_NAME/private/$USER_NAME/*",
                        "arn:$PARTITION:s3:::$BUCKET_NAME/global/*"
                    ]
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:PutObject",
                        "s3:PutObjectTagging"
                    ],
                    "Resource": "arn:$PARTITION:s3:::$BUCKET_NAME/index/*"
                },
                {
                    "Effect": "Allow",
                    "Action": "s3:ListBucket",
                    "Resource": "arn:$PARTITION:s3:::$BUCKET_NAME",
                    "Condition": {
                        "StringLike": {
                            "s3:prefix": [
                                "private/$USER_NAME/*",
                                "global/*",
                                "index/*"
                            ]
                        }
                    }
                },
                {
                    "Effect": "Allow",
                    "Action": "s3:GetBucketLocation",
                    "Resource": "arn:$PARTITION:s3:::$BUCKET_NAME"
                },
                {
                    "Effect": "Deny",
                    "Action": [
                        "sagemaker:CreateEndpoint"
                    ],
                    "Resource": "arn:$PARTITION:sagemaker:*:*:endpoint/*",
                    "Condition": {
                        "StringNotEqualsIgnoreCase": {
                            "aws:RequestTag/user": "$USER_NAME"
                        }
                    }
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "sagemaker:CreateEndpoint"
                    ],
                    "Resource": "arn:$PARTITION:sagemaker:*:*:endpoint-config/*"
                },
                {
                    "Effect": "Deny",
                    "Action": [
                        "sagemaker:CreateModel",
                        "sagemaker:CreateEndpointConfig",
                        "sagemaker:CreateTrainingJob",
                        "sagemaker:CreateProcessingJob",
                        "sagemaker:CreateHyperParameterTuningJob",
                        "sagemaker:CreateTransformJob"
                    ],
                    "Resource": "*",
                    "Condition": {
                        "StringNotEqualsIgnoreCase": {
                            "aws:RequestTag/user": "$USER_NAME"
                        }
                    }
                }
            ]
        }
        """

        env_variables = get_environment_variables()
        self.data_bucket = env_variables["DATA_BUCKET"]
        self.system_tag = env_variables["SYSTEM_TAG"]
        self.notebook_role_name = os.getenv("NOTEBOOK_ROLE_NAME", "")
        self.default_notebook_role_policy_arns = []
        self.permissions_boundary_arn = os.getenv("PERMISSIONS_BOUNDARY_ARN", "")

    def add_iam_role(self, project_name: str, username: str) -> str:
        iam_role_name = self._generate_iam_role_name(username, project_name)

        # Check if the IAM role exists already
        existing_role_arn = self._check_iam_role_exists(iam_role_name)
        if not existing_role_arn:
            iam_role_arn = self._create_iam_role(iam_role_name, project_name, username)

        # Build additional resource name variables
        project_policy_name = f"{IAM_RESOURCE_PREFIX}-project-{project_name}"
        user_policy_name = f"{IAM_RESOURCE_PREFIX}-user-{username}"

        aws_account = self.sts_client.get_caller_identity()["Account"]
        project_policy_arn = (
            f"arn:{self.aws_partition}:iam::{aws_account}:policy/{project_policy_name}"
        )
        user_policy_arn = f"arn:{self.aws_partition}:iam::{aws_account}:policy/{user_policy_name}"

        # Confirm policy name lengths are compliant
        self._check_name_length(IAMResourceType.POLICY, user_policy_name)
        self._check_name_length(IAMResourceType.POLICY, project_policy_name)
        self._check_name_length(IAMResourceType.ROLE, iam_role_name)

        # Check if the project policy exists
        existing_project_policy_version = self._get_policy_verison(project_policy_arn)
        if existing_project_policy_version is None:
            project_policy_arn = self._create_iam_policy(
                project_policy_name,
                self._generate_project_policy(project_name),
                "Project",
                project_name,
                PROJECT_POLICY_VERSION,
            )
        elif existing_project_policy_version < PROJECT_POLICY_VERSION:
            # Remove unused versions of the policy making room for the new policy if needed
            self._delete_unused_policy_versions(project_policy_arn)
            self.iam_client.create_policy_version(
                PolicyArn=project_policy_arn,
                PolicyDocument=self._generate_project_policy(project_name),
                SetAsDefault=True,
            )
            self.iam_client.tag_policy(
                PolicyArn=project_policy_arn,
                Tags=[
                    {"Key": "project", "Value": project_name},
                    {"Key": "policyVersion", "Value": str(PROJECT_POLICY_VERSION)},
                    {"Key": "system", "Value": self.system_tag},
                ],
            )

        # Check if the user policy exists
        existing_user_policy_version = self._get_policy_verison(user_policy_arn)
        if existing_user_policy_version is None:
            user_policy_arn = self._create_iam_policy(
                user_policy_name,
                self._generate_user_policy(username),
                "User",
                username,
                USER_POLICY_VERSION,
            )
        elif existing_user_policy_version < USER_POLICY_VERSION:
            # Remove unused versions of the policy making room for the new policy if needed
            self._delete_unused_policy_versions(user_policy_arn)
            self.iam_client.create_policy_version(
                PolicyArn=user_policy_arn,
                PolicyDocument=self._generate_user_policy(username),
                SetAsDefault=True,
            )
            self.iam_client.tag_policy(
                PolicyArn=user_policy_arn,
                Tags=[
                    {"Key": "user", "Value": username},
                    {"Key": "policyVersion", "Value": str(USER_POLICY_VERSION)},
                    {"Key": "system", "Value": self.system_tag},
                ],
            )

        # The notebook policy and pass role policies don't support/need dynamic
        # policy updates between versions. The notebook policy is updated by CDK
        # and not dynamic/managed via python like the user and project policies
        if existing_role_arn:
            return existing_role_arn

        # Attach all policies from the MLSpace notebook role
        if not self.default_notebook_role_policy_arns:
            notebook_role_policies = self.iam_client.list_attached_role_policies(
                RoleName=self.notebook_role_name
            )
            self.default_notebook_role_policy_arns = [
                policy["PolicyArn"] for policy in notebook_role_policies["AttachedPolicies"]
            ]

        for policy_arn in self.default_notebook_role_policy_arns:
            self._attach_iam_policy(iam_role_name, policy_arn)

        # Attach the user and project policies
        self._attach_iam_policy(iam_role_name, project_policy_arn)
        self._attach_iam_policy(iam_role_name, user_policy_arn)

        # Add pass role for this specific role arn
        pass_role_policy_doc = """{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "iam:PassRole",
                    "Resource": "$ROLE_ARN",
                    "Condition": {
                        "StringEqualsIgnoreCase": {
                            "iam:PassedToService": [
                                "sagemaker.amazonaws.com",
                                "translate.amazonaws.com"
                            ]
                        }
                    }
                }
            ]
        }
        """.replace(
            "$ROLE_ARN", iam_role_arn
        )
        self.iam_client.put_role_policy(
            RoleName=iam_role_name,
            PolicyName="SMPassRolePolicy",
            PolicyDocument=pass_role_policy_doc,
        )

        return iam_role_arn

    # Removes the passed in roles and deletes any detached user specific policies. If a
    # project is passed in then the project policy is removed as well.
    def remove_project_user_roles(self, role_identifiers: List[str], project: str = None) -> None:
        aws_account = self.sts_client.get_caller_identity()["Account"]
        for role_identifier in role_identifiers:
            # This may be a friendly role name alredy if we're doing user cleanup
            # spliting this way supports both arns and freindly role names
            iam_role = role_identifier.split("/")[-1]
            # We expect two detached policies, the project policy and the user policy
            self._detach_iam_policies(iam_role)
            # Delete the inline policy for the role
            self.iam_client.delete_role_policy(RoleName=iam_role, PolicyName="SMPassRolePolicy")
            self.iam_client.delete_role(RoleName=iam_role)

        if project:
            project_policy_name = f"{IAM_RESOURCE_PREFIX}-project-{project}"
            self.iam_client.delete_policy(
                PolicyArn=f"arn:{self.aws_partition}:iam::{aws_account}:policy/{project_policy_name}"
            )

    # Removes all roles for the given user and deletes user specific policies
    def remove_all_user_roles(self, username: str, projects: List[str]) -> None:
        roles_to_delete = []
        for project in projects:
            iam_role_name = self._generate_iam_role_name(username, project)
            roles_to_delete.append(iam_role_name)

        self.remove_project_user_roles(roles_to_delete)
        # Delete user policy
        aws_account = self.sts_client.get_caller_identity()["Account"]
        user_policy_name = f"{IAM_RESOURCE_PREFIX}-user-{username}"
        user_policy_arn = f"arn:{self.aws_partition}:iam::{aws_account}:policy/{user_policy_name}"
        self.iam_client.delete_policy(PolicyArn=user_policy_arn)

    # Creates the IAM role for the MLSpace user/project context
    def _create_iam_role(self, iam_role_name: str, project_name: str, username: str) -> str:
        iam_role_response = self.iam_client.create_role(
            RoleName=iam_role_name,
            AssumeRolePolicyDocument=json.dumps(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"Service": "sagemaker.amazonaws.com"},
                            "Action": "sts:AssumeRole",
                        }
                    ],
                }
            ),
            Description=f"Default SageMaker Notebook role for Project: {project_name} - User: {username}",
            Tags=generate_tags(username, project_name, self.system_tag),
            PermissionsBoundary=self.permissions_boundary_arn,
        )
        return iam_role_response["Role"]["Arn"]

    # Creates a customer-managed IAM policy
    def _create_iam_policy(
        self,
        policy_name: str,
        policy_contents: str,
        policy_type: str,
        policy_identifier: str,
        policy_version: int,
    ) -> str:
        iam_policy_creation_response = self.iam_client.create_policy(
            PolicyName=policy_name,
            PolicyDocument=policy_contents,
            Description=f"MLSpace::{policy_type}::{policy_identifier}",
            Tags=[
                {"Key": policy_type.lower(), "Value": policy_identifier},
                {"Key": "policyVersion", "Value": str(policy_version)},
                {"Key": "system", "Value": self.system_tag},
            ],
        )
        return iam_policy_creation_response["Policy"]["Arn"]

    # Attaches a customer-managed IAM policy
    def _attach_iam_policy(self, role_name: str, policy_arn: str) -> None:
        self.iam_client.attach_role_policy(RoleName=role_name, PolicyArn=policy_arn)

    # Checks the status of an IAM resource
    def _check_iam_role_exists(self, resource_identifier: str) -> Optional[str]:
        try:
            existing_role = self.iam_client.get_role(RoleName=resource_identifier)
            return existing_role["Role"]["Arn"]
        except self.iam_client.exceptions.NoSuchEntityException:
            return None

    def _get_policy_verison(self, resource_identifier: str) -> Optional[int]:
        try:
            existing_policy = self.iam_client.get_policy(PolicyArn=resource_identifier)
            # Grab policy version from tags otherwise return a version of -1 if the policy exists
            # but version cannot be determined
            for tag in existing_policy["Policy"]["Tags"]:
                if tag["Key"] == "policyVersion":
                    return int(tag["Value"])
            return -1
        except self.iam_client.exceptions.NoSuchEntityException:
            return None

    # Detatches customer-managed IAM policies from an IAM role
    def _detach_iam_policies(self, iam_role_name: str) -> List[str]:
        detached_iam_policies = []
        # List the policies attached to the role
        iam_role_policies_response = self.iam_client.list_attached_role_policies(
            RoleName=iam_role_name
        )
        # Retrieve the attached IAM policy ARNs and then detach from the role
        for policy in iam_role_policies_response["AttachedPolicies"]:
            # Detach the policy
            self.iam_client.detach_role_policy(
                RoleName=iam_role_name, PolicyArn=policy["PolicyArn"]
            )
            detached_iam_policies.append(policy["PolicyArn"])

        return detached_iam_policies

    def _generate_project_policy(self, project: str) -> str:
        return (
            self.project_policy.replace("\n", "")
            .replace("$PROJECT_NAME", project)
            .replace("$BUCKET_NAME", self.data_bucket)
            .replace("$PARTITION", self.aws_partition)
        )

    def _generate_user_policy(self, user: str) -> str:
        return (
            self.user_policy.replace("\n", "")
            .replace("$USER_NAME", user)
            .replace("$BUCKET_NAME", self.data_bucket)
            .replace("$PARTITION", self.aws_partition)
        )

    def _generate_user_hash(self, username: str) -> str:
        return hashlib.sha256(username.encode()).hexdigest()

    def _generate_iam_role_name(self, username: str, project_name: str) -> str:
        user_hash = self._generate_user_hash(username)

        iam_role_name_prefix = f"{IAM_RESOURCE_PREFIX}-{project_name}-"
        hash_split = IAM_ROLE_NAME_MAX_LENGTH - len(iam_role_name_prefix)
        iam_role_name = f"{iam_role_name_prefix}{user_hash[: hash_split - 1]}"

        return iam_role_name

    def _check_name_length(self, resource_type: IAMResourceType, name: str) -> None:
        max_length = 0
        if resource_type == IAMResourceType.POLICY:
            max_length = IAM_POLICY_NAME_MAX_LENGTH
        elif resource_type == IAMResourceType.ROLE:
            max_length = IAM_ROLE_NAME_MAX_LENGTH
        if len(name) > max_length:
            raise ValueError(
                f"IAM {resource_type.value} name '{name}' ({len(name)} characters) is "
                + f"over the {max_length} character limit for IAM {resource_type.value} names."
            )

    def _delete_unused_policy_versions(self, policy_arn: str) -> None:
        # No need to set MaxItems here because the default is 100 and you can only have 5 max
        policy_versions = self.iam_client.list_policy_versions(PolicyArn=policy_arn)
        for version in policy_versions["Versions"]:
            if not version["IsDefaultVersion"]:
                self.iam_client.delete_policy_version(
                    PolicyArn=policy_arn, VersionId=version["VersionId"]
                )
