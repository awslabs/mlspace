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

# Testing for the delete user Lambda function.
import os
from typing import List
from unittest import mock

from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "MANAGE_IAM_ROLES": "True",
}


mock_project_1_name = "example_project_one"
mock_project_2_name = "example_project_two"
mock_project_3_name = "example_project_three"

mock_user = UserModel(
    username="testUser101",
    display_name="Test User 101st",
    email="testUser101@amazon.com",
    suspended=False,
)

mock_event = {
    "pathParameters": {
        "username": mock_user.username,
    },
}
mock_context = mock.Mock()

mock_projects_for_user = [
    ProjectUserModel(
        username=mock_user.username,
        project_name=mock_project_1_name,
    ),
    ProjectUserModel(
        username=mock_user.username,
        project_name=mock_project_2_name,
        permissions=[Permission.PROJECT_OWNER],
    ),
    ProjectUserModel(
        username=mock_user.username,
        project_name=mock_project_3_name,
        permissions=[Permission.PROJECT_OWNER],
    ),
]

second_user = UserModel(
    username="jdoe@amazon.com",
    display_name="John Doe",
    email="jdoe@amazon.com",
    suspended=False,
)

mock_projects_for_second_user = [
    ProjectUserModel(
        username=mock_user.username,
        project_name=mock_project_1_name,
    ),
    ProjectUserModel(
        username=mock_user.username,
        project_name=mock_project_2_name,
        permissions=[Permission.PROJECT_OWNER],
    ),
    ProjectUserModel(
        username=mock_user.username,
        project_name=mock_project_3_name,
    ),
]


def _get_project_user_mock(project_name: str) -> List[str]:
    if project_name == mock_project_1_name:
        return [mock_projects_for_second_user[0], mock_projects_for_user[0]]
    elif project_name == mock_project_2_name:
        return [mock_projects_for_second_user[1], mock_projects_for_user[1]]
    elif project_name == mock_project_3_name:
        return [mock_projects_for_second_user[2], mock_projects_for_user[2]]
    return []


with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.user.lambda_functions import delete as delete_user


@mock.patch("ml_space_lambda.user.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_delete_user(mock_project_user_dao, mock_user_dao, mock_iam_manager):
    mock_project_user_dao.get_projects_for_user.return_value = mock_projects_for_second_user
    mock_project_user_dao.get_users_for_project.side_effect = _get_project_user_mock
    mock_user_dao.get.return_value = second_user
    mlspace_config.env_variables = {}

    expected_response = generate_html_response(200, f"User {second_user.username} deleted")
    mock_iam_manager.remove_all_user_roles.return_value = None
    with mock.patch.dict(os.environ, TEST_ENV_CONFIG, clear=True):
        assert (
            delete_user(
                {
                    "pathParameters": {
                        "username": second_user.username,
                    },
                },
                mock_context,
            )
            == expected_response
        )

    mock_project_user_dao.get_projects_for_user.assert_called_with(second_user.username)
    mock_project_user_dao.get_users_for_project.assert_called_with(mock_project_2_name)
    assert mock_project_user_dao.get_projects_for_user.call_count == 2
    mock_project_user_dao.delete.assert_has_calls(
        [
            mock.call(second_user.username, mock_project_1_name),
            mock.call(second_user.username, mock_project_2_name),
            mock.call(second_user.username, mock_project_3_name),
        ]
    )
    mock_iam_manager.remove_all_user_roles.assert_called_with(
        second_user.username, [mock_project_1_name, mock_project_2_name, mock_project_3_name]
    )
    mock_user_dao.get.assert_called_with(second_user.username)
    mock_user_dao.delete.assert_called_with(second_user.username)


@mock.patch("ml_space_lambda.user.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_delete_user_without_iam(mock_project_user_dao, mock_user_dao, mock_iam_manager):
    mock_project_user_dao.get_projects_for_user.return_value = mock_projects_for_second_user
    mock_project_user_dao.get_users_for_project.side_effect = _get_project_user_mock
    mock_user_dao.get.return_value = second_user
    mlspace_config.env_variables = {}

    expected_response = generate_html_response(200, f"User {second_user.username} deleted")
    mock_iam_manager.remove_all_user_roles.return_value = None
    with mock.patch.dict(os.environ, {}, clear=True):
        assert (
            delete_user(
                {
                    "pathParameters": {
                        "username": second_user.username,
                    },
                },
                mock_context,
            )
            == expected_response
        )

    mock_project_user_dao.get_projects_for_user.assert_called_with(second_user.username)
    mock_project_user_dao.get_users_for_project.assert_called_with(mock_project_2_name)
    assert mock_project_user_dao.get_projects_for_user.call_count == 2
    mock_project_user_dao.delete.assert_has_calls(
        [
            mock.call(second_user.username, mock_project_1_name),
            mock.call(second_user.username, mock_project_2_name),
            mock.call(second_user.username, mock_project_3_name),
        ]
    )
    mock_iam_manager.remove_all_user_roles.assert_not_called()
    mock_user_dao.get.assert_called_with(second_user.username)
    mock_user_dao.delete.assert_called_with(second_user.username)


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_delete_user_last_project_owner(mock_project_user_dao, mock_user_dao):
    mock_project_user_dao.get_projects_for_user.return_value = mock_projects_for_user
    mock_project_user_dao.get_users_for_project.side_effect = _get_project_user_mock
    mock_user_dao.get.return_value = mock_user

    expected_response = generate_html_response(
        400,
        f"Bad Request: User is the only owner of the following projects: {mock_project_3_name}. "
        "Please assign an additional owner before deleting the user.",
    )
    assert delete_user(mock_event, mock_context) == expected_response
    mock_user_dao.get.assert_called_with(mock_user.username)
    mock_project_user_dao.get_projects_for_user.assert_called_with(mock_user.username)
    # We don't expect a call to get the users for the first project because the user
    # isn't an owner and we short circuit before grabbing the user list
    mock_project_user_dao.get_users_for_project.assert_has_calls(
        [
            mock.call(mock_project_2_name),
            mock.call(mock_project_3_name),
        ]
    )
    mock_user_dao.remove.assert_not_called()


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_delete_user_nonexistent(mock_project_user_dao, mock_user_dao):
    expected_response = generate_html_response(
        404,
        "Specified user does not exist.",
    )
    mock_user_dao.get.return_value = None
    assert delete_user(mock_event, mock_context) == expected_response
    mock_user_dao.get.assert_called_with(mock_user.username)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_user_dao.remove.assert_not_called()


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_delete_user_client_error(mock_project_user_dao, mock_user_dao):
    mock_user_dao.get.side_effect = ClientError(
        {
            "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
            "ResponseMetadata": {"HTTPStatusCode": "400"},
        },
        "GetItem",
    )
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the " "GetItem operation: Dummy error message.",
    )
    assert delete_user(mock_event, mock_context) == expected_response
    mock_user_dao.get.assert_called_with(mock_user.username)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_user_dao.remove.assert_not_called()


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_delete_user_missing_params(mock_project_user_dao, mock_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert delete_user({}, mock_context) == expected_response
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_user_dao.get.assert_not_called()
    mock_user_dao.delete.assert_not_called()
