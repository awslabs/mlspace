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

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

mock_user = UserModel(
    username="jdoe@amazon.com",
    display_name="John Doe",
    email="jdoe@amazon.com",
    suspended=False,
)

mock_event = {"requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}}}
mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.user.lambda_functions import current as lambda_handler


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_current_user(mock_user_dao):
    mock_user_dao.get.return_value = mock_user
    assert lambda_handler(mock_event, mock_context) == generate_html_response(200, mock_user.to_dict())

    mock_user_dao.get.assert_called_with(mock_user.username)


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_current_user_nonexistent(mock_user_dao):
    mock_user_dao.get.return_value = None
    assert lambda_handler(mock_event, mock_context) == generate_html_response(
        400,
        "Bad Request: Unable to retrieve user details.",
    )
    mock_user_dao.get.assert_called_with(mock_user.username)


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_current_user_client_error(mock_user_dao):
    mock_exception = ClientError(
        {
            "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "GetItem",
    )
    mock_user_dao.get.side_effect = mock_exception

    assert lambda_handler(mock_event, mock_context) == generate_html_response(
        400,
        "An error occurred (MissingParameter) when calling the " "GetItem operation: Dummy error message.",
    )

    mock_user_dao.get.assert_called_with(mock_user.username+'foo')


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_create_new_user_missing_parameters(mock_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'requestContext'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_user_dao.get.assert_not_called()
