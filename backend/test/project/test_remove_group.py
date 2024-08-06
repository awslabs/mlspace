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

import pytest

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.project_group import ProjectGroupModel
from ml_space_lambda.project.lambda_functions import remove_group as lambda_handler
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

PROJECT_NAME = "MyFakeProject"
GROUP_1 = GroupModel("group_1", "", "")
GROUP_USER = GroupUserModel("sjobs", GROUP_1.name)
PROJECT_GROUP = ProjectGroupModel(GROUP_1.name, PROJECT_NAME)


@pytest.mark.parametrize(
    "project_group,dynamic_roles,is_member,iam_role_arn",
    [
        (None, False, False, None),
        (None, True, False, None),
        (None, False, True, None),
        (None, True, True, None),
        (None, True, False, "arn:aws::012345678901:iam:role/my-fake-role"),
        (None, True, True, "arn:aws::012345678901:iam:role/my-fake-role"),
        (PROJECT_GROUP, False, False, None),
        (PROJECT_GROUP, True, False, None),
        (PROJECT_GROUP, False, True, None),
        (PROJECT_GROUP, True, True, None),
        (PROJECT_GROUP, True, False, "arn:aws::012345678901:iam:role/my-fake-role"),
        (PROJECT_GROUP, True, True, "arn:aws::012345678901:iam:role/my-fake-role"),
    ],
    ids=[
        "no_project_group__no_dynamic_roles__no_is_member__no_iam_role",
        "no_project_group__yes_dynamic_roles__no_is_member__no_iam_role",
        "no_project_group__no_dynamic_roles__yes_is_member__no_iam_role",
        "no_project_group__yes_dynamic_roles__yes_is_member__no_iam_role",
        "no_project_group__yes_dynamic_roles__no_is_member__yes_iam_role",
        "no_project_group__yes_dynamic_roles__yes_is_member__yes_iam_role",
        "yes_project_group__no_dynamic_roles__no_is_member__no_iam_role",
        "yes_project_group__yes_dynamic_roles__no_is_member__no_iam_role",
        "yes_project_group__no_dynamic_roles__yes_is_member__no_iam_role",
        "yes_project_group__yes_dynamic_roles__yes_is_member__no_iam_role",
        "yes_project_group__yes_dynamic_roles__no_is_member__yes_iam_role",
        "yes_project_group__yes_dynamic_roles__yes_is_member__yes_iam_role",
    ],
)
@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.is_member_of_project")
@mock.patch("ml_space_lambda.project.lambda_functions.cleanup_user_resources")
@mock.patch("ml_space_lambda.project.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_group_dao")
def test_project_groups(
    mock_project_group_dao,
    mock_group_user_dao,
    mock_cleanup_user_resources,
    mock_is_member_of_project,
    mock_iam_manager,
    project_group,
    dynamic_roles,
    is_member,
    iam_role_arn,
):
    event = {"pathParameters": {"projectName": PROJECT_NAME, "groupName": GROUP_1.name}, "body": "{}"}
    context = mock.MagicMock()

    mock_project_group_dao.get.return_value = project_group
    mock_group_user_dao.get_users_for_group.return_value = [GROUP_USER]
    mock_is_member_of_project.return_value = is_member
    mock_iam_manager.get_iam_role_arn.return_value = iam_role_arn

    if project_group is None:
        expected_response = generate_html_response(400, f"Bad Request: {GROUP_1.name} is not a member of {PROJECT_NAME}")
    else:
        expected_response = generate_html_response(200, f"Successfully removed {GROUP_1.name} from {PROJECT_NAME}")

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True" if dynamic_roles else ""}):
        mlspace_config.env_variables = {}
        assert lambda_handler(event, context) == expected_response

    if project_group:
        mock_project_group_dao.get.assert_called_with(PROJECT_NAME, GROUP_1.name)
        mock_group_user_dao.get_users_for_group.assert_called_with(GROUP_1.name)
        mock_cleanup_user_resources.assert_called_with(PROJECT_NAME, [GROUP_USER.user])

        if dynamic_roles:
            mock_is_member_of_project.assert_called_with(GROUP_USER.user, PROJECT_NAME)

            if not is_member:
                mock_iam_manager.get_iam_role_arn.assert_called_with(PROJECT_NAME, GROUP_USER.user)
                if iam_role_arn:
                    mock_iam_manager.remove_project_user_roles([iam_role_arn])
