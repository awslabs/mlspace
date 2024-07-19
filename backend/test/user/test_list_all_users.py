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

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.user.lambda_functions import list_all as lambda_handler

mock_context = mock.Mock()


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_list_all(mock_user_dao):
    all_users = [
        UserModel(
            username="TestUser2",
            email="test2@amazon.com",
            display_name="Test User2",
            suspended=False,
        ),
        UserModel(
            username="TestUser3",
            email="test3@amazon.com",
            display_name="Test User3",
            suspended=False,
        ),
    ]
    mock_user_dao.get_all.return_value = all_users

    assert lambda_handler({}, mock_context) == generate_html_response(200, [user.to_dict() for user in all_users])

    mock_user_dao.get_all.assert_called_with(include_suspended=False)


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_list_all_include_suspended(mock_user_dao):
    all_users = [
        UserModel(
            username="TestUser1",
            email="test1@amazon.com",
            display_name="Test User1",
            suspended=True,
        ),
        UserModel(
            username="TestUser2",
            email="test2@amazon.com",
            display_name="Test User2",
            suspended=False,
        ),
        UserModel(
            username="TestUser3",
            email="test3@amazon.com",
            display_name="Test User3",
            suspended=False,
        ),
    ]
    mock_user_dao.get_all.return_value = all_users

    assert lambda_handler({"queryStringParameters": {"includeSuspended": "true"}}, mock_context) == generate_html_response(200, [user.to_dict() for user in all_users])

    mock_user_dao.get_all.assert_called_with(include_suspended=True)


@mock.patch("ml_space_lambda.user.lambda_functions.user_dao")
def test_list_all_client_error(mock_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )
    mock_user_dao.get_all.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler({}, mock_context) == expected_response
    mock_user_dao.get_all.assert_called_with(include_suspended=False)
