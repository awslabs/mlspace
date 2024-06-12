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

import json
from unittest import TestCase, mock

import boto3
import moto
import pytest

import ml_space_lambda.utils.account_utils as account_utils
import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.enums import IAMEffect, IAMStatementProperty
from ml_space_lambda.utils.common_functions import generate_tags
from ml_space_lambda.utils.iam_manager import PROJECT_POLICY_VERSION, USER_POLICY_VERSION

NOTEBOOK_ROLE_NAME = "MLSpace-notebook-role"
DEFAULT_NOTEBOOK_POLICY_NAME = "MLSpace-notebook-policy"
SYSTEM_TAG = "MLSpace"
IAM_RESOURCE_PREFIX = "MLSpace"

TEST_DYNAMIC_POLICY_NAME = "test-dynamic-policy"
EXPECTED_TEST_DYNAMIC_POLICY_NAME = f"{IAM_RESOURCE_PREFIX}-{TEST_DYNAMIC_POLICY_NAME}"

TEST_PERMISSIONS_BOUNDARY_ARN = "arn:aws:iam::123456789012:policy/mlspace-project-user-permission-boundary"

TEST_ENV_CONFIG = {
    # Moto doesn't work with iso regions...
    "AWS_DEFAULT_REGION": "us-east-1",
    # Fake cred info for MOTO
    "AWS_ACCESS_KEY_ID": "testing",
    "AWS_SECRET_ACCESS_KEY": "testing",
    "AWS_SECURITY_TOKEN": "testing",
    "AWS_SESSION_TOKEN": "testing",
    "NOTEBOOK_ROLE_NAME": NOTEBOOK_ROLE_NAME,
    "PERMISSIONS_BOUNDARY_ARN": TEST_PERMISSIONS_BOUNDARY_ARN,
}


MOCK_PROJECT_NAME = "example_project"
MOCK_USER_NAME = "jdoe"

DENY_TRANSLATE_STATEMENT = {
    IAMStatementProperty.EFFECT: IAMEffect.DENY,
    IAMStatementProperty.ACTION: ["translate:*"],
    IAMStatementProperty.RESOURCE: "*",
}

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)


@moto.mock_sts
@moto.mock_iam
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestIAMSupport(TestCase):
    def setUp(self):
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.iam_manager import IAMManager

        mlspace_config.env_variables = {}
        account_utils.aws_partition = "aws"
        account_utils.aws_account = "123456789012"
        self.iam_client = boto3.client("iam", config=retry_config)
        self.sts_client = boto3.client("sts", config=retry_config)

        # Create the notebook role and attach a dummy policy to it
        self.iam_client.create_role(
            RoleName=NOTEBOOK_ROLE_NAME,
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
            Description="MLSpace SageMaker Notebook role",
            Tags=[],
        )
        notebook_policy_response = self.iam_client.create_policy(
            PolicyName=DEFAULT_NOTEBOOK_POLICY_NAME,
            PolicyDocument="""{
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": ["sagemaker:*"],
                        "Resource": "*"
                    }
                ]
            }
            """,
            Description="MLSpace Notebook Policy",
        )
        self.iam_client.attach_role_policy(RoleName=NOTEBOOK_ROLE_NAME, PolicyArn=notebook_policy_response["Policy"]["Arn"])
        self.iam_manager = IAMManager(self.iam_client)

    def tearDown(self):
        self.iam_client = None
        self.sts_client = None
        self.iam_manager = None

    def test_add_iam_role(self):
        self.iam_manager.add_iam_role(MOCK_PROJECT_NAME, MOCK_USER_NAME)

        # Check that expected iam role and policies were created
        role_exists = False
        all_roles = self.iam_client.list_roles()

        for role in all_roles["Roles"]:
            if (
                role["RoleName"].startswith(f"{IAM_RESOURCE_PREFIX}-{MOCK_PROJECT_NAME}-")
                and MOCK_USER_NAME in role["Description"]
            ):
                role_exists = True
                response = self.iam_client.list_attached_role_policies(RoleName=role["RoleName"])
                policy_names = [policy["PolicyName"] for policy in response["AttachedPolicies"]]
                break

        assert role_exists

        # Ensure we have 3 policies attached:
        # - MLSpace default sagemaker access policy
        # - a project datasets access policy
        # - a private (user) datasets access policy
        assert DEFAULT_NOTEBOOK_POLICY_NAME in policy_names
        assert f"{IAM_RESOURCE_PREFIX}-project-{MOCK_PROJECT_NAME}" in policy_names
        assert f"{IAM_RESOURCE_PREFIX}-user-{MOCK_USER_NAME}" in policy_names

    def test_add_iam_role_exists(self):
        test_user = "existing@amazon.com"
        # Add role initially
        self.iam_manager.add_iam_role(MOCK_PROJECT_NAME, test_user)
        # Check that expected iam role and policies already exist
        existing_arn = None
        all_roles = self.iam_client.list_roles()

        for role in all_roles["Roles"]:
            if role["RoleName"].startswith(f"{IAM_RESOURCE_PREFIX}-{MOCK_PROJECT_NAME}-") and test_user in role["Description"]:
                existing_arn = role["Arn"]
                break

        # This should run gracefully without error and we should get back the expected
        # arn
        assert existing_arn and (existing_arn == self.iam_manager.add_iam_role(MOCK_PROJECT_NAME, test_user))

    def test_add_iam_role_too_long(self):
        long_name = "VeryLongProjectNameThatWillCauseThePolicyNameToGoOverTheLimit"
        with pytest.raises(ValueError) as e_info:
            self.iam_manager.add_iam_role(long_name, MOCK_USER_NAME)
        # Error will also include a long hash of the project and user which we don't
        # need to mock
        assert f"IAM role name 'MLSpace-{long_name}-" in str(e_info.value)
        assert "' (127 characters) is over the 64 character limit for IAM role names." in str(e_info.value)

    def test_add_iam_role_exists_outdated_policies(self):
        test_user = "old-user"
        policy_arns = []
        # Add role initially
        self.iam_manager.add_iam_role(MOCK_PROJECT_NAME, test_user)
        # Grab existing policies so we can get their default versions and untag them
        all_roles = self.iam_client.list_roles()
        policy_version_map = {}
        for role in all_roles["Roles"]:
            if role["RoleName"].startswith(f"{IAM_RESOURCE_PREFIX}-{MOCK_PROJECT_NAME}-") and test_user in role["Description"]:
                response = self.iam_client.list_attached_role_policies(RoleName=role["RoleName"])
                for policy in response["AttachedPolicies"]:
                    if policy["PolicyName"] in [
                        f"{IAM_RESOURCE_PREFIX}-project-{MOCK_PROJECT_NAME}",
                        f"{IAM_RESOURCE_PREFIX}-user-{test_user}",
                    ]:
                        policy_arns.append(policy["PolicyArn"])
                break

        example_unused_policy = """{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": ["*"]
                }
            ]
        }"""
        # Remove the policy version tag from the existing policies to simulate an old user from
        # before policies had tags
        for arn in policy_arns:
            policy_versions = self.iam_client.list_policy_versions(
                PolicyArn=arn,
            )
            for policy_version in policy_versions["Versions"]:
                if policy_version["IsDefaultVersion"]:
                    policy_version_map[arn] = policy_version["VersionId"]
            # Add an extra non default policy version so we have something to cleanup
            self.iam_client.create_policy_version(
                PolicyArn=arn,
                PolicyDocument=example_unused_policy,
                SetAsDefault=False,
            )
            self.iam_client.untag_policy(
                PolicyArn=arn,
                TagKeys=[
                    "policyVersion",
                ],
            )
        # This should run gracefully without error and we should end up with new default policy
        # versions
        self.iam_manager.add_iam_role(MOCK_PROJECT_NAME, test_user)
        policies_updated = 0
        system_tags = 0
        policy_version_tags = 0
        user_tags = 0
        project_tags = 0

        for arn in policy_arns:
            policy_versions = self.iam_client.list_policy_versions(
                PolicyArn=arn,
            )
            for policy_version in policy_versions["Versions"]:
                if policy_version["IsDefaultVersion"]:
                    assert policy_version_map[arn] != policy_version["VersionId"]
                    policies_updated += 1

            policy_tags = self.iam_client.list_policy_tags(
                PolicyArn=arn,
            )
            # Should have system, policyVersion, and user or project
            assert len(policy_tags["Tags"]) == 3
            policy_type = None
            mls_policy_version = None
            for tag in policy_tags["Tags"]:
                if tag["Key"] == "user" and tag["Value"] == test_user:
                    policy_type = "user"
                    user_tags += 1
                elif tag["Key"] == "project" and tag["Value"] == MOCK_PROJECT_NAME:
                    policy_type = "project"
                    project_tags += 1
                elif tag["Key"] == "system" and tag["Value"] == SYSTEM_TAG:
                    system_tags += 1
                elif tag["Key"] == "policyVersion":
                    mls_policy_version = int(tag["Value"])

            if policy_type == "user" and mls_policy_version == USER_POLICY_VERSION:
                policy_version_tags += 1
            if policy_type == "project" and mls_policy_version == PROJECT_POLICY_VERSION:
                policy_version_tags += 1

        assert policies_updated == 2
        assert policy_version_tags == 2
        assert system_tags == 2
        assert user_tags == 1
        assert project_tags == 1

    def test_remove_project_user_roles_single_user(self):
        # Add a new user
        test_user = "matt@example.com"
        new_role_arn = self.iam_manager.add_iam_role(MOCK_PROJECT_NAME, test_user)

        # Verify role and policies exist
        role_lookup_response = self.iam_client.get_role(RoleName=new_role_arn.split("/")[-1])
        existing_role = role_lookup_response["Role"]
        # Ensure role was tagged up appropriately
        assert existing_role["Tags"] == generate_tags(test_user, MOCK_PROJECT_NAME, SYSTEM_TAG)

        response = self.iam_client.list_attached_role_policies(RoleName=existing_role["RoleName"])
        user_policy_arn = ""
        persistent_policy_arns = []

        for policy in response["AttachedPolicies"]:
            if "-user-" in policy["PolicyName"]:
                user_policy_arn = policy["PolicyArn"]
            else:
                persistent_policy_arns.append(policy["PolicyArn"])

        # Remove single role and ensure it's deleted but that the user policy is not
        self.iam_manager.remove_project_user_roles([new_role_arn])
        with pytest.raises(self.iam_client.exceptions.NoSuchEntityException):
            self.iam_client.get_role(RoleName=new_role_arn.split("/")[-1])
        self.iam_client.get_policy(PolicyArn=user_policy_arn)
        # Ensure project policy and default notebook policy are preserved
        notebook_policy_found = False
        project_policy_found = False
        for policy_arn in persistent_policy_arns:
            policy_response = self.iam_client.get_policy(PolicyArn=policy_arn)
            if policy_response["Policy"]["PolicyName"] == DEFAULT_NOTEBOOK_POLICY_NAME:
                notebook_policy_found = True
            elif policy_response["Policy"]["PolicyName"] == f"{IAM_RESOURCE_PREFIX}-project-{MOCK_PROJECT_NAME}":
                project_policy_found = True

        assert notebook_policy_found
        assert project_policy_found

    def test_remove_project_user_roles_multi_user_with_project(self):
        # Add some users to a new project
        test_user = "matt@example.com"
        test_user2 = "bill@example.com"
        test_project = "MultiUserTest"
        test_user_role_arn = self.iam_manager.add_iam_role(test_project, test_user)
        test_user2_role_arn = self.iam_manager.add_iam_role(test_project, test_user2)

        # Verify user roles and project policy exists
        self.iam_client.get_role(RoleName=test_user_role_arn.split("/")[-1])
        self.iam_client.get_role(RoleName=test_user2_role_arn.split("/")[-1])

        project_policy_name = f"{IAM_RESOURCE_PREFIX}-project-{test_project}"
        aws_account = self.sts_client.get_caller_identity()["Account"]
        project_policy_arn = f"arn:{self.iam_manager.aws_partition}:iam::{aws_account}:policy/{project_policy_name}"
        self.iam_client.get_policy(PolicyArn=project_policy_arn)

        # Remove both roles and the project (project disable/delete).
        self.iam_manager.remove_project_user_roles([test_user_role_arn, test_user2_role_arn], test_project)
        with pytest.raises(self.iam_client.exceptions.NoSuchEntityException):
            self.iam_client.get_role(RoleName=test_user_role_arn.split("/")[-1])
        with pytest.raises(self.iam_client.exceptions.NoSuchEntityException):
            self.iam_client.get_role(RoleName=test_user2_role_arn.split("/")[-1])
        with pytest.raises(self.iam_client.exceptions.NoSuchEntityException):
            self.iam_client.get_policy(PolicyArn=project_policy_arn)
        # Ensure default notebook policy wasn't deleted
        for policy_arn in self.iam_manager.default_notebook_role_policy_arns:
            self.iam_client.get_policy(PolicyArn=policy_arn)

    def test_remove_all_user_roles(self):
        # Add a few roles for the same user
        test_user = "bob@example.com"
        test_project_1 = "test_project_1"
        test_project_2 = "test_project_2"
        test_project_3 = "test_project_3"
        test_project_4 = "test_project_4"

        response = self.iam_client.list_roles()
        initial_role_count = len(response["Roles"])

        response = self.iam_client.list_policies(Scope="Local")
        initial_policy_count = len(response["Policies"])

        self.iam_manager.add_iam_role(test_project_1, test_user)
        self.iam_manager.add_iam_role(test_project_2, test_user)
        self.iam_manager.add_iam_role(test_project_3, test_user)
        self.iam_manager.add_iam_role(test_project_4, test_user)

        response = self.iam_client.list_roles()
        # 1 role is added per project and per user
        assert initial_role_count + 4 == len(response["Roles"])

        # 1 policy is added for every new project (4) and 1 for each user total (1)
        response = self.iam_client.list_policies(Scope="Local")
        assert initial_policy_count + 5 == len(response["Policies"])

        self.iam_manager.remove_all_user_roles(test_user, [test_project_1, test_project_2, test_project_3, test_project_4])

        # Ensure all roles were cleaned up as expected
        response = self.iam_client.list_roles()
        assert initial_role_count == len(response["Roles"])

        # Ensure all policies were cleaned up as expected. Project policies
        # should not have been deleted as the projects were not deleted.
        response = self.iam_client.list_policies(Scope="Local")
        assert initial_role_count + 4 == len(response["Policies"])

    def test_generate_policy(self):
        policy = self.iam_manager.generate_policy_string([DENY_TRANSLATE_STATEMENT])
        assert (
            policy
            == '{"Version": "2012-10-17", "Statement": [{"Effect": "Deny", "Action": ["translate:*"], "Resource": "*"}]}'
        )

        policy = self.iam_manager.generate_policy([])
        assert policy == None

    def test_update_dynamic_policy(self):
        # Test creating a brand new role
        policy = self.iam_manager.generate_policy_string([DENY_TRANSLATE_STATEMENT])
        self.iam_manager.update_dynamic_policy(
            policy,
            TEST_DYNAMIC_POLICY_NAME,
            "test-type",
            "test-type-1",
            on_create_attach_to_notebook_role=True,
            expected_policy_version="2",
        )
        attached_policies_response = self.iam_client.list_attached_role_policies(RoleName=NOTEBOOK_ROLE_NAME)
        assert len(attached_policies_response["AttachedPolicies"]) == 2
        assert self.iam_client.get_policy(
            PolicyArn=account_utils.account_arn_from_example_arn(
                TEST_PERMISSIONS_BOUNDARY_ARN, "iam", f"policy/{EXPECTED_TEST_DYNAMIC_POLICY_NAME}"
            )
        )

        # Test updating the policy
        self.iam_manager.update_dynamic_policy(
            policy,
            TEST_DYNAMIC_POLICY_NAME,
            "test-type",
            "test-type-1",
            on_create_attach_to_notebook_role=True,
            expected_policy_version=3,
        )
        attached_policies_response = self.iam_client.list_attached_role_policies(RoleName=NOTEBOOK_ROLE_NAME)
        assert len(attached_policies_response["AttachedPolicies"]) == 2
        assert self.iam_client.get_policy_version(
            PolicyArn=account_utils.account_arn_from_example_arn(
                TEST_PERMISSIONS_BOUNDARY_ARN, "iam", f"policy/{EXPECTED_TEST_DYNAMIC_POLICY_NAME}"
            ),
            VersionId="v2",
        )

        # Test invalid update to policy (same version as before)
        self.iam_manager.update_dynamic_policy(
            policy,
            TEST_DYNAMIC_POLICY_NAME,
            "test-type",
            "test-type-1",
            on_create_attach_to_notebook_role=True,
            expected_policy_version=3,
        )
        attached_policies_response = self.iam_client.list_attached_role_policies(RoleName=NOTEBOOK_ROLE_NAME)
        assert len(attached_policies_response["AttachedPolicies"]) == 2
        with pytest.raises(self.iam_client.exceptions.NoSuchEntityException):
            self.iam_client.get_policy_version(
                PolicyArn=account_utils.account_arn_from_example_arn(
                    TEST_PERMISSIONS_BOUNDARY_ARN, "iam", f"policy/{EXPECTED_TEST_DYNAMIC_POLICY_NAME}"
                ),
                VersionId="v3",
            )

        # Test update to the policy with no expected version
        self.iam_manager.update_dynamic_policy(
            policy,
            TEST_DYNAMIC_POLICY_NAME,
            "test-type",
            "test-type-1",
        )
        attached_policies_response = self.iam_client.list_attached_role_policies(RoleName=NOTEBOOK_ROLE_NAME)
        assert len(attached_policies_response["AttachedPolicies"]) == 2
        assert self.iam_client.get_policy_version(
            PolicyArn=account_utils.account_arn_from_example_arn(
                TEST_PERMISSIONS_BOUNDARY_ARN, "iam", f"policy/{EXPECTED_TEST_DYNAMIC_POLICY_NAME}"
            ),
            VersionId="v3",
        )

    def test_create_dynamic_policy_not_attached(self):
        policy = self.iam_manager.generate_policy_string([DENY_TRANSLATE_STATEMENT])
        self.iam_manager.update_dynamic_policy(
            policy, TEST_DYNAMIC_POLICY_NAME, "test-type", "test-type-1", expected_policy_version=2
        )
        attached_policies_response = self.iam_client.list_attached_role_policies(RoleName=NOTEBOOK_ROLE_NAME)
        assert len(attached_policies_response["AttachedPolicies"]) == 1
        assert self.iam_client.get_policy(
            PolicyArn=account_utils.account_arn_from_example_arn(
                TEST_PERMISSIONS_BOUNDARY_ARN, "iam", f"policy/{EXPECTED_TEST_DYNAMIC_POLICY_NAME}"
            )
        )

        # Test updating the policy
        self.iam_manager.update_dynamic_policy(
            policy,
            TEST_DYNAMIC_POLICY_NAME,
            "test-type",
            "test-type-1",
            on_create_attach_to_notebook_role=True,
        )
        attached_policies_response = self.iam_client.list_attached_role_policies(RoleName=NOTEBOOK_ROLE_NAME)
        assert len(attached_policies_response["AttachedPolicies"]) == 1
        assert self.iam_client.get_policy_version(
            PolicyArn=account_utils.account_arn_from_example_arn(
                TEST_PERMISSIONS_BOUNDARY_ARN, "iam", f"policy/{EXPECTED_TEST_DYNAMIC_POLICY_NAME}"
            ),
            VersionId="v2",
        )
