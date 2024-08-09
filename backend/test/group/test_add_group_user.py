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

from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import add_users as lambda_handler

MOCK_USERNAME = "jdoe@amazon.com"
MOCK_GROUP_NAME = "example_group"
MOCK_USER = UserModel(MOCK_USERNAME, "dsmith@amazon.com", "Dog Smith", False, [])

mock_event = {
    "pathParameters": {
        "groupName": MOCK_GROUP_NAME,
    },
    "body": json.dumps({"usernames": [MOCK_USERNAME]}),
}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.user_dao")
# @mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True"}, clear=True)
def test_add_users_to_group_with_iam(
    mock_user_dao, mock_group_user_dao, mock_iam_manager, mock_group_dao, mock_project_group_dao
):
    project_name = "MyMockProject"
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully added 1 user(s) to {MOCK_GROUP_NAME}")
    mock_user_dao.get.return_value = MOCK_USER
    mock_group_user_dao.create.return_value = None
    mock_group_dao.get.return_value = {"name": "MyMockGroup"}
    mock_iam_manager.get_iam_role_arn.return_value = None
    mock_project_group_dao.get_projects_for_group.return_value = [
        ProjectUserModel(username=MOCK_USERNAME, project_name=project_name)
    ]
    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True"}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.update_user_policy.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.get_iam_role_arn.assert_called_with(project_name, MOCK_USERNAME)
    mock_iam_manager.add_iam_role.assert_called_with(project_name, MOCK_USERNAME)
    # The create arg is the GroupUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_group_user_dao.create.assert_called_once()
    mock_project_group_dao.get_projects_for_group.assert_called_once()
    assert (
        mock_group_user_dao.create.call_args.args[0].to_dict()
        == GroupUserModel(
            group_name=MOCK_GROUP_NAME,
            username=MOCK_USERNAME,
        ).to_dict()
    )


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.user_dao")
def test_add_users_to_group(mock_user_dao, mock_group_user_dao, mock_iam_manager, mock_group_dao, mock_project_group_dao):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully added 1 user(s) to {MOCK_GROUP_NAME}")
    mock_user_dao.get.return_value = MOCK_USER
    mock_group_user_dao.create.return_value = None
    mock_group_dao.get.return_value = {"name": "MyMockGroup"}
    mock_iam_manager.get_iam_role_arn.return_value = None
    mock_project_group_dao.get_projects_for_group.return_value = [
        ProjectUserModel(username=MOCK_USERNAME, project_name="MyMockProject")
    ]
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_iam_manager.update_user_policy.assert_called_with(MOCK_USERNAME)
    # The create arg is the GroupUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_group_user_dao.create.assert_called_once()
    assert (
        mock_group_user_dao.create.call_args.args[0].to_dict()
        == GroupUserModel(
            group_name=MOCK_GROUP_NAME,
            username=MOCK_USERNAME,
        ).to_dict()
    )


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.user_dao")
def test_add_users_to_group_multiple(
    mock_user_dao, mock_group_user_dao, mock_iam_manager, mock_group_dao, mock_project_group_dao
):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully added 3 user(s) to {MOCK_GROUP_NAME}")
    mock_user_dao.get.return_value = [
        UserModel("user1", "user1@amazon.com", "User One", False, []),
        UserModel("user2", "user2@amazon.com", "User Two", False, []),
        UserModel("user3", "user3@amazon.com", "User Three", False, []),
    ]
    mock_group_dao.get.return_value = {"name": "MyMockGroup"}
    mock_iam_manager.get_iam_role_arn.return_value = None
    mock_project_group_dao.get_projects_for_group.return_value = [
        ProjectUserModel(username=MOCK_USERNAME, project_name="MyMockProject")
    ]
    mock_group_user_dao.create.return_value = None
    assert (
        lambda_handler(
            {
                "pathParameters": {
                    "groupName": MOCK_GROUP_NAME,
                },
                "body": json.dumps({"usernames": ["user1", "user2", "user3"]}),
            },
            mock_context,
        )
        == expected_response
    )

    mock_user_dao.get.assert_has_calls([mock.call("user1"), mock.call("user2"), mock.call("user3")])
    mock_iam_manager.update_user_policy.assert_has_calls([mock.call("user1"), mock.call("user2"), mock.call("user3")])
    # The create arg is the GroupUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    assert mock_group_user_dao.create.call_count == 3
    assert (
        mock_group_user_dao.create.call_args_list[0].args[0].to_dict()
        == GroupUserModel(
            group_name=MOCK_GROUP_NAME,
            username="user1",
        ).to_dict()
    )
    assert (
        mock_group_user_dao.create.call_args_list[1].args[0].to_dict()
        == GroupUserModel(
            group_name=MOCK_GROUP_NAME,
            username="user2",
        ).to_dict()
    )
    assert (
        mock_group_user_dao.create.call_args_list[2].args[0].to_dict()
        == GroupUserModel(
            group_name=MOCK_GROUP_NAME,
            username="user3",
        ).to_dict()
    )


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.user_dao")
def test_add_users_to_group_client_error(mock_user_dao, mock_group_user_dao, mock_iam_manager, mock_group_dao):
    mlspace_config.env_variables = {}
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the GetItem operation: Dummy error message.",
    )
    mock_group_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(mock_event, mock_context) == expected_response

    # The create arg is the GroupUserModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_group_user_dao.create.assert_not_called()
    mock_iam_manager.update_user_policy.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.user_dao")
def test_add_nonexistent_user_to_group_error(
    mock_user_dao, mock_group_user_dao, mock_iam_manager, mock_group_dao, mock_project_group_dao
):
    mlspace_config.env_variables = {}
    mock_group_dao.get.return_value = {"name": "MyMockGroup"}
    expected_response = generate_html_response(
        400, f"Bad Request: The following usernames are not associated with an active user: {MOCK_USERNAME}"
    )
    mock_user_dao.get.return_value = None
    mock_project_group_dao.get_projects_for_group.return_value = [
        ProjectUserModel(username=MOCK_USERNAME, project_name="MyMockProject")
    ]

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_group_user_dao.create.assert_not_called()
    mock_iam_manager.update_user_policy.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.group_user_dao")
def test_add_users_to_group_missing_parameters(mock_group_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_group_user_dao.create.assert_not_called()
