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

# Testing for the create_endpoint_config Lambda function.
import copy
import json
from typing import Any, Dict
from unittest import mock

from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "BUCKET": "testS3Bucket",
    "S3_KEY": "testS3Key",
    "AWS_ACCESS_KEY_ID": "fakeAccessKey",
    "AWS_SECRET_ACCESS_KEY": "fakeSecretKey",
}

mock_response = {
    "ConfigName": "example_config",
}
mock_context = mock.Mock()
mock_endpoint_config_name = "example_config"
project_name = "exampleProject"
user_name = "testUser"

mock_tags = generate_tags(user_name, project_name, "MLSpace")

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.endpoint_config.lambda_functions import create as lambda_handler


def _mock_event(event_body: Dict[str, Any]) -> Dict:
    return {
        "body": json.dumps(event_body),
        "requestContext": {
            "authorizer": {
                "principalId": user_name,
            },
        },
        "headers": {"x-mlspace-project": project_name},
    }


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.resource_metadata_dao")
def test_create_endpoint_config_success_depth(
    mock_resource_metadata_dao, mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}

    data_capture = {
        "EnableCapture": True,
        "InitialSamplingPercentage": "20%",
        "DestinationS3Uri": "s3://some-s3-bucket",
        "KmsKeyId": "exampleKmsKey",
        "CaptureOptions": "capture_something",
        "CaptureContentTypeHeader": {
            "CsvContentTypes": ["text/csv"],
            "JsonContentTypes": ["application/json"],
        },
    }
    event_body = {
        "EndpointConfigName": "example_config",
        "ProjectName": project_name,
        "ProductionVariants": "exampleVariant",
        "DataCaptureConfig": data_capture,
    }

    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.create_endpoint_config.return_value = mock_response
    expected_response = generate_html_response(200, mock_response)

    assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_sagemaker.create_endpoint_config.assert_called_with(
        EndpointConfigName=mock_endpoint_config_name,
        ProductionVariants="exampleVariant",
        DataCaptureConfig={
            "EnableCapture": data_capture["EnableCapture"],
            "InitialSamplingPercentage": data_capture["InitialSamplingPercentage"],
            "DestinationS3Uri": data_capture["DestinationS3Uri"],
            "KmsKeyId": data_capture["KmsKeyId"],
            "CaptureOptions": data_capture["CaptureOptions"],
            "CaptureContentTypeHeader": data_capture["CaptureContentTypeHeader"],
        },
        Tags=mock_tags,
        KmsKeyId="example_key_id",
    )
    mock_pull_config.assert_called_once()

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        mock_endpoint_config_name,
        ResourceType.ENDPOINT_CONFIG,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.resource_metadata_dao")
def test_create_endpoint_config_success_no_depth(
    mock_resource_metadata_dao, mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    data_capture = {
        "EnableCapture": False,
        "InitialSamplingPercentage": "20%",
        "DestinationS3Uri": "s3://some-s3-bucket",
        "KmsKeyId": "exampleKmsKey",
        "CaptureOptions": "capture_something",
        "CaptureContentTypeHeader": {
            "CsvContentTypes": ["text/csv"],
            "JsonContentTypes": ["application/json"],
        },
    }
    event_body = {
        "EndpointConfigName": "example_config",
        "ProjectName": project_name,
        "ProductionVariants": "exampleVariant",
        "DataCaptureConfig": data_capture,
    }

    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.create_endpoint_config.return_value = mock_response
    expected_response = generate_html_response(200, mock_response)

    assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_sagemaker.create_endpoint_config.assert_called_with(
        EndpointConfigName=mock_endpoint_config_name,
        ProductionVariants="exampleVariant",
        Tags=mock_tags,
        KmsKeyId="example_key_id",
    )
    mock_pull_config.assert_called_once()

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        mock_endpoint_config_name,
        ResourceType.ENDPOINT_CONFIG,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.sagemaker")
def test_create_endpoint_config_client_error(mock_sagemaker, mock_pull_config, mock_s3_param_json):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    data_capture = {
        "EnableCapture": False,
        "InitialSamplingPercentage": "20%",
        "DestinationS3Uri": "s3://some-s3-bucket",
        "KmsKeyId": "exampleKmsKey",
        "CaptureOptions": "capture_something",
        "CaptureContentTypeHeader": {
            "CsvContentTypes": "text/csv",
            "JsonContentTypes": "application/json",
        },
    }
    event_body = {
        "EndpointConfigName": "example_config",
        "ProjectName": project_name,
        "ProductionVariants": "exampleVariant",
        "DataCaptureConfig": data_capture,
    }

    mock_sagemaker.create_endpoint_config.side_effect = ClientError(error_msg, "CreateEndpointConfiguration")
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the CreateEndpointConfiguration operation: Dummy error message.",
    )
    mock_pull_config.return_value = mock_s3_param_json

    assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_sagemaker.create_endpoint_config.assert_called()
    mock_pull_config.assert_called_once()


@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.sagemaker")
def test_create_endpoint_config_mismatched_header(mock_sagemaker, mock_pull_config, mock_s3_param_json):
    event_body = {
        "EndpointConfigName": "example_config",
        "ProjectName": project_name,
        "ProductionVariants": "exampleVariant",
        "DataCaptureConfig": {"EnableCapture": False},
    }
    fake_project = "FakeProject"
    bad_event = copy.deepcopy(_mock_event(event_body))
    bad_event["headers"]["x-mlspace-project"] = fake_project
    expected_response = generate_html_response(
        400,
        f"Bad Request: Project header, {fake_project}, does not match the project name associated with the endpoint config, {project_name}.",
    )
    assert lambda_handler(bad_event, mock_context) == expected_response

    mock_sagemaker.create_endpoint_config.assert_not_called()
    mock_pull_config.assert_not_called()


@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.endpoint_config.lambda_functions.sagemaker")
def test_create_endpoint_config_missing_parameters(mock_sagemaker, mock_pull_config):
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.create_endpoint_config.assert_not_called()
    mock_pull_config.assert_not_called()
