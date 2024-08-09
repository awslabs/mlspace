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

from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import create as lambda_handler

MOCK_PROJECT_NAME = "UnitTestProject"
MOCK_TIMESTAMP = 1669931346
MOCK_USERNAME = "jdoe@example.com"
MOCK_USER = UserModel(MOCK_USERNAME, MOCK_USERNAME, "John Doe", False, [])

mock_context = mock.Mock()


def _mock_event(project_name: str = MOCK_PROJECT_NAME):
    return {
        "requestContext": {"authorizer": {"principalId": MOCK_USERNAME}},
        "body": json.dumps({"name": project_name, "description": "Project for unit tests", "suspended": False}),
    }


@mock.patch("ml_space_lambda.data_access_objects.project.time")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_create_project(mock_user_dao, mock_project_dao, mock_project_user_dao, mock_time):
    mlspace_config.env_variables = {}
    mock_project_dao.get.return_value = None
    expected_response = generate_html_response(200, f"Successfully created project '{MOCK_PROJECT_NAME}'")

    mock_user_dao.get.return_value = MOCK_USER
    mock_time.time.return_value = MOCK_TIMESTAMP

    assert lambda_handler(_mock_event(), mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_user_dao.get.assert_called_with(MOCK_USERNAME)

    # The create arg is the ProjectUserModel or ProjectModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_user_dao.create.assert_called_once()
    assert (
        mock_project_user_dao.create.call_args.args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username=MOCK_USERNAME,
            permissions=[Permission.PROJECT_OWNER],
        ).to_dict()
    )
    mock_project_dao.create.assert_called_once()
    assert (
        mock_project_dao.create.call_args.args[0].to_dict()
        == ProjectModel(
            name=MOCK_PROJECT_NAME,
            description="Project for unit tests",
            suspended=False,
            created_by=MOCK_USERNAME,
        ).to_dict()
    )


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_create_project_invalid_characters(mock_project_dao):
    expected_response = generate_html_response(400, "Bad Request: Project name contains invalid character.")

    assert lambda_handler(_mock_event("Crazy!NameFor $$$"), mock_context) == expected_response
    mock_project_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_create_project_long_name(mock_project_dao):
    expected_response = generate_html_response(400, "Bad Request: Project name exceeded the maximum allowable length of 24.")

    assert lambda_handler(_mock_event("ThisIsAVeryLongProjectName_TooLongInFact"), mock_context) == expected_response
    mock_project_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_create_project_reserved_name(mock_project_dao):
    expected_response = generate_html_response(
        400,
        "Bad Request: 'global' is a reserved word. You cannot " "create a project with that name.",
    )

    assert lambda_handler(_mock_event("global"), mock_context) == expected_response
    mock_project_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_create_project_name_not_unique(mock_project_dao):
    mock_project_dao.get.return_value = ProjectModel(
        name=MOCK_PROJECT_NAME,
        description="Nothing here",
        suspended=True,
        created_by="matt@example.com",
    )

    expected_response = generate_html_response(
        400,
        "Bad Request: Project name already exists. This can " "happen even when the project has been suspended by the PMO.",
    )

    assert lambda_handler(_mock_event(), mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_create_project_client_error(mock_project_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    mock_project_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(_mock_event(), mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.user_dao")
def test_create_project_client_error_adding_user(mock_user_dao, mock_project_dao, mock_project_user_dao):
    mlspace_config.env_variables = {}
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the PutItem operation: Dummy error message.",
    )
    mock_user_dao.get.return_value = MOCK_USER
    mock_project_user_dao.create.side_effect = ClientError(error_msg, "PutItem")
    mock_project_dao.get.return_value = None

    assert lambda_handler(_mock_event(), mock_context) == expected_response

    mock_user_dao.get.assert_called_with(MOCK_USERNAME)
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    # The create arg is the ProjectUserModel or ProjectModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_user_dao.create.assert_called_once()
    assert (
        mock_project_user_dao.create.call_args.args[0].to_dict()
        == ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username=MOCK_USERNAME,
            permissions=[Permission.PROJECT_OWNER],
        ).to_dict()
    )
    mock_project_dao.create.assert_called_once()
    assert (
        mock_project_dao.create.call_args.args[0].to_dict()
        == ProjectModel(
            name=MOCK_PROJECT_NAME,
            description="Project for unit tests",
            suspended=False,
            created_by=MOCK_USERNAME,
        ).to_dict()
    )
    # Since the project created before the user add failed we should also cleanup the project
    mock_project_dao.delete.assert_called_with(MOCK_PROJECT_NAME)


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_create_project_bad_request(mock_project_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'requestContext'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_project_dao.create.assert_not_called()
