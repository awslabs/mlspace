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

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import delete as lambda_handler

MOCK_GROUP_NAME = "UnitTestGroup"
MOCK_GROUP = GroupModel(MOCK_GROUP_NAME, "Group for unit tests", "John Doe")

mock_event = {
    "requestContext": {"authorizer": {"principalId": "jdoe@example.com"}},
    "pathParameters": {"groupName": MOCK_GROUP_NAME},
}

mock_context = mock.Mock()


@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_delete_group(mock_group_dao, mock_group_user_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully deleted {MOCK_GROUP_NAME}.")
    mock_group_dao.get.return_value = MOCK_GROUP

    mock_username = "jdoe@example.com"
    mock_group_user_dao.get_users_for_group.return_value = [
        GroupUserModel(
            username=mock_username,
            group_name=MOCK_GROUP_NAME,
            permissions=[Permission.COLLABORATOR],
        )
    ]
    mock_group_user_dao.delete.return_value = None

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)
    mock_group_dao.delete.assert_called_with(MOCK_GROUP_NAME)
    mock_group_user_dao.get_users_for_group.assert_called_with(MOCK_GROUP_NAME)
    mock_group_user_dao.delete.assert_called_with(MOCK_GROUP_NAME, mock_username)
    mock_iam_manager.update_user_policy.assert_called_with(mock_username)


@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_delete_group_nonexistent(mock_group_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(
        400,
        "Bad Request: Specified group does not exist",
    )
    mock_group_dao.get.return_value = None
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)
    mock_group_dao.delete.assert_not_called()
    mock_iam_manager.update_user_policy.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_delete_group_client_error(mock_group_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    mock_group_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)
    mock_group_dao.delete.assert_not_called()
    mock_iam_manager.update_user_policy.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_delete_group_missing_param(mock_group_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_group_dao.get.assert_not_called()
    mock_group_dao.delete.assert_not_called()
    mock_iam_manager.update_user_policy.assert_not_called()
