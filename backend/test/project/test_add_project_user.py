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

from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import add_users as lambda_handler

MOCK_USERNAME = "jdoe@amazon.com"
MOCK_PROJECT_NAME = "example_project"
MOCK_IAM_ROLE = "FakeProjectUserRole"
MOCK_USER = UserModel(MOCK_USERNAME, "ksmith@amazon.com", "Kitten Smith", False, [])

mock_event = {
    "pathParameters": {
        "projectName": MOCK_PROJECT_NAME,
    },
    "body": json.dumps({"usernames": [MOCK_USERNAME]}),
}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_add_users_to_project_with_iam(mock_user_dao, mock_project_user_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully added 1 user(s) to {MOCK_PROJECT_NAME}")
    mock_user_dao.get.return_value = MOCK_USER
    mock_project_user_dao.create.return_value = None
    mock_iam_manager.add_iam_role.return_value = MOCK_IAM_ROLE
    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True"}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.add_iam_role.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    # The create arg is the ProjectUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_user_dao.create.assert_called_once()
    assert (
        mock_project_user_dao.create.call_args.args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username=MOCK_USERNAME,
            permissions=[Permission.COLLABORATOR],
            role=MOCK_IAM_ROLE,
        ).to_dict()
    )


@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_add_users_to_project(mock_user_dao, mock_project_user_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully added 1 user(s) to {MOCK_PROJECT_NAME}")
    mock_user_dao.get.return_value = MOCK_USER
    mock_project_user_dao.create.return_value = None
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.add_iam_role.assert_not_called()
    # The create arg is the ProjectUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_user_dao.create.assert_called_once()
    assert (
        mock_project_user_dao.create.call_args.args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username=MOCK_USERNAME,
            permissions=[Permission.COLLABORATOR],
        ).to_dict()
    )


@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_add_users_to_project_multiple(mock_user_dao, mock_project_user_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully added 3 user(s) to {MOCK_PROJECT_NAME}")
    mock_user_dao.get.return_value = [
        UserModel("user1", "user1@amazon.com", "User One", False, []),
        UserModel("user2", "user2@amazon.com", "User Two", False, []),
        UserModel("user3", "user3@amazon.com", "User Three", False, []),
    ]
    mock_project_user_dao.create.return_value = None
    assert (
        lambda_handler(
            {
                "pathParameters": {
                    "projectName": MOCK_PROJECT_NAME,
                },
                "body": json.dumps({"usernames": ["user1", "user2", "user3"]}),
            },
            mock_context,
        )
        == expected_response
    )

    mock_user_dao.get.assert_has_calls([mock.call("user1"), mock.call("user2"), mock.call("user3")])
    mock_iam_manager.add_iam_role.assert_not_called()
    # The create arg is the ProjectUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    assert mock_project_user_dao.create.call_count == 3
    assert (
        mock_project_user_dao.create.call_args_list[0].args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username="user1",
            permissions=[Permission.COLLABORATOR],
        ).to_dict()
    )
    assert (
        mock_project_user_dao.create.call_args_list[1].args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username="user2",
            permissions=[Permission.COLLABORATOR],
        ).to_dict()
    )
    assert (
        mock_project_user_dao.create.call_args_list[2].args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username="user3",
            permissions=[Permission.COLLABORATOR],
        ).to_dict()
    )


@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_add_users_to_project_client_error(mock_user_dao, mock_project_user_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the PutItem operation: Dummy error message.",
    )
    mock_user_dao.get.return_value = MOCK_USER
    mock_project_user_dao.create.side_effect = ClientError(error_msg, "PutItem")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.add_iam_role.assert_not_called()
    # The create arg is the ProjectUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_user_dao.create.assert_called_once()
    assert (
        mock_project_user_dao.create.call_args.args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username=MOCK_USERNAME,
            permissions=[Permission.COLLABORATOR],
        ).to_dict()
    )


@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_add_nonexistent_user_to_project_error(mock_user_dao, mock_project_user_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(
        400, f"Bad Request: The following usernames are not associated with an active user: {MOCK_USERNAME}"
    )
    mock_user_dao.get.return_value = None

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.add_iam_role.assert_not_called()
    mock_project_user_dao.create.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_add_users_to_project_client_error_with_iam(mock_user_dao, mock_project_user_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the PutItem operation: Dummy error message.",
    )
    mock_user_dao.get.return_value = MOCK_USER
    mock_project_user_dao.create.side_effect = ClientError(error_msg, "PutItem")
    mock_iam_manager.remove_project_user_roles.return_value = None
    mock_iam_manager.add_iam_role.return_value = MOCK_IAM_ROLE
    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True"}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.add_iam_role.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_iam_manager.remove_project_user_roles.assert_called_with([MOCK_IAM_ROLE])
    # The create arg is the ProjectUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_user_dao.create.assert_called_once()
    assert (
        mock_project_user_dao.create.call_args.args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username=MOCK_USERNAME,
            permissions=[Permission.COLLABORATOR],
            role=MOCK_IAM_ROLE,
        ).to_dict()
    )


@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_add_users_to_project_iam_error(mock_user_dao, mock_project_user_dao, mock_iam_manager):
    mlspace_config.env_variables = {}
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the Invoke operation: Dummy error message.",
    )
    mock_user_dao.get.side_effect = ClientError(error_msg, "Invoke")
    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True"}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.add_iam_role.assert_not_called()
    mock_iam_manager.remove_project_user_roles.assert_not_called()
    mock_project_user_dao.create.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_add_users_to_project_missing_parameters(mock_project_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_project_user_dao.create.assert_not_called()
