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


# Testing for the list_datasets Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.enums import DatasetType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import list_resources as lambda_handler

user_name = "jdoe@amazon.com"
project_name = "example_project"

mock_event = {
    "pathParameters": {
        "projectName": project_name,
    },
    "requestContext": {"authorizer": {"principalId": user_name}},
}
mock_context = mock.Mock()

PRIVATE_PREFIX = "s3://mlspace-data-bucket/private"


def _build_dataset(scope: str, name: str, user_name: str, data_fomat: str) -> DatasetModel:
    return DatasetModel(
        scope=scope,
        name=name,
        description=f"{name} description",
        format=data_fomat,
        location=f"{PRIVATE_PREFIX}/{scope}/datasets/{name}",
        created_by=user_name,
    )


def mock_get_all_for_scope(dataset_type: DatasetType, scope: str):
    if scope == DatasetType.GLOBAL.value:
        return [
            _build_dataset(
                scope=DatasetType.GLOBAL.value,
                name="example_global_dataset1",
                data_fomat="zip",
                user_name="jdoe",
            )
        ]
    if scope == user_name:
        return [
            _build_dataset(
                scope=user_name,
                name="example_private_dataset1",
                data_fomat="text/plain",
                user_name=user_name,
            ),
            _build_dataset(
                scope=user_name,
                name="example_private_dataset2",
                data_fomat="image/jpeg",
                user_name=user_name,
            ),
        ]
    if scope == project_name:
        return [
            _build_dataset(
                scope=project_name,
                name="example_project_dataset1",
                data_fomat="image/jpeg",
                user_name="otherUser",
            )
        ]


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_datasets(mock_dataset_dao):
    mock_dataset_dao.get_all_for_scope.side_effect = mock_get_all_for_scope

    expected_datasets = mock_get_all_for_scope(DatasetType.GLOBAL, DatasetType.GLOBAL.value)
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.PRIVATE, user_name))
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.PROJECT, project_name))
    expected_response = generate_html_response(
        200,
        [dataset.to_dict() for dataset in expected_datasets],
    )

    assert lambda_handler(mock_event, mock_context) == expected_response


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_user_datasets(mock_dataset_dao):
    mock_dataset_dao.get_all_for_scope.side_effect = mock_get_all_for_scope

    expected_datasets = mock_get_all_for_scope(DatasetType.GLOBAL, DatasetType.GLOBAL.value)
    expected_datasets.extend(mock_get_all_for_scope(DatasetType.PRIVATE, user_name))
    expected_response = generate_html_response(
        200,
        [dataset.to_dict() for dataset in expected_datasets],
    )

    assert (
        lambda_handler(
            {"requestContext": {"authorizer": {"principalId": user_name}}, "pathParameters": None},
            mock_context,
        )
        == expected_response
    )


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_datasets_success_no_datasets(mock_dataset_dao):
    mock_dataset_dao.get_all_for_scope.side_effect = lambda x, y: []
    expected_response = generate_html_response(200, [])

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_dataset_dao.get_all_for_scope.assert_has_calls(
        [
            mock.call(DatasetType.GLOBAL, DatasetType.GLOBAL.value),
            mock.call(DatasetType.PRIVATE, user_name),
            mock.call(DatasetType.PROJECT, project_name),
        ]
    )


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

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_dataset_dao.get_all_for_scope.assert_called_with(DatasetType.GLOBAL, DatasetType.GLOBAL.value)
