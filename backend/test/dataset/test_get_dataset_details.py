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

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetModel
from ml_space_lambda.enums import DatasetType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

mock_context = mock.Mock()
mock_group_name = "TestGroup1"
mock_ds_name = "sample-group-dataset"


def generate_group_dataset():
    return GroupDatasetModel(group_name=mock_group_name, dataset_name=mock_ds_name)


def generate_dataset():
    return DatasetModel(
        DatasetType.GROUP,
        DatasetType.GROUP,
        mock_ds_name,
        "Dataset for testing edit.",
        "s3://mlspace-datasets-123456789/group/datasets/sample-group-dataset",
        "testUser",
    )


# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import get as lambda_handler


def build_mock_event(dataset: DatasetModel):
    return {"pathParameters": {"scope": dataset.scope, "datasetName": dataset.name}}


@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_get_dataset_details_success(mock_dataset_dao, mock_group_dataset_dao):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}

    mock_dataset_with_groups = generate_dataset()
    mock_dataset_with_groups.groups = [mock_group_name]

    mock_dataset = generate_dataset()
    mock_dataset_dao.get.return_value = mock_dataset

    mock_group_dataset_dao.get_groups_for_dataset.return_value = [generate_group_dataset()]

    expected_response = generate_html_response(200, mock_dataset_with_groups.to_dict())
    mock_event = build_mock_event(mock_dataset)
    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_dataset_dao.get.assert_called_with(mock_dataset.scope, mock_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_get_dataset_details_not_found(mock_dataset_dao, mock_global_dataset):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}
    mock_dataset_dao.get.return_value = None
    expected_response = generate_html_response(404, "Dataset 'example_dataset' does not exist.")
    mock_event = build_mock_event(mock_global_dataset)
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_get_dataset_details_client_error(mock_dataset_dao, mock_global_dataset):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )
    mock_dataset_dao.get.side_effect = ClientError(error_msg, "GetItem")
    assert lambda_handler(build_mock_event(mock_global_dataset), mock_context) == expected_response
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_get_dataset_details_missing_parameters(mock_dataset_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_dataset_dao.get.assert_not_called()
