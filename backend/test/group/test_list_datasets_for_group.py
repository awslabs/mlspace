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

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetModel
from ml_space_lambda.enums import DatasetType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import group_datasets as lambda_handler

MOCK_GROUP_NAME = "example_group"
PRIVATE_PREFIX = "s3://mlspace-data-bucket/private"
mock_event = {
    "pathParameters": {
        "groupName": MOCK_GROUP_NAME,
    },
}
mock_context = mock.Mock()


def _build_dataset(scope: str, name: str, user_name: str, dataset_type: DatasetType) -> DatasetModel:
    return DatasetModel(
        scope=scope,
        type=dataset_type,
        name=name,
        description=f"{name} description",
        location=f"{PRIVATE_PREFIX}/{scope}/datasets/{name}",
        created_by=user_name,
    )


@mock.patch("ml_space_lambda.group.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dataset_dao")
def test_list_datasets_for_group_success(mock_group_dataset_dao, mock_dataset_dao):
    group_datasets = [
        GroupDatasetModel(
            group_name=MOCK_GROUP_NAME,
            dataset_name="Dataset1",
        ),
        GroupDatasetModel(
            group_name=MOCK_GROUP_NAME,
            dataset_name="Dataset2",
        ),
        GroupDatasetModel(
            group_name=MOCK_GROUP_NAME,
            dataset_name="Dataset3",
        ),
    ]

    datasets = [
        _build_dataset("group", group_datasets[0].dataset, "test_user", DatasetType.GROUP),
        _build_dataset("group", group_datasets[1].dataset, "test_user", DatasetType.GROUP),
        _build_dataset("group", group_datasets[2].dataset, "test_user", DatasetType.GROUP),
    ]

    expected_response = generate_html_response(
        200,
        [record.to_dict() for record in datasets],
    )
    mock_group_dataset_dao.get_datasets_for_group.return_value = group_datasets
    mock_dataset_dao.get.side_effect = datasets

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_dataset_dao.get_datasets_for_group.assert_called_with(MOCK_GROUP_NAME)
    mock_dataset_dao.get.assert_has_calls(
        [mock.call("group", "Dataset1"), mock.call("group", "Dataset2"), mock.call("group", "Dataset3")]
    )


@mock.patch("ml_space_lambda.group.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dataset_dao")
def test_list_datasets_for_group_client_error(mock_group_dataset_dao, mock_dataset_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the Scan operation: Dummy error message.",
    )
    mock_group_dataset_dao.get_datasets_for_group.side_effect = ClientError(error_msg, "Scan")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_group_dataset_dao.get_datasets_for_group.assert_called_with(MOCK_GROUP_NAME)
    mock_dataset_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dataset_dao")
def test_list_datasets_for_group_missing_parameters(mock_group_dataset_dao, mock_dataset_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_group_dataset_dao.get_datasets_for_group.assert_not_called()
    mock_dataset_dao.get.assert_not_called()
