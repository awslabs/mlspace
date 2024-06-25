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

from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import group_users as lambda_handler

MOCK_GROUP_NAME = "example_group"
mock_event = {
    "pathParameters": {
        "groupName": MOCK_GROUP_NAME,
    },
}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
def test_list_users_for_group_success(mock_group_user_dao):
    group_users = [
        GroupUserModel(
            group_name=MOCK_GROUP_NAME,
            username="jdoe@amazon.com",
            permissions=[Permission.GROUP_OWNER],
        ),
        GroupUserModel(
            group_name=MOCK_GROUP_NAME,
            username="jane@amazon.com",
            permissions=[Permission.COLLABORATOR],
        ),
        GroupUserModel(
            group_name=MOCK_GROUP_NAME,
            username="bobf",
            permissions=[Permission.COLLABORATOR],
        ),
    ]
    expected_response = generate_html_response(
        200,
        [record.to_dict() for record in group_users],
    )
    mock_group_user_dao.get_users_for_group.return_value = group_users

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_user_dao.get_users_for_group.assert_called_with(MOCK_GROUP_NAME)


@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
def test_list_users_for_group_client_error(mock_group_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the Scan operation: Dummy error message.",
    )
    mock_group_user_dao.get_users_for_group.side_effect = ClientError(error_msg, "Scan")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_user_dao.get_users_for_group.assert_called_with(MOCK_GROUP_NAME)


@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
def test_list_users_for_group_missing_parameters(mock_group_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_group_user_dao.get_users_for_group.assert_not_called()
