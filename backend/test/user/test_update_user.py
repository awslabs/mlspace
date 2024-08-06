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

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
MOCK_USERNAME = "jdoe@amazon.com"
MOCK_DISPLAY_NAME = "John Doe"

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from botocore.exceptions import ClientError

    from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
    from ml_space_lambda.data_access_objects.user import TIMEZONE_PREFERENCE_KEY, UserModel
    from ml_space_lambda.enums import Permission, TimezonePreference
    from ml_space_lambda.user.lambda_functions import update as lambda_handler
    from ml_space_lambda.utils.common_functions import generate_html_response

mock_context = mock.Mock()


def base_user():
    return UserModel(
        username=MOCK_USERNAME,
        email=MOCK_USERNAME,
        display_name=MOCK_DISPLAY_NAME,
        suspended=False,
        permissions=[],
    )


@pytest.fixture
def mock_user():
    return base_user()


def mock_success(mock_event):
    return generate_html_response(200, json.loads(mock_event["body"]))


def _mock_event(updates: Dict[str, Any] = {}, is_admin=True, user=base_user()) -> Dict:
    user_dict = user.to_dict()
    user_dict.update(updates)

    return {
        "pathParameters": {
            "username": MOCK_USERNAME,
        },
        "requestContext": {
            "authorizer": {
                "user": json.dumps(
                    UserModel(
                        MOCK_USERNAME,
                        MOCK_USERNAME,
                        MOCK_DISPLAY_NAME,
                        False,
                        [Permission.ADMIN] if is_admin else [],
                    ).to_dict()
                ),
            }
        },
        "body": json.dumps(user_dict),
    }


def _assert_update_params(
    update_arg: Dict,
    expected_permissions: List[str],
    expected_suspension_value: bool,
    expected_preferences_value: TimezonePreference,
):
    assert update_arg["permissions"] == expected_permissions
    assert update_arg["suspended"] == expected_suspension_value
    assert update_arg["preferences"] == expected_preferences_value
    assert update_arg["email"] == MOCK_USERNAME
    assert update_arg["displayName"] == MOCK_DISPLAY_NAME


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_modify_permissions(mock_user_dao, mock_project_user_dao, mock_user):
    mock_user_dao.get.return_value = mock_user
    mock_event = _mock_event({"permissions": [Permission.PROJECT_OWNER]}, mock_user)

    assert lambda_handler(mock_event, mock_context) == mock_success(mock_event)

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    mock_user_dao.update.assert_called_once()
    assert mock_user_dao.update.call_args.args[0] == MOCK_USERNAME
    _assert_update_params(
        mock_user_dao.update.call_args.args[1].to_dict(),
        [Permission.PROJECT_OWNER],
        False,
        {},
    )


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_modify_preferences(mock_user_dao, mock_project_user_dao, mock_user):
    mock_user_dao.get.return_value = mock_user
    mock_event = _mock_event(
        {
            "preferences": {TIMEZONE_PREFERENCE_KEY: TimezonePreference.UTC},
            "permissions": [Permission.PROJECT_OWNER],
        }
    )

    assert lambda_handler(
        mock_event,
        mock_context,
    ) == mock_success(mock_event)

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    mock_user_dao.update.assert_called_once()
    assert mock_user_dao.update.call_args.args[0] == MOCK_USERNAME
    _assert_update_params(
        mock_user_dao.update.call_args.args[1].to_dict(),
        [Permission.PROJECT_OWNER],
        False,
        {TIMEZONE_PREFERENCE_KEY: TimezonePreference.UTC},
    )


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_modify_preferences_non_admin(mock_user_dao, mock_project_user_dao, mock_user):
    mock_user = base_user()
    mock_user_dao.get.return_value = mock_user
    mock_event = _mock_event(
        {
            "preferences": {TIMEZONE_PREFERENCE_KEY: TimezonePreference.UTC},
            "permissions": [Permission.PROJECT_OWNER],
            "suspended": True,
        },
        False,
    )

    assert lambda_handler(
        mock_event,
        mock_context,
    ) == mock_success(mock_event)

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    mock_user_dao.update.assert_called_once()
    assert mock_user_dao.update.call_args.args[0] == MOCK_USERNAME
    _assert_update_params(
        mock_user_dao.update.call_args.args[1].to_dict(),
        [],  # this should remain the same since the invoking user can't change permissions
        False,
        {TIMEZONE_PREFERENCE_KEY: TimezonePreference.UTC},
    )


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_suspend(mock_user_dao, mock_project_user_dao, mock_user):
    mock_user_dao.get.return_value = mock_user
    mock_project_user_dao.get_projects_for_user.return_value = []
    mock_event = _mock_event({"suspended": True})

    assert lambda_handler(mock_event, mock_context) == mock_success(mock_event)

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_called_with(MOCK_USERNAME)
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    mock_user_dao.update.assert_called_once()
    assert mock_user_dao.update.call_args.args[0] == MOCK_USERNAME
    _assert_update_params(mock_user_dao.update.call_args.args[1].to_dict(), [], True, {})


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_reinstate(mock_user_dao, mock_project_user_dao):
    mock_user_dao.get.return_value = UserModel(
        username="jdoe@amazon.com",
        email="jdoe@amazon.com",
        display_name=MOCK_DISPLAY_NAME,
        suspended=True,
        permissions=[Permission.ADMIN],
    )
    mock_event = _mock_event({"suspended": False})

    assert lambda_handler(mock_event, mock_context) == mock_success(mock_event)

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    assert mock_user_dao.update.call_args.args[0] == MOCK_USERNAME
    _assert_update_params(mock_user_dao.update.call_args.args[1].to_dict(), [], False, {})


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_reinstate_active_user_noop(mock_user_dao, mock_project_user_dao, mock_user):
    mock_user_dao.get.return_value = mock_user
    mock_event = _mock_event({"suspended": False})

    assert lambda_handler(
        mock_event,
        mock_context,
    ) == mock_success(mock_event)

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_user_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_suspend_user_extra_fields(mock_user_dao, mock_project_user_dao, mock_user):
    mock_user_dao.get.return_value = mock_user
    mock_project_user_dao.get_projects_for_user.return_value = []
    mock_event = _mock_event(
        # Sending values for email and display name should be ignored
        {"suspended": True, "displayName": "Updated Name"},
        mock_user,
    )

    assert lambda_handler(
        mock_event,
        mock_context,
    ) == mock_success(mock_event)

    mock_project_user_dao.get_projects_for_user.assert_called_with(MOCK_USERNAME)
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    mock_user_dao.update.assert_called_once()
    assert mock_user_dao.update.call_args.args[0] == MOCK_USERNAME
    _assert_update_params(mock_user_dao.update.call_args.args[1].to_dict(), [], True, {})


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_suspend_last_owner(mock_user_dao, mock_project_user_dao, mock_user):
    mock_project_name = "UnitTestProject"
    mock_user_dao.get.return_value = mock_user
    mock_project_user = ProjectUserModel(
        project_name=mock_project_name,
        username=MOCK_USERNAME,
        permissions=[Permission.PROJECT_OWNER],
    )
    mock_project_user_dao.get_projects_for_user.return_value = [mock_project_user]
    mock_project_user_dao.get_users_for_project.return_value = [mock_project_user]
    expected_response = generate_html_response(
        400, f"Bad Request: User is last MO on the following projects: {mock_project_name}"
    )
    assert lambda_handler(_mock_event({"suspended": True}), mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_called_with(mock_project_name)
    mock_user_dao.update.asser_not_called()


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_nonexistent(mock_user_dao, mock_project_user_dao, mock_user):
    mock_user_dao.get.return_value = None
    event = _mock_event({"suspended": True})
    expected_response = generate_html_response(404, "Specified user does not exist.")
    assert lambda_handler(event, mock_context) == expected_response
    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_user_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_modify_permissions_unknown_value(mock_user_dao, mock_project_user_dao, mock_user):
    mock_user_dao.get.return_value = mock_user
    expected_response = generate_html_response(400, "Bad Request: 'UNICORN' is not a valid Permission")
    assert lambda_handler(_mock_event(updates={"permissions": ["UNICORN"]}), mock_context) == expected_response
    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_user_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_user_client_error(mock_user_dao, mock_project_user_dao):
    mock_exception = ClientError(
        {
            "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
            "ResponseMetadata": {"HTTPStatusCode": "400"},
        },
        "GetItem",
    )
    mock_user_dao.get.side_effect = mock_exception
    assert lambda_handler(_mock_event({"suspended": True}, mock_user), mock_context) == generate_html_response(
        "400",
        "An error occurred (MissingParameter) when " "calling the GetItem operation: Dummy error message.",
    )
    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_user_dao.update.assert_not_called()
