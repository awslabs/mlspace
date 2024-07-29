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
from unittest import mock

import pytest

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.project.lambda_functions import add_groups as lambda_handler
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

PROJECT_NAME = "MyFakeProject"
GROUP_1 = GroupModel("group_1", "", "")
GROUP_2 = GroupModel("group_2", "", "")
GROUP_USER = GroupUserModel("sjobs", GROUP_1.name)


@pytest.mark.parametrize(
    "groups,dynamic_roles,group_users,iam_role_arn",
    [
        ([], False, [], None),
        ([GROUP_1], False, [GROUP_USER], None),
        ([GROUP_1, GROUP_2], False, [GROUP_USER], None),
        ([GROUP_1], True, [GROUP_USER], None),
        ([GROUP_1], True, [GROUP_USER], "arn:aws::012345678901:iam:role/my-fake-role"),
    ],
    ids=[
        "no_groups__no_dynamic_roles__no_group_users__no_iam_role_arn",
        "1_groups__no_dynamic_roles__1_group_users__no_iam_role_arn",
        "2_groups__no_dynamic_roles__1_group_users__no_iam_role_arn",
        "1_groups__yes_dynamic_roles__1_group_users__no_iam_role_arn",
        "1_groups__yes_dynamic_roles__1_group_users__yes_iam_role_arn",
    ],
)
@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.group_dao")
def test_project_groups(
    mock_group_dao,
    mock_project_group_dao,
    mock_group_user_dao,
    mock_iam_manager,
    groups,
    dynamic_roles,
    group_users,
    iam_role_arn,
):
    event = {
        "pathParameters": {"projectName": PROJECT_NAME},
        "body": json.dumps({"groupNames": [group.name for group in groups]}),
    }
    context = mock.MagicMock()

    mock_group_dao.get.side_effect = lambda group_name: next(x for x in groups if x.name == group_name)
    mock_group_user_dao.get_users_for_group.return_value = group_users
    mock_iam_manager.get_iam_role_arn.return_value = iam_role_arn

    expected_response = generate_html_response(200, f"Successfully added {len(groups)} user(s) to {PROJECT_NAME}")

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True" if dynamic_roles else ""}):
        mlspace_config.env_variables = {}
        assert lambda_handler(event, context) == expected_response

    mock_group_dao.get.assert_has_calls([mock.call(group.name) for group in groups])

    if dynamic_roles:
        # mock_group_user_dao.get_users_for_group.assert_called()
        mock_group_user_dao.get_users_for_group.assert_has_calls([mock.call(group_user.group) for group_user in group_users])
        mock_iam_manager.get_iam_role_arn.assert_has_calls(
            [mock.call(PROJECT_NAME, group_user.user) for group_user in group_users]
        )

        if iam_role_arn is None:
            mock_iam_manager.add_iam_role.assert_has_calls(
                [mock.call(PROJECT_NAME, group_user.user) for group_user in group_users]
            )
