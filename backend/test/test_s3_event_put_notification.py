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

from typing import Any, Dict, List, Optional
from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.dataset import DatasetModel

DATA_BUCKET = "mlspace-data-bucket"
TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "DATA_BUCKET": DATA_BUCKET}

MOCK_FRONT_END_PRINCIPAL = (
    "AWS:AAAAA1AA123AAAAA1AA1A:MLSpace-ApiGW-MLS-mls-lambda-dataset-pres-Q1O9esiMn7KN"
)
MOCK_NOTEBOOK_PRINCIPAL = "arn:aws:iam::123456789:role/mlspace-notebook-role"
MOCK_DATASET_BASE_KEY = "global/datasets/more-testing/"
MOCK_KEY = f"{MOCK_DATASET_BASE_KEY}report2.png"
MOCK_DATASET_TAGS = {
    "TagSet": [
        {"Key": "dataset-scope", "Value": "global"},
        {"Key": "dataset-name", "Value": "more-testing"},
        {"Key": "user", "Value": "default-user"},
    ]
}
MOCK_DATASET_SAMPLE_KEY = "private/lchangretta@example.com/datasets/black-hand/file.txt"
MOCK_DATASET = DatasetModel(
    scope="lchangretta@example.com",
    name="black-hand",
    description="Profiles on associates making the journey to Birmingham",
    format="text/pdf",
    location=f"s3://{DATA_BUCKET}/private/lchangretta@example.com/datasets/black-hand/",
    created_by="lchangretta@example.com",
)

mock_context = mock.Mock()


def _validate_dataset_create_call(call_args: List[Any], dataset: DatasetModel):
    dataset_arg = call_args.args[0]
    assert dataset_arg.name == dataset.name
    assert dataset_arg.scope == dataset.scope
    assert dataset_arg.description == dataset.description
    assert dataset_arg.format == dataset.format
    assert dataset_arg.location == dataset.location


def mock_event(
    bucket: Optional[str] = DATA_BUCKET,
    key: Optional[str] = MOCK_KEY,
    principal: Optional[str] = MOCK_FRONT_END_PRINCIPAL,
) -> Dict:
    return {
        "Records": [
            {
                "userIdentity": {"principalId": principal},
                "s3": {
                    "bucket": {"name": bucket},
                    "object": {"key": key},
                },
            }
        ]
    }


with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.s3_event_put_notification.lambda_function import (
        lambda_handler as s3_put_handler,
    )


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_front_end_upload(mock_dataset_dao, mock_s3):
    mock_metadata = {
        "dataset-name": MOCK_DATASET.name,
        "dataset-scope": MOCK_DATASET.scope,
        "dataset-description": MOCK_DATASET.description,
        "dataset-format": MOCK_DATASET.format,
        "user": MOCK_DATASET.created_by,
    }
    mock_s3.head_object.return_value = {"Metadata": mock_metadata}
    # A full tag set doesn't actually matter because we just verify there are some tags
    mock_s3.get_object_tagging.return_value = MOCK_DATASET_TAGS
    mock_dataset_dao.get.return_value = MOCK_DATASET
    s3_put_handler(mock_event(), mock_context)

    mock_s3.head_object.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)
    mock_s3.get_object_tagging.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)
    mock_dataset_dao.create.assert_not_called()


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_front_end_upload_new_dataset(mock_dataset_dao, mock_s3):
    mock_metadata = {
        "dataset-name": MOCK_DATASET.name,
        "dataset-scope": MOCK_DATASET.scope,
        "dataset-description": MOCK_DATASET.description,
        "dataset-format": MOCK_DATASET.format,
        "user": MOCK_DATASET.created_by,
    }
    mock_s3.head_object.return_value = {"Metadata": mock_metadata}
    # A full tag set doesn't actually matter because we just verify there are some tags
    mock_s3.get_object_tagging.return_value = MOCK_DATASET_TAGS
    mock_dataset_dao.get.return_value = None
    s3_put_handler(mock_event(key=MOCK_DATASET_SAMPLE_KEY), mock_context)

    mock_s3.head_object.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_DATASET_SAMPLE_KEY)
    mock_s3.get_object_tagging.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_DATASET_SAMPLE_KEY)
    mock_dataset_dao.create.assert_called_once()
    _validate_dataset_create_call(mock_dataset_dao.create.call_args, MOCK_DATASET)


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_front_end_upload_minimal_metadata(mock_dataset_dao, mock_s3):
    mock_metadata = {"dataset-scope": MOCK_DATASET.scope, "dataset-name": MOCK_DATASET.name}
    mock_s3.head_object.return_value = {"Metadata": mock_metadata}
    mock_s3.get_object_tagging.return_value = MOCK_DATASET_TAGS
    mock_dataset_dao.get.return_value = MOCK_DATASET
    s3_put_handler(mock_event(), mock_context)

    mock_s3.head_object.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)
    mock_s3.get_object_tagging.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)
    mock_dataset_dao.create.assert_not_called()


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_front_end_upload_invalid_dataset_type(mock_dataset_dao, mock_s3):
    invalid_key = "not-global/datasets/this-will-fail/file.txt"
    mock_metadata = {"dataset-name": "this-will-fail"}
    mock_s3.head_object.return_value = {"Metadata": mock_metadata}
    mock_s3.get_object_tagging.return_value = MOCK_DATASET_TAGS

    with pytest.raises(KeyError):
        s3_put_handler(mock_event(key=invalid_key), mock_context)

    mock_s3.head_object.assert_called_with(Bucket=DATA_BUCKET, Key=invalid_key)
    mock_s3.get_object_tagging.assert_called_with(Bucket=DATA_BUCKET, Key=invalid_key)
    mock_dataset_dao.get.assert_not_called()
    mock_dataset_dao.create.assert_not_called()


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_front_end_upload_no_metadata(mock_dataset_dao, mock_s3):
    mock_metadata: Dict = {}
    mock_s3.head_object.return_value = {"Metadata": mock_metadata}
    mock_s3.get_object_tagging.return_value = MOCK_DATASET_TAGS
    s3_put_handler(mock_event(), mock_context)

    mock_dataset_dao.create.assert_not_called()
    mock_s3.head_object.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)
    mock_s3.get_object_tagging.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_front_end_upload_no_known_tags(mock_dataset_dao, mock_s3):
    mock_metadata = {"fake": True}
    mock_s3.head_object.return_value = {"Metadata": mock_metadata}
    mock_s3.get_object_tagging.return_value = {"TagSet": [{"Key": "country", "Value": "USA"}]}
    s3_put_handler(mock_event(), mock_context)

    mock_dataset_dao.create.assert_not_called()
    mock_s3.head_object.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)
    mock_s3.get_object_tagging.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_front_end_upload_no_tags(mock_dataset_dao, mock_s3):
    mock_metadata = {"fake": True}
    mock_s3.head_object.return_value = {"Metadata": mock_metadata}
    mock_s3.get_object_tagging.return_value = {"TagSet": {}}
    s3_put_handler(mock_event(), mock_context)

    mock_dataset_dao.create.assert_not_called()
    mock_s3.head_object.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)
    mock_s3.get_object_tagging.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_front_end_upload_s3_error(mock_dataset_dao, mock_s3):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_s3.head_object.side_effect = ClientError(error_msg, "HeadObject")

    with pytest.raises(ClientError):
        s3_put_handler(mock_event(), mock_context)

    mock_dataset_dao.create.assert_not_called()
    mock_s3.head_object.assert_called_with(Bucket=DATA_BUCKET, Key=MOCK_KEY)
    mock_s3.get_object_tagging.assert_not_called()


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_notebook_upload(mock_dataset_dao, mock_s3):
    mock_s3.put_object_tagging.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}
    dataset = DatasetModel(
        scope="global",
        name="more-testing",
        description="",
        format="text/plain",
        location=f"s3://{DATA_BUCKET}/{MOCK_DATASET_BASE_KEY}",
        created_by="default-user",
    )
    mock_dataset_dao.get.return_value = None
    s3_put_handler(mock_event(principal=MOCK_NOTEBOOK_PRINCIPAL), mock_context)

    mock_s3.put_object_tagging.assert_called_with(
        Bucket=DATA_BUCKET, Key=MOCK_KEY, Tagging=MOCK_DATASET_TAGS
    )
    mock_dataset_dao.create.assert_called_once()
    _validate_dataset_create_call(mock_dataset_dao.create.call_args, dataset)


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_notebook_upload_project_dataset(mock_dataset_dao, mock_s3):
    mock_s3.put_object_tagging.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}
    test_scope = "fake-project"
    test_name = "sensitive-data"
    test_key = f"project/{test_scope}/datasets/{test_name}/list.csv"
    mock_dataset_dao.get.return_value = MOCK_DATASET
    s3_put_handler(
        mock_event(
            principal=MOCK_NOTEBOOK_PRINCIPAL,
            key=test_key,
        ),
        mock_context,
    )

    mock_s3.put_object_tagging.assert_called_with(
        Bucket=DATA_BUCKET,
        Key=test_key,
        Tagging={
            "TagSet": [
                {"Key": "dataset-scope", "Value": test_scope},
                {"Key": "dataset-name", "Value": test_name},
                {"Key": "user", "Value": "default-user"},
            ]
        },
    )
    mock_dataset_dao.create.assert_not_called()


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_notebook_upload_non_dataset(mock_dataset_dao, mock_s3):
    s3_put_handler(
        mock_event(principal=MOCK_NOTEBOOK_PRINCIPAL, key="random/datasets/personal-data/data.zip"),
        mock_context,
    )

    mock_s3.put_object_tagging.assert_not_called()
    mock_dataset_dao.create.assert_not_called()


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_notebook_upload_non_200(mock_dataset_dao, mock_s3):
    error_response = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_s3.put_object_tagging.returns = error_response
    expected_tags = MOCK_DATASET_TAGS
    s3_put_handler(mock_event(principal=MOCK_NOTEBOOK_PRINCIPAL), mock_context)

    mock_dataset_dao.create.assert_not_called()
    mock_s3.put_object_tagging.assert_called_with(
        Bucket=DATA_BUCKET, Key=MOCK_KEY, Tagging=expected_tags
    )


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_handle_notebook_upload_s3_error(mock_dataset_dao, mock_s3):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_s3.put_object_tagging.side_effect = ClientError(error_msg, "PutObjectTagging")
    expected_tags = MOCK_DATASET_TAGS
    with pytest.raises(ClientError):
        s3_put_handler(mock_event(principal=MOCK_NOTEBOOK_PRINCIPAL), mock_context)

    mock_dataset_dao.create.assert_not_called()
    mock_s3.put_object_tagging.assert_called_with(
        Bucket=DATA_BUCKET, Key=MOCK_KEY, Tagging=expected_tags
    )


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_non_mlspace_key(mock_dataset_dao, mock_s3):
    s3_put_handler(mock_event(key="fake/unit/test/key.txt"), mock_context)
    mock_dataset_dao.create.assert_not_called()
    mock_s3.put_object_tagging.assert_not_called()
    mock_s3.head_object.assert_not_called()
    mock_s3.get_object_tagging.assert_not_called()


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_key_too_shallow(mock_dataset_dao, mock_s3):
    s3_put_handler(mock_event(key="datasets/key.txt"), mock_context)
    mock_dataset_dao.create.assert_not_called()
    mock_s3.put_object_tagging.assert_not_called()
    mock_s3.head_object.assert_not_called()
    mock_s3.get_object_tagging.assert_not_called()


@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.s3")
@mock.patch("ml_space_lambda.s3_event_put_notification.lambda_function.dataset_dao")
def test_key_training_job_output(mock_dataset_dao, mock_s3):
    dataset_type = "project"
    project_name = "NotebookTest"
    dataset_name = "training-output"
    training_file_key = f"{dataset_type}/{project_name}/datasets/{dataset_name}/train/examples1"
    mock_s3.put_object_tagging.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}
    dataset = DatasetModel(
        scope=project_name,
        name=dataset_name,
        description="",
        format="text/plain",
        location=f"s3://{DATA_BUCKET}/{dataset_type}/{project_name}/datasets/{dataset_name}/",
        created_by="default-user",
    )
    mock_dataset_dao.get.return_value = None
    s3_put_handler(
        mock_event(principal=MOCK_NOTEBOOK_PRINCIPAL, key=training_file_key), mock_context
    )

    mock_s3.put_object_tagging.assert_called_with(
        Bucket=DATA_BUCKET,
        Key=training_file_key,
        Tagging={
            "TagSet": [
                {"Key": "dataset-scope", "Value": project_name},
                {"Key": "dataset-name", "Value": dataset_name},
                {"Key": "user", "Value": "default-user"},
            ]
        },
    )
    mock_dataset_dao.create.assert_called_once()
    _validate_dataset_create_call(mock_dataset_dao.create.call_args, dataset)
