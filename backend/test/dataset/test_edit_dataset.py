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
import random
import string
from unittest import mock

from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.enums import DatasetType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import edit as lambda_handler

mock_ds_scope = DatasetType.GLOBAL.value
mock_ds_name = "example_dataset"
event_body = {
    "scope": mock_ds_scope,
    "name": mock_ds_name,
    "description": "This is an updated description for the existing dataset.",
}
mock_event = {
    "body": json.dumps(event_body),
    "pathParameters": {"scope": mock_ds_scope, "datasetName": mock_ds_name},
}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_edit_dataset_success(mock_dataset_dao, mock_global_dataset):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, "Successfully updated example_dataset.")
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_dataset_dao.update.return_value = None
    assert lambda_handler(mock_event, mock_context) == expected_response
    updated_dict = {**mock_global_dataset.to_dict(), **event_body}
    mock_dataset_dao.update.assert_called_once()
    # The third arg is the DatasetModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    # in this particular case because we're building the class inside of update
    assert mock_dataset_dao.update.call_args.args[2].to_dict() == updated_dict


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_edit_nonexistent_dataset(mock_dataset_dao):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(404, f"Dataset '{mock_ds_name}' does not exist.")
    mock_dataset_dao.get.return_value = None

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_dataset_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_edit_dataset_client_error(mock_dataset_dao, mock_global_dataset):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the UpdateItem operation: Dummy error message.",
    )
    mock_dataset_dao.get.return_value = mock_global_dataset
    mock_dataset_dao.update.side_effect = ClientError(error_msg, "UpdateItem")

    assert lambda_handler(mock_event, mock_context) == expected_response

    updated_dict = {**mock_global_dataset.to_dict(), **event_body}
    mock_dataset_dao.update.assert_called_once()
    # The third arg is the DatasetModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    # in this particular case because we're building the class inside of update
    assert mock_dataset_dao.update.call_args.args[2].to_dict() == updated_dict


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_edit_dataset_missing_parameters(mock_dataset_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_dataset_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_edit_dataset_invalid_description(mock_dataset_dao, mock_global_dataset):
    expected_response = generate_html_response(400, "Bad Request: Dataset description contains invalid character.")
    update_event = {
        "body": json.dumps({"description": "!!! $$$ ####"}),
        "pathParameters": {"scope": mock_ds_scope, "datasetName": mock_ds_name},
    }
    mock_dataset_dao.get.return_value = mock_global_dataset

    assert lambda_handler(update_event, mock_context) == expected_response
    mock_dataset_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_edit_dataset_long_description(mock_dataset_dao, mock_global_dataset):
    expected_response = generate_html_response(
        400, "Bad Request: Dataset description is over the max length of 254 characters."
    )
    update_event = {
        "body": json.dumps({"description": "".join(random.choices(string.ascii_uppercase + string.digits, k=300))}),
        "pathParameters": {"scope": mock_ds_scope, "datasetName": mock_ds_name},
    }
    mock_dataset_dao.get.return_value = mock_global_dataset

    assert lambda_handler(update_event, mock_context) == expected_response
    mock_dataset_dao.update.assert_not_called()
