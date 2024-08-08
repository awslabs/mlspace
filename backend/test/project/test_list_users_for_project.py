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

from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import project_users as lambda_handler

MOCK_PROJECT_NAME = "example_project"
mock_event = {
    "pathParameters": {
        "projectName": MOCK_PROJECT_NAME,
    },
}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_list_users_for_project_success(mock_project_user_dao):
    project_users = [
        ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username="jdoe@amazon.com",
            permissions=[Permission.PROJECT_OWNER],
        ),
        ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username="jane@amazon.com",
            permissions=[],
        ),
        ProjectUserModel(
            project_name=MOCK_PROJECT_NAME,
            username="bobf",
            permissions=[],
        ),
    ]
    expected_response = generate_html_response(
        200,
        [record.to_dict() for record in project_users],
    )
    mock_project_user_dao.get_users_for_project.return_value = project_users

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_user_dao.get_users_for_project.assert_called_with(MOCK_PROJECT_NAME)


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_list_users_for_project_client_error(mock_project_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the Scan operation: Dummy error message.",
    )
    mock_project_user_dao.get_users_for_project.side_effect = ClientError(error_msg, "Scan")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_user_dao.get_users_for_project.assert_called_with(MOCK_PROJECT_NAME)


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_list_users_for_project_missing_parameters(mock_project_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_project_user_dao.get_users_for_project.assert_not_called()
