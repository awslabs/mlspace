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
from typing import Dict, Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
MOCK_USERNAME = "jdoe"
MOCK_GROUPS = [
    GroupModel(
        name="example_group_1",
        description="example description 1",
        created_by="polly@example.com",
        num_members=1,
    ),
    GroupModel(
        name="example_group_2",
        description="example description 2",
        created_by="finn@example.com",
        num_members=1,
    ),
    GroupModel(
        name="example_group_3",
        description="example description 3",
        created_by="finn@example.com",
        num_members=1,
    ),
    GroupModel(
        name="example_group_4",
        description="example description 4",
        created_by="gina@example.com",
        num_members=1,
    ),
]

MOCK_GROUP_USERS = [
    GroupUserModel(group_name=MOCK_GROUPS[1].name, username=MOCK_USERNAME),
    GroupUserModel(group_name=MOCK_GROUPS[2].name, username=MOCK_USERNAME),
]


with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import list_all as lambda_handler

mock_context = mock.Mock()


def mock_event(is_admin: bool = False, query_params: Optional[Dict[str, str]] = None):
    return {
        "requestContext": {
            "authorizer": {
                "principalId": MOCK_USERNAME,
                "user": json.dumps(
                    UserModel(
                        MOCK_USERNAME,
                        "jdoe@amazon.com",
                        "John Doe",
                        False,
                        [Permission.ADMIN] if is_admin else [],
                    ).to_dict()
                ),
            }
        },
        "pathParameters": None,
        "queryStringParameters": query_params,
    }


# TODO: numMembers should match


@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_list_all_groups_admin_is_in(mock_group_dao, mock_group_user_dao):
    mock_group_dao.get_all.return_value = MOCK_GROUPS
    mock_group_user_dao.get_groups_for_user.return_value = MOCK_GROUP_USERS
    mock_group_user_dao.get_users_for_group.return_value = [GroupUserModel(group_name="some-group", username=MOCK_USERNAME)]

    expected_response = generate_html_response(
        200,
        [group.to_dict() for group in MOCK_GROUPS],
    )

    assert lambda_handler(mock_event(True), mock_context) == expected_response
    mock_group_dao.get_all.assert_called_with(group_names=[group_user.group for group_user in MOCK_GROUP_USERS])
    mock_group_user_dao.get_groups_for_user.assert_called_with(MOCK_USERNAME)


@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_list_all_groups_admin(mock_group_dao, mock_group_user_dao):
    mock_group_dao.get_all.return_value = MOCK_GROUPS
    mock_group_user_dao.get_users_for_group.return_value = [GroupUserModel(group_name="some-group", username=MOCK_USERNAME)]

    expected_response = generate_html_response(
        200,
        [group.to_dict() for group in MOCK_GROUPS],
    )

    assert lambda_handler(mock_event(True, {"adminGetAll": "true"}), mock_context) == expected_response
    mock_group_dao.get_all.assert_called()
    mock_group_user_dao.get_groups_for_user.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_list_all_groups_user(mock_group_dao, mock_group_user_dao):
    mock_group_dao.get_all.return_value = [MOCK_GROUPS[1]]
    mock_group_user_dao.get_groups_for_user.return_value = MOCK_GROUP_USERS
    mock_group_user_dao.get_users_for_group.return_value = [GroupUserModel(group_name="some-group", username=MOCK_USERNAME)]
    expected_response = generate_html_response(
        200,
        [MOCK_GROUPS[1].to_dict()],
    )

    assert lambda_handler(mock_event(False), mock_context) == expected_response
    mock_group_dao.get_all.assert_called_with(group_names=[group_user.group for group_user in MOCK_GROUP_USERS])
    mock_group_user_dao.get_groups_for_user.assert_called_with(MOCK_USERNAME)


@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_list_all_groups_client_error(mock_group_dao, mock_group_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the Scan operation: Dummy error message.",
    )

    mock_group_dao.get_all.side_effect = ClientError(error_msg, "Scan")

    assert lambda_handler(mock_event(True), mock_context) == expected_response
    mock_group_dao.get_all.assert_called()
