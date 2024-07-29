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

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetModel
from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.project_group import ProjectGroupModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "MANAGE_IAM_ROLES": "True"}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import delete as lambda_handler

MOCK_GROUP_NAME = "UnitTestGroup"
MOCK_DATASET_NAME = "dataset001"
MOCK_GROUP = GroupModel(MOCK_GROUP_NAME, "Group for unit tests", "John Doe")
MOCK_GROUP_DATASETS = [
    GroupDatasetModel(dataset_name=MOCK_DATASET_NAME, group_name=MOCK_GROUP_NAME),
]

mock_event = {
    "requestContext": {"authorizer": {"principalId": "jdoe@example.com"}},
    "pathParameters": {"groupName": MOCK_GROUP_NAME},
}

mock_context = mock.Mock()


@pytest.mark.parametrize(
    "dynamic_roles,is_member,iam_role_arn",
    [
        (False, False, None),
        (True, False, None),
        (False, True, None),
        (True, True, None),
        (True, False, "arn:aws::012345678901:iam:role/my-fake-role"),
        (True, True, "arn:aws::012345678901:iam:role/my-fake-role"),
    ],
    ids=[
        "no_dynamic_roles__no_is_member__no_iam_role",
        "yes_dynamic_roles__no_is_member__no_iam_role",
        "no_dynamic_roles__yes_is_member__no_iam_role",
        "yes_dynamic_roles__yes_is_member__no_iam_role",
        "yes_dynamic_roles__no_is_member__yes_iam_role",
        "no_dynamic_roles__yes_is_member__yes_iam_role",
    ],
)
@mock.patch("ml_space_lambda.group.lambda_functions.is_member_of_project")
@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_delete_group(
    mock_group_dao,
    mock_group_user_dao,
    mock_group_dataset_dao,
    mock_iam_manager,
    mock_project_group_dao,
    mock_is_member_of_project,
    dynamic_roles,
    is_member,
    iam_role_arn,
):
    mlspace_config.env_variables = {}
    fake_role_arn = "arn:aws::012345678901:iam:role/my-fake-role"
    expected_response = generate_html_response(200, f"Successfully deleted {MOCK_GROUP_NAME}.")
    mock_group_dao.get.return_value = MOCK_GROUP
    project_group = ProjectGroupModel(MOCK_GROUP_NAME, "MyMockProject")

    mock_project_group_dao.get_projects_for_group.return_value = [project_group]
    mock_is_member_of_project.return_value = is_member
    mock_iam_manager.get_iam_role_arn.return_value = iam_role_arn
    mock_group_dataset_dao.get_datasets_for_group.return_value = MOCK_GROUP_DATASETS

    mock_username = "jdoe@example.com"
    mock_group_user_dao.get_users_for_group.return_value = [
        GroupUserModel(
            username=mock_username,
            group_name=MOCK_GROUP_NAME,
            permissions=[Permission.COLLABORATOR],
        )
    ]
    mock_group_user_dao.delete.return_value = None

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True" if dynamic_roles else ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)
    mock_group_dao.delete.assert_called_with(MOCK_GROUP_NAME)
    mock_group_user_dao.get_users_for_group.assert_called_with(MOCK_GROUP_NAME)
    mock_group_user_dao.delete.assert_called_with(MOCK_GROUP_NAME, mock_username)

    if dynamic_roles:
        mock_iam_manager.update_user_policy.assert_called_with(mock_username)
        mock_is_member_of_project.assert_called_with(mock_username, project_group.project)
        if not is_member:
            mock_iam_manager.get_iam_role_arn.assert_called_with(project_group.project, mock_username)
            if iam_role_arn:
                mock_iam_manager.remove_project_user_roles.assert_called_with([fake_role_arn])

    mock_group_dataset_dao.delete.assert_called_with(group_name=MOCK_GROUP_NAME, dataset_name=MOCK_DATASET_NAME)


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
