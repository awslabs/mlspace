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
from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.project_group import ProjectGroupModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
MOCK_PROJECT_NAME = "TestProject"

MOCK_GROUP = GroupModel(
    name="test_group",
    description="Group used for unit testing",
    created_by="jdoe@example.com",
)

MOCK_GROUP_USER = GroupUserModel(
    username=MOCK_GROUP.created_by,
    group_name=MOCK_GROUP.name,
    permissions=[],
)

MOCK_PROJECT_GROUPS = [
    ProjectGroupModel(
        group_name="my_group_1",
        project_name=MOCK_PROJECT_NAME,
        permissions=[],
    )
]

MOCK_USER = UserModel(MOCK_GROUP.created_by, MOCK_GROUP.created_by, "John Doe", False)

mock_event = {
    "requestContext": {
        "authorizer": {
            "principalId": MOCK_GROUP.created_by,
            "user": json.dumps(MOCK_USER.to_dict()),
        }
    },
    "pathParameters": {"groupName": MOCK_GROUP.name},
    "queryStringParameters": {"includeResourceCounts": False},
}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import group_projects as lambda_handler


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_get_project_group(mock_group_dao, mock_group_user_dao, mock_project_group_dao):
    mock_group_dao.get.return_value = MOCK_GROUP
    mock_group_user_dao.get.return_value = MOCK_GROUP_USER
    mock_project_group_dao.get_projects_for_group.return_value = MOCK_PROJECT_GROUPS

    expected_response = generate_html_response(
        200,
        [project_group.to_dict() for project_group in MOCK_PROJECT_GROUPS],
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_group_dao.get.assert_called_with(MOCK_GROUP.name)
    mock_group_user_dao.get.assert_called_with(MOCK_GROUP.name, MOCK_GROUP.created_by)


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_get_group_not_a_member(mock_group_dao, mock_group_user_dao, mock_project_group_dao):
    mock_group_dao.get.return_value = MOCK_GROUP
    mock_group_user_dao.get.return_value = None
    expected_response = generate_html_response(
        400,
        f"Bad Request: User is not a member of group {MOCK_GROUP.name}.",
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_group_dao.get.assert_called_with(MOCK_GROUP.name)
    mock_group_user_dao.get.assert_called_with(MOCK_GROUP.name, MOCK_GROUP.created_by)


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_get_group_admin(mock_group_dao, mock_group_user_dao, mock_project_group_dao):
    mock_group_dao.get.return_value = MOCK_GROUP
    mock_group_user_dao.get.return_value = None
    mock_project_group_dao.get_projects_for_group.return_value = MOCK_PROJECT_GROUPS
    expected_response = generate_html_response(
        200,
        [project_group.to_dict() for project_group in MOCK_PROJECT_GROUPS],
    )
    mock_admin = UserModel(MOCK_GROUP.created_by, MOCK_GROUP.created_by, "John Doe", False, [Permission.ADMIN])
    admin_event = {
        "requestContext": {
            "authorizer": {
                "principalId": MOCK_GROUP.created_by,
                "user": json.dumps(mock_admin.to_dict()),
            }
        },
        "pathParameters": {"groupName": MOCK_GROUP.name},
    }
    assert lambda_handler(admin_event, mock_context) == expected_response
    mock_group_dao.get.assert_called_with(MOCK_GROUP.name)
    mock_group_user_dao.get.assert_called_with(MOCK_GROUP.name, MOCK_GROUP.created_by)


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_get_nonexistent_group(mock_group_dao, mock_group_user_dao, mock_project_group_dao):
    mock_group_dao.get.return_value = None
    expected_response = generate_html_response(
        404,
        f"Specified group {MOCK_GROUP.name} does not exist.",
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_group_dao.get.assert_called_with(MOCK_GROUP.name)
    mock_group_user_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_list_all_groups_client_error(mock_group_dao, mock_group_user_dao, mock_project_group_dao):
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
    mock_group_dao.get.assert_called_with(MOCK_GROUP.name)
    mock_group_user_dao.get.assert_not_called()
