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

import pytest

from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.project.lambda_functions import project_groups as lambda_handler
from ml_space_lambda.utils.common_functions import generate_html_response

PROJECT_NAME = "MyFakeProject"
NORMAL_USER = UserModel("woz", "woz@berkeley.edu", "Steve", False)
ADMIN_USER = UserModel("sjobs", "steve@apple.com", "Steve", False, permissions=[Permission.ADMIN])
PROJECT = ProjectModel(
    name=PROJECT_NAME,
    description="Project used for unit testing",
    suspended=False,
    created_by="jdoe@example.com",
)


def create_event(user):
    return {
        "pathParameters": {"projectName": PROJECT_NAME},
        "requestContext": {"authorizer": {"user": json.dumps(user.to_dict())}},
    }


@pytest.mark.parametrize(
    "project,user,is_member,project_groups",
    [
        (None, NORMAL_USER, False, []),
        (PROJECT, NORMAL_USER, False, []),
        (PROJECT, NORMAL_USER, True, []),
        (PROJECT, ADMIN_USER, False, []),
    ],
    ids=[
        "no_project__normal_user__not_member__no_project_groups",
        "yes_project__normal_user__not_member__no_project_groups",
        "yes_project__normal_user__yes_member__no_project_groups",
        "yes_project__admin_user__not_member__no_project_groups",
    ],
)
@mock.patch("ml_space_lambda.project.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.is_member_of_project")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_project_groups(
    mock_project_dao, mock_is_member_of_project, mock_project_group_dao, project, user, is_member, project_groups
):
    event = create_event(user)
    context = mock.MagicMock()

    mock_project_dao.get.return_value = project
    mock_is_member_of_project.return_value = is_member
    mock_project_group_dao.get_groups_for_project.return_value = project_groups

    if project is None:
        expected_response = generate_html_response(
            404,
            f"Specified project {PROJECT_NAME} does not exist.",
        )
    elif Permission.ADMIN not in user.permissions and not is_member:
        expected_response = generate_html_response(
            400,
            f"Bad Request: User is not a member of project {PROJECT_NAME}.",
        )
    else:
        expected_response = generate_html_response(
            200,
            [project_group.to_dict() for project_group in project_groups],
        )

    assert lambda_handler(event, context) == expected_response
