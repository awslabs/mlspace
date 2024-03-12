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

# Testing for the delete_file_from_dataset Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "DATA_BUCKET": "mlspace-data-bucket"}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import delete_file as lambda_handler

mock_event = {
    "pathParameters": {"scope": "global", "datasetName": "example_dataset", "file": "image.png"}
}
mock_context = mock.Mock()

mock_delete_response = {"DeleteMarker": True, "VersionId": "version1"}
expected_success_response = generate_html_response(200, mock_delete_response)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_delete_file_from_dataset_success(mock_s3, mock_dataset_dao, mock_global_dataset):
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_s3.delete_object.return_value = mock_delete_response

    assert lambda_handler(mock_event, mock_context) == expected_success_response

    mock_s3.delete_object.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"], Key="global/datasets/example_dataset/image.png"
    )
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_delete_file_from_dataset_with_spaces(mock_s3, mock_dataset_dao, mock_global_dataset):
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_s3.delete_object.return_value = mock_delete_response

    assert (
        lambda_handler(
            {
                "pathParameters": {
                    "scope": "global",
                    "datasetName": "example_dataset",
                    "file": "file%20with%20spaces.png",
                }
            },
            mock_context,
        )
        == expected_success_response
    )

    mock_s3.delete_object.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"],
        Key="global/datasets/example_dataset/file with spaces.png",
    )
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_delete_file_from_dataset_client_error(mock_s3, mock_dataset_dao, mock_global_dataset):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the"
        " DeleteObject operation: Dummy error message.",
    )
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_s3.delete_object.side_effect = ClientError(error_msg, "DeleteObject")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_s3.delete_object.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"], Key="global/datasets/example_dataset/image.png"
    )
    mock_dataset_dao.get.assert_called_with(mock_global_dataset.scope, mock_global_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_delete_file_from_dataset_missing_parameters(mock_s3, mock_dataset_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_s3.delete_object.assert_not_called()
    mock_dataset_dao.get.assert_not_called()
