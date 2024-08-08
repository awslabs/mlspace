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

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.data_access_objects.project_group import ProjectGroupModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.project.lambda_functions import update_project_group as lambda_handler
from ml_space_lambda.utils.common_functions import generate_html_response

PROJECT_NAME = "MyFakeProject"
GROUP_1 = GroupModel("group_1", "", "")
PROJECT_GROUP = ProjectGroupModel(GROUP_1.name, PROJECT_NAME)


@pytest.mark.parametrize(
    "project_group",
    [(None), (PROJECT_GROUP)],
)
@mock.patch("ml_space_lambda.project.lambda_functions.project_group_dao")
def test_project_groups(mock_project_group_dao, project_group):
    event = {
        "pathParameters": {"projectName": PROJECT_NAME, "groupName": GROUP_1.name},
        "body": json.dumps({"permissions": [Permission.PROJECT_OWNER]}),
    }
    context = mock.MagicMock()

    mock_project_group_dao.get.return_value = project_group

    if project_group:
        expected_response = generate_html_response(200, "Successfuly updated project group record.")
    else:
        expected_response = generate_html_response(404, f"User {GROUP_1.name} is not a associated with {PROJECT_NAME}")

    assert lambda_handler(event, context) == expected_response

    mock_project_group_dao.get.assert_called_with(PROJECT_NAME, GROUP_1.name)

    if project_group:
        mock_project_group_dao.update.assert_called_with(PROJECT_NAME, GROUP_1.name, mock.ANY)
