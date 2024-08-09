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
from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import Permission, ResourceType
from ml_space_lambda.project.lambda_functions import _get_resource_counts
from ml_space_lambda.utils.common_functions import generate_html_response, serialize_permissions

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

MOCK_PROJECT = ProjectModel(
    name="test_project",
    description="Project used for unit testing",
    suspended=False,
    created_by="jdoe@example.com",
)

MOCK_PROJECT_USER = ProjectUserModel(
    username=MOCK_PROJECT.created_by,
    project_name=MOCK_PROJECT.name,
    permissions=[Permission.PROJECT_OWNER],
)

MOCK_USER = UserModel(MOCK_PROJECT.created_by, MOCK_PROJECT.created_by, "John Doe", False)

mock_event = {
    "requestContext": {
        "authorizer": {
            "principalId": MOCK_PROJECT.created_by,
            "user": json.dumps(MOCK_USER.to_dict()),
        }
    },
    "pathParameters": {"projectName": MOCK_PROJECT.name},
    "queryStringParameters": {"includeResourceCounts": False},
}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import get as lambda_handler


@mock.patch("ml_space_lambda.project.lambda_functions.is_owner_of_project")
@mock.patch("ml_space_lambda.project.lambda_functions.is_member_of_project")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_get_project(mock_project_dao, mock_project_user_dao, mock_is_member_of_project, mock_is_owner_of_project):
    mock_project_dao.get.return_value = MOCK_PROJECT
    mock_project_user_dao.get.return_value = MOCK_PROJECT_USER
    mock_is_member_of_project.return_value = True
    mock_is_owner_of_project.return_value = True
    expected_response = generate_html_response(
        200,
        {
            "project": MOCK_PROJECT.to_dict(),
            "permissions": serialize_permissions(MOCK_PROJECT_USER.permissions),
            "resourceCounts": {},
        },
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT.name)
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT.name, MOCK_PROJECT.created_by)


@mock.patch("ml_space_lambda.project.lambda_functions.is_member_of_project")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_get_project_not_a_member(mock_project_dao, mock_project_user_dao, mock_is_member_of_project):
    mock_project_dao.get.return_value = MOCK_PROJECT
    mock_project_user_dao.get.return_value = None
    mock_is_member_of_project.return_value = False
    expected_response = generate_html_response(
        400,
        f"Bad Request: User is not a member of project {MOCK_PROJECT.name}.",
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT.name)
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT.name, MOCK_PROJECT.created_by)


@mock.patch("ml_space_lambda.project.lambda_functions.is_owner_of_project")
@mock.patch("ml_space_lambda.project.lambda_functions.is_member_of_project")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_get_project_admin(mock_project_dao, mock_project_user_dao, mock_is_member_of_project, mock_is_owner_of_project):
    mock_project_dao.get.return_value = MOCK_PROJECT
    mock_project_user_dao.get.return_value = None
    mock_is_member_of_project.return_value = False
    mock_is_owner_of_project.return_value = False
    expected_response = generate_html_response(
        200,
        {
            "project": MOCK_PROJECT.to_dict(),
            "permissions": [],
            "resourceCounts": {},
        },
    )
    mock_admin = UserModel(MOCK_PROJECT.created_by, MOCK_PROJECT.created_by, "John Doe", False, [Permission.ADMIN])
    admin_event = {
        "requestContext": {
            "authorizer": {
                "principalId": MOCK_PROJECT.created_by,
                "user": json.dumps(mock_admin.to_dict()),
            }
        },
        "pathParameters": {"projectName": MOCK_PROJECT.name},
        "queryStringParameters": {"includeResourceCounts": False},
    }
    assert lambda_handler(admin_event, mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT.name)
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT.name, MOCK_PROJECT.created_by)


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_get_nonexistent_project(mock_project_dao, mock_project_user_dao):
    mock_project_dao.get.return_value = None
    expected_response = generate_html_response(
        404,
        f"Specified project {MOCK_PROJECT.name} does not exist.",
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT.name)
    mock_project_user_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_list_all_projects_client_error(mock_project_dao, mock_project_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    mock_project_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT.name)
    mock_project_user_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
def test_get_resource_counts(mock_resource_metadata_dao):
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults(
        [
            ResourceMetadataModel(
                "identifier",
                ResourceType.ENDPOINT,  # Doesnt matter
                "username",
                MOCK_PROJECT.name,
                {
                    "FakeStatus": "InService",
                },
            )
        ]
    )

    expected_dict = {}
    for resource_type in ResourceType:
        expected_dict[resource_type] = {"Total": 1, "Inservice": 1}

    _get_resource_counts.cache_clear()

    assert _get_resource_counts(MOCK_PROJECT.name) == expected_dict
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [mock.call(MOCK_PROJECT.name, resource, fetch_all=True) for resource in ResourceType]
    )


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
def test_get_resource_counts_zero_counts(mock_resource_metadata_dao):
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults([])

    expected_dict = {}
    for resource_type in ResourceType:
        expected_dict[resource_type] = {"Total": 0}

    _get_resource_counts.cache_clear()

    assert _get_resource_counts(MOCK_PROJECT.name) == expected_dict
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [mock.call(MOCK_PROJECT.name, resource, fetch_all=True) for resource in ResourceType]
    )


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
def test_get_resource_counts_verify_caching(mock_resource_metadata_dao):

    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults([])

    expected_dict = {}
    for resource_type in ResourceType:
        expected_dict[resource_type] = {"Total": 0}

    _get_resource_counts.cache_clear()

    assert _get_resource_counts(MOCK_PROJECT.name) == expected_dict
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [mock.call(MOCK_PROJECT.name, resource, fetch_all=True) for resource in ResourceType]
    )

    # Gather first time call count
    first_pass_call_count = mock_resource_metadata_dao.get_all_for_project_by_type.call_count
    assert first_pass_call_count == len(ResourceType)

    # Check that we dont call the function again since it is cached
    assert _get_resource_counts(MOCK_PROJECT.name) == expected_dict
    assert mock_resource_metadata_dao.get_all_for_project_by_type.call_count == first_pass_call_count

    # Clear Cache and verify that the call count increases
    _get_resource_counts.cache_clear()
    assert _get_resource_counts(MOCK_PROJECT.name) == expected_dict

    assert mock_resource_metadata_dao.get_all_for_project_by_type.call_count == first_pass_call_count * 2
