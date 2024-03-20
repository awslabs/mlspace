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

import pytest

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.enums import DatasetType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "DATA_BUCKET": "mlspace-data-bucket"}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import create_dataset as lambda_handler

test_dataset_name = "example_dataset"


def generate_event(dataset_type: str, dataset_scope: str):
    return {
        "body": json.dumps(
            {
                "datasetName": test_dataset_name,
                "datasetType": dataset_type,
                "datasetDescription": "example description",
                "datasetFormat": "text/plain",
                "datasetScope": dataset_scope,
            }
        ),
        "headers": {
            "x-mlspace-dataset-type": dataset_type,
            "x-mlspace-dataset-scope": dataset_scope,
        },
        "requestContext": {"authorizer": {"principalId": "jdoe"}},
    }


def generate_dataset_model(event: dict, scope: str, dataset_location: str):
    body = json.loads(event["body"])
    return DatasetModel(
        scope=scope,
        name=test_dataset_name,
        description=body.get("datasetDescription", ""),
        format=body.get("datasetFormat", "text/plain"),
        location=dataset_location,
        created_by=event["requestContext"]["authorizer"]["principalId"],
    )


@pytest.mark.parametrize(
    "dataset_type,scope",
    [
        (DatasetType.GLOBAL.value, "global"),
        (DatasetType.PROJECT.value, "project_name"),
        (DatasetType.PRIVATE.value, "username"),
    ],
    ids=[
        "create_global_dataset",
        "create_project_dataset",
        "create_private_dataset",
    ],
)
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_create_dataset_success(mock_s3, mock_dataset_dao, dataset_type: str, scope: str):
    mock_event = generate_event(dataset_type, scope)
    mock_dataset_dao.get.return_value = None

    if scope == DatasetType.GLOBAL.value:
        directory_name = f"{scope}/datasets/{test_dataset_name}/"
    else:
        directory_name = f"{dataset_type}/{scope}/datasets/{test_dataset_name}/"

    dataset_location = f's3://{TEST_ENV_CONFIG["DATA_BUCKET"]}/{directory_name}'

    test_dataset = generate_dataset_model(event=mock_event, scope=scope, dataset_location=dataset_location)
    success_response = {"status": "success", "dataset": test_dataset.to_dict()}
    expected_response = generate_html_response(200, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_create_dataset_already_exists(mock_dataset_dao):
    scope = "global"
    mock_event = generate_event(DatasetType.GLOBAL.value, scope)
    mock_dataset_dao.get.return_value = True
    error_message = f"Bad Request: Dataset {test_dataset_name} already exists."

    expected_response = generate_html_response(400, error_message)

    assert lambda_handler(mock_event, mock_context) == expected_response


def test_create_dataset_manipulated_type():
    scope = "global"
    mock_event = generate_event(DatasetType.GLOBAL.value, scope)
    mock_event["headers"] = {"x-mlspace-dataset-type": "private", "x-mlspace-dataset-scope": scope}

    expected_response = generate_html_response(400, "Bad Request: Dataset headers do not match expected type and scope.")

    assert lambda_handler(mock_event, mock_context) == expected_response


def test_create_dataset_manipulated_scope():
    scope = "global"

    mock_event = generate_event(DatasetType.GLOBAL.value, scope)
    mock_event["headers"] = {"x-mlspace-dataset-type": "private", "x-mlspace-dataset-scope": "jdoe"}

    expected_response = generate_html_response(400, "Bad Request: Dataset headers do not match expected type and scope.")

    assert lambda_handler(mock_event, mock_context) == expected_response
