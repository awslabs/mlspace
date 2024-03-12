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

# Testing for the list_notebooks Lambda function
import json
from typing import Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.resource_metadata import (
    PagedMetadataResults,
    ResourceMetadataModel,
)
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission, ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}
# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.notebook.lambda_functions import list_resources as lambda_handler

mock_context = mock.Mock()

MOCK_PROJECT_NAME = "mock_notebooks"
SECONDARY_MOCK_PROJECT_NAME = "excludewrongproject"
MOCK_USERNAME = "jdoe@amazon.com"

MOCK_CO_USER = ProjectUserModel(
    project_name=MOCK_PROJECT_NAME,
    username=MOCK_USERNAME,
    permissions=[Permission.COLLABORATOR],
)

MOCK_PROJECT_OWNER = ProjectUserModel(
    project_name=MOCK_PROJECT_NAME,
    username=MOCK_USERNAME,
    permissions=[Permission.PROJECT_OWNER],
)


def _mock_event(is_admin: bool = False, include_paging_options: bool = False):
    base_event = {
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
        "pathParameters": {
            "projectName": MOCK_PROJECT_NAME,
        },
    }

    if include_paging_options:
        base_event["queryStringParameters"] = {
            "nextToken": "mock_next_token1",
            "pageSize": "10",
        }

    return base_event


def _mock_notebook_metadata(
    num: int, project: Optional[str] = MOCK_PROJECT_NAME, user: Optional[str] = MOCK_USERNAME
) -> ResourceMetadataModel:
    return ResourceMetadataModel(
        f"instance{num}",
        ResourceType.NOTEBOOK,
        user,
        project,
        {
            "NotebookInstanceName": f"instance{num}",
            "NotebookInstanceStatus": "InService",
            "NotebookInstanceArn": f"arn:aws:us-east-1:sagemaker:notebook/instance{num}",
        },
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
def test_list_notebook_instances_success_user_single_project(
    mock_project_user_dao, mock_resource_metadata_dao
):
    mock_return = {
        "records": [
            _mock_notebook_metadata(1).to_dict(),
            _mock_notebook_metadata(2).to_dict(),
            _mock_notebook_metadata(3).to_dict(),
        ]
    }
    expected_response = generate_html_response(200, mock_return)
    mock_project_user_dao.get.return_value = MOCK_CO_USER
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults(
        [
            _mock_notebook_metadata(1),
            _mock_notebook_metadata(2),
            _mock_notebook_metadata(3),
        ]
    )

    assert lambda_handler(_mock_event(False), mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, limit=100, next_token=None
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
def test_list_notebook_instances_single_page(mock_project_user_dao, mock_resource_metadata_dao):
    mock_return = {
        "records": [
            _mock_notebook_metadata(3).to_dict(),
        ]
    }
    expected_response = generate_html_response(200, mock_return)
    mock_project_user_dao.get.return_value = MOCK_CO_USER
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults(
        [
            _mock_notebook_metadata(1, user="otheruser"),
            _mock_notebook_metadata(3),
        ]
    )

    assert lambda_handler(_mock_event(False, True), mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_once()
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, limit=10, next_token="mock_next_token1"
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
def test_list_notebook_instances_success_admin(mock_project_user_dao, mock_resource_metadata_dao):
    mock_project_user_dao.get.return_value = None
    mock_return = {
        "records": [
            _mock_notebook_metadata(1).to_dict(),
            _mock_notebook_metadata(2).to_dict(),
            _mock_notebook_metadata(3, user="otheruser").to_dict(),
            _mock_notebook_metadata(4).to_dict(),
            _mock_notebook_metadata(5, user="otheruser").to_dict(),
            _mock_notebook_metadata(6, user="otheruser").to_dict(),
        ]
    }
    expected_response = generate_html_response(200, mock_return)
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults(
        [
            _mock_notebook_metadata(1),
            _mock_notebook_metadata(2),
            _mock_notebook_metadata(3, user="otheruser"),
            _mock_notebook_metadata(4),
            _mock_notebook_metadata(5, user="otheruser"),
            _mock_notebook_metadata(6, user="otheruser"),
        ]
    )
    assert lambda_handler(_mock_event(True), mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, limit=100, next_token=None
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
def test_list_notebook_instances_success_project_owner(
    mock_project_user_dao, mock_resource_metadata_dao
):
    mock_return = {
        "records": [
            _mock_notebook_metadata(1).to_dict(),
            _mock_notebook_metadata(2).to_dict(),
            _mock_notebook_metadata(3, user="otheruser").to_dict(),
            _mock_notebook_metadata(4).to_dict(),
            _mock_notebook_metadata(5, user="otheruser").to_dict(),
            _mock_notebook_metadata(6, user="otheruser").to_dict(),
        ],
        "nextToken": "fakeToken",
    }
    expected_response = generate_html_response(200, mock_return)
    mock_project_user_dao.get.return_value = MOCK_PROJECT_OWNER

    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults(
        [
            _mock_notebook_metadata(1),
            _mock_notebook_metadata(2),
            _mock_notebook_metadata(3, user="otheruser"),
            _mock_notebook_metadata(4),
            _mock_notebook_metadata(5, user="otheruser"),
            _mock_notebook_metadata(6, user="otheruser"),
        ],
        "fakeToken",
    )
    assert lambda_handler(_mock_event(False), mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, limit=100, next_token=None
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
def test_list_notebook_instances_success_user_multiple_projects(
    mock_project_user_dao, mock_resource_metadata_dao
):
    mock_project_user_dao.get_projects_for_user.return_value = [
        ProjectUserModel(
            username=MOCK_USERNAME,
            project_name=MOCK_PROJECT_NAME,
            permissions=[Permission.COLLABORATOR],
        ),
        ProjectUserModel(
            username=MOCK_USERNAME,
            project_name=SECONDARY_MOCK_PROJECT_NAME,
            permissions=[Permission.PROJECT_OWNER],
        ),
    ]
    # remove project name to test getting notebooks from multiple projects
    mock_event = _mock_event(False)
    mock_event["pathParameters"].pop("projectName")
    expected_response = generate_html_response(
        200,
        {
            "records": [
                _mock_notebook_metadata(1).to_dict(),
                _mock_notebook_metadata(2).to_dict(),
                _mock_notebook_metadata(3, project=SECONDARY_MOCK_PROJECT_NAME).to_dict(),
                _mock_notebook_metadata(4).to_dict(),
            ],
            "nextToken": "fakeToken",
        },
    )
    mock_resource_metadata_dao.get_all_for_user_by_type.return_value = PagedMetadataResults(
        [
            _mock_notebook_metadata(1),
            _mock_notebook_metadata(2),
            _mock_notebook_metadata(3, project=SECONDARY_MOCK_PROJECT_NAME),
            _mock_notebook_metadata(4),
            _mock_notebook_metadata(5, project="formerproject"),
        ],
        "fakeToken",
    )

    actual = lambda_handler(mock_event, mock_context)
    assert actual == expected_response
    mock_project_user_dao.get_projects_for_user.assert_called_with(MOCK_USERNAME)
    mock_resource_metadata_dao.get_all_for_user_by_type.assert_called_with(
        MOCK_USERNAME, ResourceType.NOTEBOOK, limit=100, next_token=None
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
def test_list_notebook_instances_client_error(mock_resource_metadata_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    exception_response = ClientError(error_msg, "ListNotebookInstances")
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = exception_response
    expected_response = generate_html_response(
        "400",
        "An error occurred (ThrottlingException) when calling the ListNotebookInstances operation: Dummy error message.",
    )
    assert lambda_handler(_mock_event(False), mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, limit=100, next_token=None
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
def test_list_notebook_instances_missing_parameter(mock_resource_metadata_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'requestContext'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_user_by_type.assert_not_called()
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_not_called()
