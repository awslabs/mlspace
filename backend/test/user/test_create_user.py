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
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.user import TIMEZONE_PREFERENCE_KEY, UserModel
from ml_space_lambda.enums import TimezonePreference
from ml_space_lambda.utils.common_functions import generate_html_response, serialize_permissions

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

mock_context = mock.Mock()


@pytest.fixture
def mock_user():
    return UserModel(
        username="testUser101",
        display_name="Test User 101st",
        email="testUser101@amazon.com",
        suspended=True,
    )


@pytest.fixture
def mock_event(mock_user):
    return {
        "body": json.dumps(
            {
                "username": mock_user.username,
                "name": mock_user.display_name,
                "email": mock_user.email,
            }
        ),
    }


with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.user.lambda_functions import create


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_create_new_user_success(mock_user_dao, mock_user, mock_event):
    mock_user_dao.get.return_value = None
    actual_response = create(mock_event, mock_context)
    response_body = json.loads(actual_response["body"])

    mock_user_dao.get.assert_called_with(mock_user.username)
    mock_user_dao.create.assert_called_once()
    create_args = mock_user_dao.create.call_args.args[0].to_dict()

    assert create_args["username"] == response_body["username"] == mock_user.username
    assert create_args["email"] == response_body["email"] == mock_user.email
    assert create_args["displayName"] == response_body["displayName"] == mock_user.display_name
    assert (
        create_args["permissions"]
        == response_body["permissions"]
        == serialize_permissions(mock_user.permissions)
    )
    assert create_args["suspended"] == response_body["suspended"] == mock_user.suspended
    assert (
        create_args["preferences"]
        == response_body["preferences"]
        == {TIMEZONE_PREFERENCE_KEY: TimezonePreference.LOCAL.value}
    )
    # Ocassionally the tests and mocks may wind up off by 1 second so handle that instead of looking
    # for exact equality
    assert abs(response_body["lastLogin"] >= mock_user.last_login) <= 1
    assert abs(response_body["lastLogin"] - mock_user.created_at) <= 1


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_create_new_user_already_present(mock_user_dao, mock_user, mock_event):
    mock_user_dao.get.return_value = mock_user
    expected_response = generate_html_response(
        400,
        "Bad Request: Username in use.",
    )
    assert create(mock_event, mock_context) == expected_response
    mock_user_dao.get.assert_called_with(mock_user.username)
    mock_user_dao.create.assert_not_called()


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_create_new_user_client_error(mock_user_dao, mock_user, mock_event):
    mock_exception = ClientError(
        {
            "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "GetItem",
    )
    expected_response = generate_html_response(
        400,
        "An error occurred (MissingParameter) when calling the "
        "GetItem operation: Dummy error message.",
    )
    mock_user_dao.get.side_effect = mock_exception
    assert create(mock_event, mock_context) == expected_response
    mock_user_dao.get.assert_called_with(mock_user.username)
    mock_user_dao.create.assert_not_called()


def test_create_new_user_missing_parameters():
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert create({}, mock_context) == expected_response
