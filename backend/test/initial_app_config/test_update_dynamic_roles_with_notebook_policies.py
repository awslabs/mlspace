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

from unittest import mock

from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.iam_manager import DYNAMIC_USER_ROLE_TAG

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    EnvVariable.SYSTEM_TAG.value: "MLSpace",
    EnvVariable.JOB_INSTANCE_CONSTRAINT_POLICY_ARN.value: "arn:aws:iam::123456789012:policy/notebook-job-constraints",
    EnvVariable.ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN.value: "arn:aws:iam::123456789012:policy/notebook-endpoint-constraints",
    EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN.value: "arn:aws:iam:12345678912:policy/kms-instance-conditions",
}

mock_context = mock.Mock()
mock_event = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.initial_app_config.lambda_function import update_dynamic_roles_with_notebook_policies


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.initial_app_config.lambda_function.iam")
def test_initial_config_success(mock_iam):
    # Clear out previously cached env variables
    mlspace_config.env_variables = {}

    paginator = mock.Mock()
    paginator.paginate.return_value = [
        {
            "Roles": [
                {"RoleName": "MLSpace-myproject1-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa"},
                {"RoleName": "MLSpace-myproject2-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa"},
                {"RoleName": "MLSpace-myproject3-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa"},
                {"RoleName": "MLSpace-myproject4-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa"},
            ]
        }
    ]
    mock_iam.get_paginator.return_value = paginator
    mock_iam.list_role_tags.side_effect = [
        {"Tags": []},
        {
            "Tags": [
                {"Key": "user", "Value": "MLSpaceApplication"},
                {"Key": "system", "Value": "MLSpace"},
                {"Key": "project", "Value": "myproject2"},
            ]
        },
        {
            "Tags": [
                {"Key": "user", "Value": "someuser"},
                {"Key": "system", "Value": "MLSpace"},
                {"Key": "project", "Value": "myproject3"},
            ]
        },
        {"Tags": [DYNAMIC_USER_ROLE_TAG]},
    ]

    update_dynamic_roles_with_notebook_policies(mock.Mock(), mock.Mock())

    mock_iam.attach_role_policy.assert_has_calls(
        [
            mock.call(
                RoleName="MLSpace-myproject3-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa",
                PolicyArn=TEST_ENV_CONFIG[EnvVariable.JOB_INSTANCE_CONSTRAINT_POLICY_ARN.value],
            ),
            mock.call(
                RoleName="MLSpace-myproject3-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa",
                PolicyArn=TEST_ENV_CONFIG[EnvVariable.ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN.value],
            ),
            mock.call(
                RoleName="MLSpace-myproject3-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa",
                PolicyArn=TEST_ENV_CONFIG[EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN.value],
            ),
            mock.call(
                RoleName="MLSpace-myproject4-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa",
                PolicyArn=TEST_ENV_CONFIG[EnvVariable.JOB_INSTANCE_CONSTRAINT_POLICY_ARN.value],
            ),
            mock.call(
                RoleName="MLSpace-myproject4-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa",
                PolicyArn=TEST_ENV_CONFIG[EnvVariable.ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN.value],
            ),
            mock.call(
                RoleName="MLSpace-myproject4-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa",
                PolicyArn=TEST_ENV_CONFIG[EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN.value],
            ),
        ]
    )

    mock_iam.tag_role.assert_has_calls(
        [
            mock.call(
                RoleName="MLSpace-myproject3-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa", Tags=[DYNAMIC_USER_ROLE_TAG]
            ),
            mock.call(
                RoleName="MLSpace-myproject4-0fb265a4573777a0442ec4c6edeaf707216a2f5b16aa", Tags=[DYNAMIC_USER_ROLE_TAG]
            ),
        ]
    )
