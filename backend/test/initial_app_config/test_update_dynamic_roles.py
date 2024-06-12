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

from ml_space_lambda.utils import mlspace_config

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "SYSTEM_TAG": "MLSpace",
    "JOB_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::123456789012:policy/notebook-job-constraints",
    "ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::123456789012:policy/notebook-endpoint-constraints",
}

mock_context = mock.Mock()
mock_event = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.initial_app_config.lambda_function import update_dynamic_roles


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.initial_app_config.lambda_function.iam")
def test_initial_config_success(mock_iam):
    # Clear out previously cached env variables
    mlspace_config.env_variables = {}

    paginator = mock.Mock()
    paginator.paginate.return_value = [{"Roles": [{"RoleName": "role1"}, {"RoleName": "role2"}, {"RoleName": "role3"}]}]
    mock_iam.get_paginator.return_value = paginator
    mock_iam.list_role_tags.side_effect = [
        {"Tags": []},
        {
            "Tags": [
                {"Key": "user", "Value": "MLSpaceApplication"},
                {"Key": "system", "Value": "MLSpace"},
                {"Key": "project", "Value": "project"},
            ]
        },
        {
            "Tags": [
                {"Key": "user", "Value": "user"},
                {"Key": "system", "Value": "MLSpace"},
                {"Key": "project", "Value": "project"},
            ]
        },
    ]

    update_dynamic_roles()

    mock_iam.attach_role_policy.assert_has_calls(
        [
            mock.call(RoleName="role3", PolicyArn=TEST_ENV_CONFIG["JOB_INSTANCE_CONSTRAINT_POLICY_ARN"]),
            mock.call(RoleName="role3", PolicyArn=TEST_ENV_CONFIG["ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN"]),
        ]
    )

    mock_iam.tag_role.assert_has_calls([mock.call(RoleName="role3", Tags=[{"Key": "dynamic-user-role", "Value": "true"}])])
