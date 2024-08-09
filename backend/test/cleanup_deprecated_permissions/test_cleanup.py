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
from unittest import mock

from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import EnvVariable, Permission
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", EnvVariable.MANAGE_IAM_ROLES: "True"}

mock_context = mock.Mock()
mock_event = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.cleanup_deprecated_permissions.lambda_function import lambda_handler


@mock.patch("ml_space_lambda.cleanup_deprecated_permissions.lambda_function.group_user_dao")
@mock.patch("ml_space_lambda.cleanup_deprecated_permissions.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.cleanup_deprecated_permissions.lambda_function.user_dao")
def test_cleanup(mock_user_dao, mock_project_user_dao, mock_group_user_dao):
    mock_user = UserModel("username", "email@amazon.com", "User Name", False, ["CO", Permission.ADMIN])
    mock_project_user = ProjectUserModel(
        username="jdoe@example.com", project_name="SomeProject", permissions=["CO", Permission.ADMIN]
    )
    mock_group_user = GroupUserModel(username="jdoe@example.com", group_name="SomeGroup", permissions=["CO", Permission.ADMIN])
    mock_user_dao.get_all.return_value = [mock_user]
    mock_project_user_dao.get_all.return_value = [mock_project_user]
    mock_group_user_dao.get_all.return_value = [mock_group_user]

    expected_response = generate_html_response(200, "Successfully cleaned up deprecated permissions")
    assert expected_response == lambda_handler(mock_event, mock_context)

    # Update the model objects and ensure they removed the 'CO' permissions
    mock_user.permissions = [Permission.ADMIN]
    assert mock_user_dao.update.called_with(mock_user.username, mock_user)
    mock_project_user.permissions = [Permission.ADMIN]
    assert mock_project_user_dao.update.called_with(mock_project_user.project, mock_project_user.user, mock_project_user)
    mock_group_user.permissions = [Permission.ADMIN]
    assert mock_group_user_dao.update.called_with(mock_group_user.group, mock_group_user.user, mock_group_user)
