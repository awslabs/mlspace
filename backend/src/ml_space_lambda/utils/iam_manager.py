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
from typing import List, Optional

import boto3
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.dataset import DatasetDAO
from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetDAO
from ml_space_lambda.data_access_objects.group_user import GroupUserDAO
from ml_space_lambda.enums import DatasetType, EnvVariable, IAMResourceType
from ml_space_lambda.utils.common_functions import generate_tags, has_tags, retry_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables

logger = logging.getLogger(__name__)

IAM_ROLE_NAME_MAX_LENGTH = 64
IAM_POLICY_NAME_MAX_LENGTH = 128
USER_POLICY_VERSION = 1
PROJECT_POLICY_VERSION = 1
DYNAMIC_USER_ROLE_TAG = {"Key": "dynamic-user-role", "Value": "true"}

group_user_dao = GroupUserDAO()
group_dataset_dao = GroupDatasetDAO()
dataset_dao = DatasetDAO()


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
                        "bedrock:Retrieve*"
                    ],
                    "Resource": "*",
                    "Condition": {
                        "StringNotEqualsIgnoreCase": {
                            "aws:RequestTag/project": "$PROJECT_NAME",
                            "aws:ResourceTag/project": "$PROJECT_NAME"
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

        env_variables = get_environment_variables()
        self.data_bucket = env_variables[EnvVariable.DATA_BUCKET]
        self.system_tag = env_variables[EnvVariable.SYSTEM_TAG]
        self.app_role_name = env_variables[EnvVariable.APP_ROLE_NAME]
        self.notebook_role_name = env_variables[EnvVariable.NOTEBOOK_ROLE_NAME]
        self.default_notebook_role_policy_arns = []
        self.permissions_boundary_arn = env_variables[EnvVariable.PERMISSIONS_BOUNDARY_ARN]
        self.iam_resource_prefix = env_variables[EnvVariable.IAM_RESOURCE_PREFIX]

    def get_iam_role_arn(self, project_name: str, username: str) -> Optional[str]:
        """
        Get the ARN of an existing dynamic role for this (project_name, username) pair.

        Args:
            project_name (str): The project name
            username (str): The username of the user

        Return:
            Optional[str]: The ARN of the existing role, otherwise None if no such role exists.
        """

        iam_role_name = self._generate_iam_role_name(username, project_name)

        # Check if the IAM role exists already
        return self._fetch_iam_role(iam_role_name)

    def add_iam_role(self, project_name: str, username: str) -> str:
        iam_role_name = self._generate_iam_role_name(username, project_name)

        # Check if the IAM role exists already
        existing_role_arn = self._fetch_iam_role(iam_role_name)
        if not existing_role_arn:
            iam_role_arn = self._create_iam_role(iam_role_name, project_name, username)

        # Build additional resource name variables
        project_policy_name = f"{self.iam_resource_prefix}-project-{project_name}"

        aws_account = self.sts_client.get_caller_identity()["Account"]
        project_policy_arn = f"arn:{self.aws_partition}:iam::{aws_account}:policy/{project_policy_name}"

        # Confirm policy name lengths are compliant
        self._check_name_length(IAMResourceType.POLICY, project_policy_name)
        self._check_name_length(IAMResourceType.ROLE, iam_role_name)

        # Check if the project policy exists
        existing_project_policy_version = self._get_policy_version(project_policy_arn)
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

            try:
                self.iam_client.tag_policy(
                    PolicyArn=project_policy_arn,
                    Tags=[
                        {"Key": "project", "Value": project_name},
                        {"Key": "policyVersion", "Value": str(PROJECT_POLICY_VERSION)},
                        {"Key": "system", "Value": self.system_tag},
                    ],
                )
            except ClientError as error:
                # Check for unsupported operation error
                if error.response["Error"]["Code"] == "InvalidAction":
                    logger.info(f"Tagging policies is unsupported in this region.")
                else:
                    raise error
        user_policy_arn = self.update_user_policy(username)

        # The notebook policy and pass role policies don't support/need dynamic
        # policy updates between versions. The notebook policy is updated by CDK
        # and not dynamic/managed via python like the user and project policies
        if existing_role_arn:
            return existing_role_arn

        # Attach all policies from the MLSpace notebook role
        if not self.default_notebook_role_policy_arns:
            notebook_role_policies = self.iam_client.list_attached_role_policies(RoleName=self.notebook_role_name)
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
                                "bedrock.amazonaws.com",
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

    # Create or update the user policy
    def update_user_policy(
        self,
        username: str,
    ) -> str:
        user_policy_name = f"{self.iam_resource_prefix}-user-{username}"
        aws_account = self.sts_client.get_caller_identity()["Account"]
        user_policy_arn = f"arn:{self.aws_partition}:iam::{aws_account}:policy/{user_policy_name}"
        self._check_name_length(IAMResourceType.POLICY, user_policy_name)
        # Check if the user policy exists
        existing_user_policy_version = self._get_policy_version(user_policy_arn)
        if existing_user_policy_version is None:
            user_policy_arn = self._create_iam_policy(
                user_policy_name,
                self._generate_user_policy(username),
                "User",
                username,
                USER_POLICY_VERSION,
            )
        else:
            # Remove unused versions of the policy making room for the new policy if needed
            self._delete_unused_policy_versions(user_policy_arn)
            self.iam_client.create_policy_version(
                PolicyArn=user_policy_arn,
                PolicyDocument=self._generate_user_policy(username),
                SetAsDefault=True,
            )
            try:
                self.iam_client.tag_policy(
                    PolicyArn=user_policy_arn,
                    Tags=[
                        {"Key": "user", "Value": username},
                        {"Key": "policyVersion", "Value": str(USER_POLICY_VERSION)},
                        {"Key": "system", "Value": self.system_tag},
                    ],
                )
            except ClientError as error:
                # Check for unsupported operation error
                if error.response["Error"]["Code"] == "InvalidAction":
                    logger.info(f"Tagging policies is unsupported in this region.")
                else:
                    raise error
        return user_policy_arn

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
            project_policy_name = f"{self.iam_resource_prefix}-project-{project}"
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
        user_policy_name = f"{self.iam_resource_prefix}-user-{username}"
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
            Tags=generate_tags(username, project_name, self.system_tag, [DYNAMIC_USER_ROLE_TAG]),
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
    def _fetch_iam_role(self, resource_identifier: str) -> Optional[str]:
        try:
            existing_role = self.iam_client.get_role(RoleName=resource_identifier)
            return existing_role["Role"]["Arn"]
        except self.iam_client.exceptions.NoSuchEntityException:
            return None

    def _get_policy_version(self, resource_identifier: str) -> Optional[int]:
        try:
            existing_policy = self.iam_client.get_policy(PolicyArn=resource_identifier)
            # Grab policy version from tags otherwise return a version of -1 if the policy exists
            # but version cannot be determined
            if "Tags" in existing_policy["Policy"]:
                for tag in existing_policy["Policy"]["Tags"]:
                    if tag["Key"] == "policyVersion":
                        return int(tag["Value"])
            elif "DefaultVersionId" in existing_policy["Policy"]:
                return int("".join(c for c in existing_policy["Policy"]["DefaultVersionId"] if c.isdigit()))
            return -1
        except self.iam_client.exceptions.NoSuchEntityException:
            return None

    # Detatches customer-managed IAM policies from an IAM role
    def _detach_iam_policies(self, iam_role_name: str) -> List[str]:
        detached_iam_policies = []
        # List the policies attached to the role
        iam_role_policies_response = self.iam_client.list_attached_role_policies(RoleName=iam_role_name)
        # Retrieve the attached IAM policy ARNs and then detach from the role
        for policy in iam_role_policies_response["AttachedPolicies"]:
            # Detach the policy
            self.iam_client.detach_role_policy(RoleName=iam_role_name, PolicyArn=policy["PolicyArn"])
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
        resource_arns = [
            f"arn:{self.aws_partition}:s3:::{self.data_bucket}/private/{user}/*",
            f"arn:{self.aws_partition}:s3:::{self.data_bucket}/global/*",
        ]
        resource_prefixes = [f"private/{user}/*", "global/*", "index/*"]

        dataset_arn_prefixes = set()
        group_prefixes = set()
        for group in group_user_dao.get_groups_for_user(user):
            for group_dataset in group_dataset_dao.get_datasets_for_group(group.group):
                dataset = dataset_dao.get(DatasetType.GROUP, group_dataset.dataset)
                if dataset is not None:
                    dataset_arn_prefixes.add(
                        f"arn:{self.aws_partition}:s3:::{self.data_bucket}/group/datasets/{dataset.name}/*"
                    )
                    group_prefixes.add(f"group/datasets/{dataset.name}/*")

        resource_arns.extend(list(dataset_arn_prefixes))
        resource_prefixes.extend(list(group_prefixes))

        user_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject", "s3:DeleteObject", "s3:PutObject", "s3:PutObjectTagging"],
                    "Resource": resource_arns,
                },
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject", "s3:PutObject", "s3:PutObjectTagging"],
                    "Resource": f"arn:{self.aws_partition}:s3:::{self.data_bucket}/index/*",
                },
                {
                    "Effect": "Allow",
                    "Action": "s3:ListBucket",
                    "Resource": f"arn:{self.aws_partition}:s3:::{self.data_bucket}",
                    "Condition": {"StringLike": {"s3:prefix": resource_prefixes}},
                },
                {
                    "Effect": "Allow",
                    "Action": "s3:GetBucketLocation",
                    "Resource": f"arn:{self.aws_partition}:s3:::{self.data_bucket}",
                },
                {
                    "Effect": "Deny",
                    "Action": ["sagemaker:CreateEndpoint"],
                    "Resource": f"arn:{self.aws_partition}:sagemaker:*:*:endpoint/*",
                    "Condition": {"StringNotEqualsIgnoreCase": {"aws:RequestTag/user": user}},
                },
                {
                    "Effect": "Allow",
                    "Action": ["sagemaker:CreateEndpoint"],
                    "Resource": f"arn:{self.aws_partition}:sagemaker:*:*:endpoint-config/*",
                },
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
                    "Condition": {"StringNotEqualsIgnoreCase": {"aws:RequestTag/user": user, "aws:ResourceTag/user": user}},
                },
            ],
        }

        return json.dumps(user_policy)

    def _generate_user_hash(self, username: str) -> str:
        return hashlib.sha256(username.encode()).hexdigest()

    def generate_policy(self, statements: list):
        if len(statements) > 0:
            return {"Version": "2012-10-17", "Statement": statements}
        else:
            return None

    def generate_policy_string(self, statements: list):
        policy = self.generate_policy(statements)
        return json.dumps(policy) if policy else None

    # If the provided policy doesn't exist, it will be created
    def update_dynamic_policy(
        self,
        policy: str,
        policy_name: str,
        policy_type: str,
        policy_type_identifier: str,
        on_create_attach_to_notebook_role: bool = False,
        on_create_attach_to_app_role: bool = False,
        on_create_attach_to_existing_dynamic_roles: bool = False,
        expected_policy_version: int = None,
    ):
        aws_account = self.sts_client.get_caller_identity()["Account"]
        prefixed_policy_name = f"{self.iam_resource_prefix}-{policy_name}"
        self._check_name_length(IAMResourceType.POLICY, prefixed_policy_name)
        policy_arn = f"arn:{self.aws_partition}:iam::{aws_account}:policy/{prefixed_policy_name}"
        logger.info(f"Attempting to update {policy_name} with the provided policy {policy}")
        # Create the policy if it doesn't exist
        existing_policy_version = self._get_policy_version(policy_arn)
        if existing_policy_version is None and policy:
            logger.info(f"Creating a new {policy_name} dynamic policy")
            policy_arn = self._create_iam_policy(
                prefixed_policy_name,
                policy,
                policy_type,
                policy_type_identifier,
                1 if expected_policy_version is None else expected_policy_version,
            )

            # Attaches the policy to the notebook role so it will get attached to new dynamic roles
            if on_create_attach_to_notebook_role:
                self.iam_client.attach_role_policy(RoleName=self.notebook_role_name, PolicyArn=policy_arn)

            if on_create_attach_to_app_role:
                self.iam_client.attach_role_policy(RoleName=self.app_role_name, PolicyArn=policy_arn)

            if on_create_attach_to_existing_dynamic_roles:
                role_names = self.find_dynamic_user_roles()
                self.attach_policies_to_roles([policy_arn], role_names)

        # If the policy does exist, then update it
        elif expected_policy_version is None or existing_policy_version < expected_policy_version:
            logger.info(f"Updating the existing {policy_name} dynamic policy")
            # Remove unused versions of the policy making room for the new policy if needed
            self._delete_unused_policy_versions(policy_arn)
            self.iam_client.create_policy_version(
                PolicyArn=policy_arn,
                PolicyDocument=policy,
                SetAsDefault=True,
            )
            try:
                self.iam_client.tag_policy(
                    PolicyArn=policy_arn,
                    Tags=[
                        {"Key": policy_type, "Value": policy_type_identifier},
                        {
                            "Key": "policyVersion",
                            "Value": str(
                                (existing_policy_version + 1) if expected_policy_version is None else expected_policy_version
                            ),
                        },
                        {"Key": "system", "Value": self.system_tag},
                    ],
                )
            except ClientError as error:
                # Check for unsupported operation error
                if error.response["Error"]["Code"] == "InvalidAction":
                    logger.info(f"Tagging policies is unsupported in this region.")
                else:
                    raise error
        else:
            logger.info(f"Provided inputs didn't meet criteria for updating or creating a new policy")

    def find_dynamic_user_roles(self) -> list[str]:
        paginator = self.iam_client.get_paginator("list_roles")
        role_names = []

        for page in paginator.paginate():
            if "Roles" not in page:
                continue

            for role in page["Roles"]:
                tags = self.iam_client.list_role_tags(RoleName=role["RoleName"])

                if "Tags" not in tags:
                    continue

                # try the simple case first
                if DYNAMIC_USER_ROLE_TAG in tags["Tags"]:
                    role_names.append(role["RoleName"])
                    continue

                # make sure all expected tags exist to try and ensure this is an MLSpace role
                if not has_tags(tags["Tags"], system_tag=self.system_tag):
                    continue

                # convert to simple dict
                tags = dict((tag["Key"], tag["Value"]) for tag in tags["Tags"])

                # some application roles would be tagged properly but should be skipped
                if tags["user"] == "MLSpaceApplication":
                    continue

                expected_role_name = self._generate_iam_role_name(tags["user"], tags["project"])
                if expected_role_name == role["RoleName"]:
                    role_names.append(role["RoleName"])

        return role_names

    def attach_policies_to_roles(self, policy_arns: list[str], role_names: list[str]):
        for role_name in role_names:
            for policy_arn in policy_arns:
                self._attach_iam_policy(role_name, policy_arn)

    def _generate_user_hash(self, username: str) -> str:
        return hashlib.sha256(username.encode()).hexdigest()

    def _generate_iam_role_name(self, username: str, project_name: str) -> str:
        user_hash = self._generate_user_hash(username)

        iam_role_name_prefix = f"{self.iam_resource_prefix}-{project_name}-"
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
                f"IAM {resource_type} name '{name}' ({len(name)} characters) is "
                + f"over the {max_length} character limit for IAM {resource_type} names."
            )

    def _delete_unused_policy_versions(self, policy_arn: str) -> None:
        # No need to set MaxItems here because the default is 100 and you can only have 5 max
        policy_versions = self.iam_client.list_policy_versions(PolicyArn=policy_arn)
        for version in policy_versions["Versions"]:
            if not version["IsDefaultVersion"]:
                self.iam_client.delete_policy_version(PolicyArn=policy_arn, VersionId=version["VersionId"])

    def update_groups(self, groups: list[str]) -> None:
        users_to_update = set()
        for group in groups:
            for user in group_user_dao.get_users_for_group(group):
                users_to_update.add(user.user)

        for username in users_to_update:
            self.update_user_policy(username)
