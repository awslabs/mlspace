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
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
MOCK_USERNAME = "jdoe"
MOCK_PROJECTS = [
    ProjectModel(
        name="example_project_1",
        description="example description 1",
        suspended=False,
        created_by="polly@example.com",
    ),
    ProjectModel(
        name="example_project_2",
        description="example description 2",
        suspended=False,
        created_by="finn@example.com",
    ),
    ProjectModel(
        name="example_project_3",
        description="example description 3",
        suspended=True,
        created_by="finn@example.com",
    ),
    ProjectModel(
        name="example_project_4",
        description="example description 4",
        suspended=False,
        created_by="gina@example.com",
    ),
]

MOCK_PROJECT_USERS = [
    ProjectUserModel(project_name=MOCK_PROJECTS[1].name, username=MOCK_USERNAME),
    ProjectUserModel(project_name=MOCK_PROJECTS[2].name, username=MOCK_USERNAME),
]


with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import list_all as lambda_handler

mock_context = mock.Mock()


def mock_event(is_admin: bool = False):
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
    }


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_list_all_projects_admin(mock_project_dao, mock_project_user_dao):
    mock_project_dao.get_all.return_value = MOCK_PROJECTS

    expected_response = generate_html_response(
        200,
        [project.to_dict() for project in MOCK_PROJECTS],
    )

    assert lambda_handler(mock_event(True), mock_context) == expected_response
    mock_project_dao.get_all.assert_called_with(include_suspended=True)
    mock_project_user_dao.get_projects_for_user.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_list_all_projects_user(mock_project_dao, mock_project_user_dao, mock_group_user_dao):
    mock_project_dao.get_all.side_effect = lambda **kwargs: [] if not kwargs.get("project_names") else [MOCK_PROJECTS[1]]
    mock_project_user_dao.get_projects_for_user.return_value = MOCK_PROJECT_USERS
    mock_group_user_dao.get_groups_for_user.return_value = []
    expected_response = generate_html_response(
        200,
        [MOCK_PROJECTS[1].to_dict()],
    )

    assert lambda_handler(mock_event(False), mock_context) == expected_response
    mock_project_user_dao.get_projects_for_user.assert_called_with(MOCK_USERNAME)
    mock_project_dao.get_all.assert_has_calls(
        [
            mock.call(project_names=[project_user.project for project_user in MOCK_PROJECT_USERS]),
            mock.call(project_names=[]),
        ]
    )


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_list_all_projects_client_error(mock_project_dao, mock_project_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the Scan operation: Dummy error message.",
    )

    mock_project_dao.get_all.side_effect = ClientError(error_msg, "Scan")

    assert lambda_handler(mock_event(True), mock_context) == expected_response
    mock_project_dao.get_all.assert_called_with(include_suspended=True)
