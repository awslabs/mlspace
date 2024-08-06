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
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

MOCK_USER = UserModel("jdoe@example.com", "jdoe@example.com", "John Doe", False)
MOCK_PROJECT_1 = ProjectModel(name="TestProject1", description="test 1", suspended=False, created_by=MOCK_USER.username)
MOCK_PROJECT_2 = ProjectModel(name="TestProject2", description="test 2", suspended=False, created_by=MOCK_USER.username)
MOCK_PROJECTS = [MOCK_PROJECT_1, MOCK_PROJECT_2]

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
    from ml_space_lambda.user.lambda_functions import get_projects as lambda_handler


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_get_user_projects(project_user_dao):
    project_user_dao.get_projects_for_user.return_value = MOCK_PROJECTS
    expected_response = generate_html_response(200, [project.to_dict() for project in MOCK_PROJECTS])

    assert lambda_handler(mock_event, mock_context) == expected_response
    project_user_dao.get_projects_for_user.assert_called_with(MOCK_USER.username)


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_get_user_projects_no_projects_found(project_user_dao):
    project_user_dao.get_projects_for_user.return_value = []
    expected_response = generate_html_response(200, [])

    assert lambda_handler(mock_event, mock_context) == expected_response
    project_user_dao.get_projects_for_user.assert_called_with(MOCK_USER.username)


@mock.patch("ml_space_lambda.user.lambda_functions.project_user_dao")
def test_get_user_projects_client_error(project_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    project_user_dao.get_projects_for_user.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(mock_event, mock_context) == expected_response
    project_user_dao.get_projects_for_user.assert_called_with(MOCK_USER.username)
