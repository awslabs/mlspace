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

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

MOCK_USER = UserModel("jdoe@example.com", "jdoe@example.com", "John Doe", False)
MOCK_GROUP_1 = GroupModel("TestGroup1", "test group 1", MOCK_USER.username)
MOCK_GROUP_2 = GroupModel("TestGroup2", "test group 2", MOCK_USER.username)
MOCK_GROUPS = [MOCK_GROUP_1, MOCK_GROUP_2]

mock_event = {
    "requestContext": {
        "authorizer": {
            "principalId": MOCK_USER.username,
            "user": json.dumps(MOCK_USER.to_dict()),
        }
    },
    "pathParameters": {"username": MOCK_USER.username},
}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.user.lambda_functions import get_groups as lambda_handler


@mock.patch("ml_space_lambda.user.lambda_functions.group_user_dao")
def test_get_user_groups(group_user_dao):
    group_user_dao.get_groups_for_user.return_value = MOCK_GROUPS
    expected_response = generate_html_response(200, [group.to_dict() for group in MOCK_GROUPS])

    assert lambda_handler(mock_event, mock_context) == expected_response
    group_user_dao.get_groups_for_user.assert_called_with(MOCK_USER.username)


@mock.patch("ml_space_lambda.user.lambda_functions.group_user_dao")
def test_get_user_groups_no_groups_found(group_user_dao):
    group_user_dao.get_groups_for_user.return_value = []
    expected_response = generate_html_response(200, [])

    assert lambda_handler(mock_event, mock_context) == expected_response
    group_user_dao.get_groups_for_user.assert_called_with(MOCK_USER.username)


@mock.patch("ml_space_lambda.user.lambda_functions.group_user_dao")
def test_get_user_groups_client_error(group_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    group_user_dao.get_groups_for_user.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(mock_event, mock_context) == expected_response
    group_user_dao.get_groups_for_user.assert_called_with(MOCK_USER.username)
