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
from typing import Any, Dict, List
from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
MOCK_USERNAME = "jdoe@amazon.com"
MOCK_PROJECT_NAME = "UnitTestProject"

mock_context = mock.Mock()


@pytest.fixture
def mock_project_user():
    return ProjectUserModel(
        username=MOCK_USERNAME,
        project_name=MOCK_PROJECT_NAME,
        permissions=[Permission.PROJECT_OWNER],
    )


MOCK_SUCCESS = generate_html_response(200, "Successfuly updated project user record.")

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import update_project_user as lambda_handler


def _mock_event(updates: Dict[str, Any]) -> Dict:
    return {
        "pathParameters": {
            "projectName": MOCK_PROJECT_NAME,
            "username": MOCK_USERNAME,
        },
        "body": json.dumps(updates),
    }


def _assert_update_params(update_arg: Dict, expected_permissions: List[str]):
    assert update_arg["user"] == MOCK_USERNAME
    assert update_arg["project"] == MOCK_PROJECT_NAME
    assert sorted(update_arg["permissions"]) == sorted(expected_permissions)
    assert update_arg["role"] == ""


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_update_project_user_add_permission(mock_project_user_dao, mock_project_user):
    mock_project_user_dao.get.return_value = mock_project_user

    assert (
        lambda_handler(
            _mock_event({"permissions": [Permission.COLLABORATOR, Permission.PROJECT_OWNER]}),
            mock_context,
        )
        == MOCK_SUCCESS
    )

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    mock_project_user_dao.update.assert_called_once()
    assert mock_project_user_dao.update.call_args.args[0] == MOCK_PROJECT_NAME
    assert mock_project_user_dao.update.call_args.args[1] == MOCK_USERNAME
    _assert_update_params(
        mock_project_user_dao.update.call_args.args[2].to_dict(),
        [Permission.COLLABORATOR, Permission.PROJECT_OWNER],
    )


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_update_project_user_remove_owner(mock_project_user_dao, mock_project_user):
    mock_project_user_dao.get.return_value = mock_project_user
    mock_project_user_dao.get_users_for_project.return_value = [
        mock_project_user,
        ProjectUserModel(
            username="owner@amazon.com",
            project_name=MOCK_PROJECT_NAME,
            permissions=[Permission.PROJECT_OWNER],
        ),
    ]

    assert lambda_handler(_mock_event({"permissions": [Permission.COLLABORATOR]}), mock_context) == MOCK_SUCCESS

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_called_with(MOCK_PROJECT_NAME)
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    mock_project_user_dao.update.assert_called_once()
    assert mock_project_user_dao.update.call_args.args[0] == MOCK_PROJECT_NAME
    assert mock_project_user_dao.update.call_args.args[1] == MOCK_USERNAME
    _assert_update_params(
        mock_project_user_dao.update.call_args.args[2].to_dict(),
        [Permission.COLLABORATOR],
    )


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_update_project_user_permissions_noop(mock_project_user_dao, mock_project_user):
    mock_project_user_dao.get.return_value = mock_project_user

    assert (
        lambda_handler(
            _mock_event({"permissions": [Permission.PROJECT_OWNER]}),
            mock_context,
        )
        == MOCK_SUCCESS
    )

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_project_user_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_update_project_user_remove_last_owner(mock_project_user_dao, mock_project_user):
    mock_project_user_dao.get.return_value = mock_project_user
    mock_project_user_dao.get_users_for_project.return_value = [mock_project_user]
    expected_response = generate_html_response(400, f"Bad Request: Cannot remove last Project Owner from {MOCK_PROJECT_NAME}.")
    assert lambda_handler(_mock_event({"permissions": [Permission.COLLABORATOR]}), mock_context) == expected_response

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_user_dao.update.asser_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_update_project_user_nonexistent(mock_project_user_dao):
    mock_project_user_dao.get.return_value = None

    assert lambda_handler(_mock_event({"permissions": [Permission.COLLABORATOR]}), mock_context) == generate_html_response(
        404, f"User {MOCK_USERNAME} is not a member of {MOCK_PROJECT_NAME}"
    )

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_project_user_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_update_project_user_permissions_unknown_value(mock_project_user_dao, mock_project_user):
    mock_project_user_dao.get.return_value = mock_project_user
    expected_response = generate_html_response(400, "Bad Request: 'UNICORN' is not a valid Permission")

    assert (
        lambda_handler(_mock_event({"permissions": [Permission.PROJECT_OWNER, "UNICORN"]}), mock_context) == expected_response
    )

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_project_user_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def est_update_project_user_client_error(mock_project_user_dao):
    mock_exception = ClientError(
        {
            "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
            "ResponseMetadata": {"HTTPStatusCode": "400"},
        },
        "GetItem",
    )
    mock_project_user_dao.get.side_effect = mock_exception
    assert lambda_handler(_mock_event({"permissions": [Permission.COLLABORATOR]}), mock_context) == generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the " "GetItem operation: Dummy error message.",
    )
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_project_user_dao.update.assert_not_called()
