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
from ml_space_lambda.data_access_objects.project_group import ProjectGroupModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "MANAGE_IAM_ROLES": "True",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import remove_user as lambda_handler

MOCK_USERNAME = "jdoe@amazon.com"
MOCK_GROUP_NAME = "example_group"

MOCK_GO_USER = GroupUserModel(
    group_name=MOCK_GROUP_NAME,
    username=MOCK_USERNAME,
    permissions=[Permission.COLLABORATOR],
)
MOCK_CO_USER = GroupUserModel(group_name=MOCK_GROUP_NAME, username="jane-doe", permissions=[Permission.COLLABORATOR])

mock_event = {"pathParameters": {"groupName": MOCK_GROUP_NAME, "username": MOCK_USERNAME}}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.group.lambda_functions.is_member_of_project")
@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
def test_remove_user_from_group_success(
    mock_group_user_dao, mock_iam_manager, mock_project_group_dao, mock_is_member_of_project
):
    fake_role_arn = "arn:aws::012345678901:iam:role/some-fake-rolw"
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully removed {MOCK_CO_USER.user} from {MOCK_GROUP_NAME}")

    mock_group_user_dao.get.return_value = MOCK_CO_USER
    mock_project_group_dao.get_projects_for_group.return_value = [ProjectGroupModel("MyMockProject", "MyMockGroup")]
    mock_is_member_of_project.return_value = False
    mock_iam_manager.get_iam_role_arn.return_value = fake_role_arn

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True"}):
        assert (
            lambda_handler(
                {
                    "pathParameters": {
                        "groupName": MOCK_GROUP_NAME,
                        "username": MOCK_CO_USER.user,
                    }
                },
                mock_context,
            )
            == expected_response
        )

    mock_group_user_dao.get.assert_called_with(MOCK_GROUP_NAME, MOCK_CO_USER.user)
    mock_group_user_dao.get_users_for_group.assert_not_called()
    mock_group_user_dao.delete.assert_called_with(MOCK_GROUP_NAME, MOCK_CO_USER.user)
    mock_iam_manager.update_user_policy.assert_called_with(MOCK_CO_USER.user)
    mock_iam_manager.get_iam_role_arn.assert_called_once()
    mock_iam_manager.remove_project_user_roles.assert_called_with([fake_role_arn])


@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
def test_remove_user_from_group_failure_not_in_group(mock_group_user_dao, mock_iam_manager):
    expected_response = generate_html_response(400, f"Bad Request: {MOCK_USERNAME} is not a member of {MOCK_GROUP_NAME}")
    mock_group_user_dao.get.return_value = None

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_user_dao.get.assert_called_with(MOCK_GROUP_NAME, MOCK_USERNAME)
    mock_group_user_dao.get_users_for_group.assert_not_called()
    mock_group_user_dao.delete.assert_not_called()
    mock_iam_manager.update_user_policy.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
def test_remove_user_from_group_client_error(mock_group_user_dao, mock_iam_manager):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the GetItem operation: Dummy error message.",
    )
    mock_group_user_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_user_dao.get.assert_called_with(MOCK_GROUP_NAME, MOCK_USERNAME)
    mock_group_user_dao.get_users_for_group.assert_not_called()
    mock_group_user_dao.delete.assert_not_called()
    mock_iam_manager.update_user_policy.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
def test_remove_user_from_group_missing_parameters(mock_group_user_dao, mock_iam_manager):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_group_user_dao.get.assert_not_called()
    mock_group_user_dao.get_users_for_group.assert_not_called()
    mock_group_user_dao.delete.assert_not_called()
    mock_iam_manager.update_user_policy.assert_not_called()
