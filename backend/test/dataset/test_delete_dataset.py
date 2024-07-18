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

# Testing for the delete_dataset Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetModel
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import delete as lambda_handler


@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3_resource")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_delete_dataset_success_without_groups(mock_dataset_dao, mock_s3, group_dataset_dao, mock_private_dataset):
    mock_event = {
        "pathParameters": {
            "scope": mock_private_dataset.scope,
            "datasetName": mock_private_dataset.name,
        },
    }

    mock_bucket = mock.MagicMock()
    mock_s3.Bucket.return_value = mock_bucket
    mock_dataset_dao.get.return_value = mock_private_dataset
    mock_dataset_dao.delete.return_value = None
    expected_response = generate_html_response(200, f"Successfully deleted {mock_private_dataset.name}")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_bucket.objects.filter.assert_called_with(
        Prefix=f"private/{mock_private_dataset.scope}/datasets/{mock_private_dataset.name}/"
    )
    mock_dataset_dao.get.assert_called_with(mock_private_dataset.scope, mock_private_dataset.name)
    mock_dataset_dao.delete.assert_called_with(mock_private_dataset.scope, mock_private_dataset.name)


@mock.patch("ml_space_lambda.dataset.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3_resource")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_delete_dataset_success_with_groups(mock_dataset_dao, mock_s3, group_dataset_dao, mock_iam_manager, mock_private_dataset):
    mock_event = {
        "pathParameters": {
            "scope": mock_private_dataset.scope,
            "datasetName": mock_private_dataset.name,
        },
    }

    group_dataset_1 = GroupDatasetModel(group_name="TestGroup1", dataset_name="TestDataset1")
    group_dataset_2 = GroupDatasetModel(group_name="TestGroup2", dataset_name="TestDataset2")

    mock_bucket = mock.MagicMock()
    mock_s3.Bucket.return_value = mock_bucket
    mock_dataset_dao.get.return_value = mock_private_dataset
    group_dataset_dao.get_groups_for_dataset.return_value = [group_dataset_1, group_dataset_2]
    mock_dataset_dao.delete.return_value = None
    expected_response = generate_html_response(200, f"Successfully deleted {mock_private_dataset.name}")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_bucket.objects.filter.assert_called_with(
        Prefix=f"private/{mock_private_dataset.scope}/datasets/{mock_private_dataset.name}/"
    )
    mock_dataset_dao.get.assert_called_with(mock_private_dataset.scope, mock_private_dataset.name)
    mock_dataset_dao.delete.assert_called_with(mock_private_dataset.scope, mock_private_dataset.name)
    group_dataset_dao.get_groups_for_dataset.assert_called_with(mock_private_dataset.name)
    group_dataset_dao.delete.assert_has_calls(
        [
            mock.call(group_dataset_1.group, group_dataset_1.dataset),
            mock.call(group_dataset_2.group, group_dataset_2.dataset),
        ]
    )
    mock_iam_manager.update_groups.assert_called()


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3_resource")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_delete_non_existent_dataset(mock_dataset_dao, mock_s3):
    dataset_name = "example_dataset"
    username = "jdoe@amazon.com"

    mock_event = {
        "pathParameters": {"scope": username, "datasetName": dataset_name},
    }

    mock_bucket = mock.MagicMock()
    mock_s3.Bucket.return_value = mock_bucket
    mock_dataset_dao.get.return_value = None
    mock_dataset_dao.delete.return_value = None

    expected_response = generate_html_response(400, f"Bad Request: Requested dataset, '{dataset_name}' does not exist.")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_bucket.objects.filter.assert_not_called()
    mock_dataset_dao.delete.assert_not_called()


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3_resource")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_delete_dataset_client_error(mock_dataset_dao, mock_s3, mock_global_dataset):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the Delete operation: Dummy error message.",
    )

    mock_event = {
        "pathParameters": {
            "scope": mock_global_dataset.scope,
            "datasetName": mock_global_dataset.name,
        },
    }

    mock_bucket = mock.MagicMock()
    mock_s3.Bucket.return_value = mock_bucket
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_bucket.objects.filter(Prefix=f"global/datasets/{mock_global_dataset.name}/").delete.side_effect = ClientError(
        error_msg, "Delete"
    )

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_bucket.objects.filter.assert_called_with(Prefix=f"global/datasets/{mock_global_dataset.name}/")


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3_resource")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_delete_dataset_missing_parameters(mock_dataset_dao, mock_s3):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_s3.Bucket.assert_not_called()
    mock_dataset_dao.get.assert_not_called()
