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

from typing import Dict
from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
MOCK_USERNAME = "jdoe@amazon.com"
MOCK_DISPLAY_NAME = "John Doe"
MOCK_TIMESTAMP = 1669931346

mock_context = mock.Mock()


@pytest.fixture
def mock_user():
    return UserModel(
        username=MOCK_USERNAME,
        email=MOCK_USERNAME,
        display_name="John Doe",
        suspended=False,
        permissions=[],
    )


with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.user.lambda_functions import login as lambda_handler


def _mock_event() -> Dict:
    return {
        "requestContext": {
            "authorizer": {
                "principalId": MOCK_USERNAME,
            }
        },
    }


def _assert_update_params(update_arg: Dict):
    assert update_arg["permissions"] == []
    assert update_arg["suspended"] is False
    assert update_arg["email"] == MOCK_USERNAME
    assert update_arg["displayName"] == MOCK_DISPLAY_NAME
    assert update_arg["lastLogin"] == MOCK_TIMESTAMP


@mock.patch("ml_space_lambda.user.lambda_functions.time")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_last_login_success(mock_user_dao, mock_time, mock_user):
    mock_user_dao.get.return_value = mock_user
    mock_time.time.return_value = 1669931346

    assert lambda_handler(_mock_event(), mock_context) == generate_html_response(
        200, mock_user.to_dict()
    )
    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    # The update arg is the UserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail
    mock_user_dao.update.assert_called_once()
    assert mock_user_dao.update.call_args.args[0] == MOCK_USERNAME
    _assert_update_params(mock_user_dao.update.call_args.args[1].to_dict())


@mock.patch("ml_space_lambda.user.lambda_functions.time")
@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_update_last_login_user_doesnt_exist(mock_user_dao, mock_time):
    mock_user_dao.get.return_value = None
    mock_time.time.return_value = 1669931346

    assert lambda_handler(_mock_event(), mock_context) == generate_html_response(
        404, "Specified user does not exist."
    )
    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
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
    assert lambda_handler(_mock_event(), mock_context) == generate_html_response(
        "400",
        "An error occurred (MissingParameter) when "
        "calling the GetItem operation: Dummy error message.",
    )
    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_user_dao.get_projects_for_user.assert_not_called()
    mock_user_dao.update.assert_not_called()
