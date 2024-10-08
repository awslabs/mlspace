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
from botocore.exceptions import ClientError

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
                "datasetScope": dataset_scope,
                "datasetGroups": ["TestGroup1,TestGroup2"],
            }
        ),
        "headers": {
            "x-mlspace-dataset-type": dataset_type,
            "x-mlspace-dataset-scope": "TestGroup1,TestGroup2" if dataset_type == DatasetType.GROUP else dataset_scope,
        },
        "requestContext": {"authorizer": {"principalId": "jdoe"}},
    }


def generate_dataset_model(event: dict, scope: str, dataset_location: str, type: str):
    body = json.loads(event["body"])
    return DatasetModel(
        scope=scope,
        type=type,
        name=test_dataset_name,
        description=body.get("datasetDescription", ""),
        location=dataset_location,
        created_by=event["requestContext"]["authorizer"]["principalId"],
        groups=body.get("datasetGroups") if type == DatasetType.GROUP else [],
    )


@pytest.mark.parametrize(
    "dataset_type,scope",
    [
        (DatasetType.GLOBAL, DatasetType.GLOBAL),
        (DatasetType.PROJECT, "project_name"),
        (DatasetType.PRIVATE, "username"),
        (DatasetType.GROUP, DatasetType.GROUP),
    ],
    ids=[
        "create_global_dataset",
        "create_project_dataset",
        "create_private_dataset",
        "create_group_dataset",
    ],
)
@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_create_dataset_success(
    mock_s3, mock_dataset_dao, mock_iam_manager, mock_group_dataset_dao, dataset_type: str, scope: str
):
    mock_event = generate_event(dataset_type, scope)
    mock_dataset_dao.get.return_value = None

    if dataset_type == DatasetType.GLOBAL or dataset_type == DatasetType.GROUP:
        directory_name = f"{dataset_type}/datasets/{test_dataset_name}/"
    else:
        directory_name = f"{dataset_type}/{scope}/datasets/{test_dataset_name}/"

    dataset_location = f's3://{TEST_ENV_CONFIG["DATA_BUCKET"]}/{directory_name}'

    test_dataset = generate_dataset_model(event=mock_event, scope=scope, dataset_location=dataset_location, type=dataset_type)
    success_response = {"status": "success", "dataset": test_dataset.to_dict()}
    expected_response = generate_html_response(200, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response
    if dataset_type == DatasetType.GROUP:
        mock_group_dataset_dao.create.assert_called()


@mock.patch("ml_space_lambda.dataset.lambda_functions.group_dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_create_dataset_fail_with_rollback(mock_s3, mock_dataset_dao, mock_iam_manager, mock_group_dataset_dao):
    mock_event = generate_event(DatasetType.GROUP, DatasetType.GROUP)
    mock_dataset_dao.get.return_value = None
    directory_name = f"{DatasetType.GROUP}/datasets/{test_dataset_name}/"

    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_iam_manager.update_groups.side_effect = ClientError(error_msg, "GetItem")

    dataset_location = f's3://{TEST_ENV_CONFIG["DATA_BUCKET"]}/{directory_name}'

    test_dataset = generate_dataset_model(
        event=mock_event, scope=DatasetType.GROUP, dataset_location=dataset_location, type=DatasetType.GROUP
    )
    success_response = {"status": "success", "dataset": test_dataset.to_dict()}
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    assert mock_dataset_dao.delete.call_count == 1


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_create_dataset_already_exists(mock_dataset_dao):
    scope = "global"
    mock_event = generate_event(DatasetType.GLOBAL, scope)
    mock_dataset_dao.get.return_value = True
    error_message = f"Bad Request: Dataset {test_dataset_name} already exists."

    expected_response = generate_html_response(400, error_message)

    assert lambda_handler(mock_event, mock_context) == expected_response


def test_create_dataset_manipulated_type():
    scope = "global"
    mock_event = generate_event(DatasetType.GLOBAL, scope)
    mock_event["headers"] = {"x-mlspace-dataset-type": "private", "x-mlspace-dataset-scope": scope}

    expected_response = generate_html_response(400, "Bad Request: Dataset headers do not match expected type and scope.")

    assert lambda_handler(mock_event, mock_context) == expected_response


def test_create_dataset_manipulated_scope():
    scope = "global"

    mock_event = generate_event(DatasetType.GLOBAL, scope)
    mock_event["headers"] = {"x-mlspace-dataset-type": "private", "x-mlspace-dataset-scope": "jdoe"}

    expected_response = generate_html_response(400, "Bad Request: Dataset headers do not match expected type and scope.")

    assert lambda_handler(mock_event, mock_context) == expected_response
