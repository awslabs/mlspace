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


# Testing for the list_dataset_files Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "DATA_BUCKET": "mlspace-data-bucket"}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import list_files as lambda_handler


def build_mock_event(dataset: DatasetModel):
    return {
        "pathParameters": {"scope": dataset.scope, "datasetName": dataset.name},
        "queryStringParameters": None,
    }


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_list_dataset_files_success(mock_s3, mock_dataset_dao, mock_global_dataset):
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_s3.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "global/datasets/example_dataset/file1.txt", "Size": 643},
            {"Key": "global/datasets/example_dataset/file2.png", "Size": 1243},
        ]
    }

    expected_response = generate_html_response(
        200,
        {
            "Keys": [
                {"key": "global/datasets/example_dataset/file1.txt", "size": 643},
                {"key": "global/datasets/example_dataset/file2.png", "size": 1243},
            ],
        },
    )

    assert lambda_handler(build_mock_event(mock_global_dataset), mock_context) == expected_response

    mock_s3.list_objects_v2.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"], Prefix="global/datasets/example_dataset/"
    )
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_list_dataset_files_empty(mock_s3, mock_dataset_dao, mock_global_dataset):
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_s3.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "global/datasets/example_dataset/", "Size": 0},
        ]
    }

    expected_response = generate_html_response(
        200,
        {
            "Keys": [],
        },
    )

    assert lambda_handler(build_mock_event(mock_global_dataset), mock_context) == expected_response

    mock_s3.list_objects_v2.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"], Prefix="global/datasets/example_dataset/"
    )
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_list_dataset_files_success_next_token(mock_s3, mock_dataset_dao, mock_global_dataset):
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_s3.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "global/datasets/example_dataset/file1.txt", "Size": 643},
            {"Key": "global/datasets/example_dataset/file2.png", "Size": 1243},
        ],
        "NextContinuationToken": "continueNextToken",
    }

    expected_response = generate_html_response(
        200,
        {
            "Keys": [
                {"key": "global/datasets/example_dataset/file1.txt", "size": 643},
                {"key": "global/datasets/example_dataset/file2.png", "size": 1243},
            ],
            "nextToken": "continueNextToken",
        },
    )

    mock_event = build_mock_event(mock_global_dataset)
    mock_event["queryStringParameters"] = {
        "nextToken": "nextTokenExample",
    }
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_s3.list_objects_v2.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"],
        Prefix="global/datasets/example_dataset/",
        ContinuationToken="nextTokenExample",
    )
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_list_dataset_files_empty_dataset(mock_s3, mock_dataset_dao, mock_global_dataset):
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_s3.list_objects_v2.return_value = {}
    expected_response = generate_html_response(200, {"Keys": []})

    assert lambda_handler(build_mock_event(mock_global_dataset), mock_context) == expected_response

    mock_s3.list_objects_v2.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"], Prefix="global/datasets/example_dataset/"
    )
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_list_dataset_files_client_error(mock_s3, mock_dataset_dao, mock_global_dataset):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the"
        " ListObjectsV2 operation: Dummy error message.",
    )

    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_s3.list_objects_v2.side_effect = ClientError(error_msg, "ListObjectsV2")

    assert lambda_handler(build_mock_event(mock_global_dataset), mock_context) == expected_response

    mock_s3.list_objects_v2.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"], Prefix="global/datasets/example_dataset/"
    )
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_list_dataset_files_missing_parameters(mock_s3, mock_dataset_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_s3.list_objects_v2.assert_not_called()
    mock_dataset_dao.get.assert_not_called()
