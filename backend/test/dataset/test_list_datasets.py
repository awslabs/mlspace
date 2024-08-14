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

# Testing for the list_datasets Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetModel
from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import DatasetType, Permission
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import list_resources as lambda_handler

user_name = "jdoe@amazon.com"
project_name = "example_project"
group_name = "test-group"
group_dataset_name = "example_group_dataset1"


# TODO: generate a user model so we can invoke to_dict on it for the event
def generate_user_model(is_admin=False):
    return UserModel(user_name, user_name, user_name, False, [Permission.ADMIN] if is_admin else [])


def generate_mock_event(is_admin=False):
    return {
        "pathParameters": {
            "projectName": project_name,
        },
        "requestContext": {
            "authorizer": {"principalId": user_name, "user": json.dumps(generate_user_model(is_admin).to_dict())},
            "resourcePath": "/admin/datasets" if is_admin else "",
        },
    }


mock_context = mock.Mock()

PRIVATE_PREFIX = "s3://mlspace-data-bucket/private"
MOCK_GROUP_USERS = [GroupUserModel(user_name, group_name)]


def _build_group_dataset(group: str, dataset: str) -> GroupDatasetModel:
    return GroupDatasetModel(dataset_name=dataset, group_name=group)


def _build_dataset(scope: str, name: str, user_name: str, type: str, groups=[]) -> DatasetModel:
    return DatasetModel(
        scope=scope,
        type=type,
        name=name,
        description=f"{name} description",
        location=f"{PRIVATE_PREFIX}/{scope}/datasets/{name}",
        created_by=user_name,
        groups=groups,
    )


def mock_get_datasets_for_group(group: str):
    return [
        _build_group_dataset(group, "example_group_dataset1"),
    ]


def mock_get_groups_for_dataset(dataset_name):
    return [
        _build_group_dataset(group_name, dataset_name),
    ]


def mock_get_all_for_scope(dataset_type: DatasetType, scope: str):
    if scope == DatasetType.GLOBAL:
        return [_build_dataset(scope=DatasetType.GLOBAL, name="example_global_dataset1", user_name="jdoe", type=dataset_type)]
    if scope == user_name:
        return [
            _build_dataset(
                scope=user_name,
                name="example_private_dataset1",
                user_name=user_name,
                type=dataset_type,
            ),
            _build_dataset(
                scope=user_name,
                name="example_private_dataset2",
                user_name=user_name,
                type=dataset_type,
            ),
        ]
    if scope == project_name:
        return [
            _build_dataset(
                scope=project_name,
                name="example_project_dataset1",
                user_name="otherUser",
                type=dataset_type,
            )
        ]
    if scope == DatasetType.GROUP:
        return [
            _build_dataset(
                scope=DatasetType.GROUP,
                name=group_dataset_name,
                user_name=user_name,
                type=dataset_type,
            )
        ]


@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_datasets(mock_dataset_dao, mock_group_user_dao, mock_group_dataset_dao):
    mock_dataset_dao.get_all_for_scope.side_effect = mock_get_all_for_scope
    mock_group_user_dao.get_groups_for_user.return_value = MOCK_GROUP_USERS
    mock_group_dataset_dao.get_datasets_for_group.side_effect = mock_get_datasets_for_group
    mock_dataset_dao.get.return_value = _build_dataset("group", group_dataset_name, user_name, DatasetType.GROUP)

    expected_datasets = mock_get_all_for_scope(DatasetType.GLOBAL, DatasetType.GLOBAL)
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.PRIVATE, user_name))
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.GROUP, DatasetType.GROUP))
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.PROJECT, project_name))

    expected_response = generate_html_response(
        200,
        [dataset.to_dict() for dataset in expected_datasets],
    )

    assert lambda_handler(generate_mock_event(), mock_context) == expected_response


@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_all(mock_dataset_dao, mock_group_dataset_dao):
    mock_group_dataset_dao.get_groups_for_dataset.side_effect = mock_get_groups_for_dataset

    expected_datasets = mock_get_all_for_scope(DatasetType.GLOBAL, DatasetType.GLOBAL)
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.PRIVATE, user_name))
    expected_datasets.extend(
        [
            _build_dataset(
                scope=DatasetType.GROUP,
                name=group_dataset_name,
                user_name=user_name,
                type=DatasetType.GROUP,
                groups=[group_name],
            )
        ]
    )
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.PROJECT, project_name))

    mock_dataset_dao.get_all.return_value = expected_datasets

    expected_response = generate_html_response(
        200,
        [dataset.to_dict() for dataset in expected_datasets],
    )

    assert lambda_handler(generate_mock_event(True), mock_context) == expected_response


@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_user_datasets(mock_dataset_dao, mock_group_user_dao, mock_group_dataset_dao):
    mock_dataset_dao.get_all_for_scope.side_effect = mock_get_all_for_scope
    mock_group_user_dao.get_groups_for_user.side_effect = [MOCK_GROUP_USERS]
    mock_group_dataset_dao.get_datasets_for_group.side_effect = mock_get_datasets_for_group
    mock_dataset_dao.get.return_value = _build_dataset("group", group_dataset_name, user_name, DatasetType.GROUP)

    expected_datasets = mock_get_all_for_scope(DatasetType.GLOBAL, DatasetType.GLOBAL)
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.PRIVATE, user_name))
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.GROUP, DatasetType.GROUP))
    expected_response = generate_html_response(
        200,
        [dataset.to_dict() for dataset in expected_datasets],
    )

    assert (
        lambda_handler(
            {
                "requestContext": {
                    "authorizer": {"principalId": user_name, "user": json.dumps(generate_user_model().to_dict())}
                },
                "pathParameters": None,
            },
            mock_context,
        )
        == expected_response
    )


@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_datasets_success_no_datasets(mock_dataset_dao, mock_group_user_dao, mock_group_dataset_dao):
    mock_dataset_dao.get_all_for_scope.side_effect = lambda x, y: []
    mock_group_user_dao.get_groups_for_user.side_effect = [MOCK_GROUP_USERS]
    mock_group_dataset_dao.get_datasets_for_group.return_value = []
    mock_dataset_dao.get.return_value = _build_dataset("group", group_dataset_name, user_name, DatasetType.GROUP)
    expected_response = generate_html_response(200, [])

    assert lambda_handler(generate_mock_event(), mock_context) == expected_response

    mock_dataset_dao.get_all_for_scope.assert_has_calls(
        [
            mock.call(DatasetType.GLOBAL, DatasetType.GLOBAL),
            mock.call(DatasetType.PRIVATE, user_name),
            mock.call(DatasetType.PROJECT, project_name),
        ]
    )

    mock_group_user_dao.get_groups_for_user.assert_has_calls([mock.call(user_name)])


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_datasets_client_error(mock_dataset_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the Query operation: Dummy error message.",
    )
    mock_dataset_dao.get_all_for_scope.side_effect = ClientError(error_msg, "Query")

    assert lambda_handler(generate_mock_event(), mock_context) == expected_response

    mock_dataset_dao.get_all_for_scope.assert_called_with(DatasetType.GLOBAL, DatasetType.GLOBAL)
