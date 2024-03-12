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

# Testing for the create_transform_job Lambda function.
import copy
import json
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

user_name = "jdoe@amazon.com"
project_name = "example_project"
mock_response = {"TransformJobArn": "example_arn"}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.transform_job.lambda_functions import create as lambda_handler

event_body = {
    "EndpointName": "example_endpoint",
    "EndpointConfigName": "example_config",
    "ProjectName": project_name,
    "TransformJobName": "example_transform_job_name",
    "ModelName": "example_model_name",
    "TransformInput": {
        "ContentType": "string",
        "DataSource": {"S3DataSource": {"S3DataType": "string", "S3Uri": "s3://some_s3_bucket"}},
    },
    "TransformResources": {
        "InstanceCount": 1,
        "InstanceType": "string",
        "VolumeKmsKeyId": "old_volume_kms_key",
    },
    "TransformOutput": {
        "AssembleWith": "string",
        "KmsKeyId": "old_kms_key",
        "S3OutputPath": "s3://some_s3_bucket",
    },
}

optional_parameters = {
    "ModelClientConfig": {"InvocationsMaxRetries": 1, "InvocationsTimeoutInSeconds": 60},
    "MaxPayloadInMB": 5,
    "BatchStrategy": "MultiRecord",
    "DataProcessing": {
        "InputFilter": "string",
    },
    "ExperimentConfig": {
        "ExperimentName": "string",
    },
    "Environment": {
        "string": "string",
    },
}

mock_event = {
    "body": json.dumps(event_body),
    "requestContext": {"authorizer": {"principalId": user_name}},
    "headers": {"x-mlspace-project": project_name},
}
mock_context = mock.Mock()

tags = generate_tags(user_name, project_name, "MLSpace")

args = {
    "TransformJobName": f"{project_name}-example_transform_job_name",
    "ModelName": "example_model_name",
    "TransformInput": {
        "ContentType": "string",
        "DataSource": {"S3DataSource": {"S3DataType": "string", "S3Uri": "s3://some_s3_bucket"}},
    },
    "TransformResources": {
        "InstanceCount": 1,
        "InstanceType": "string",
        "VolumeKmsKeyId": "example_key_id",
    },
    "TransformOutput": {
        "AssembleWith": "string",
        "KmsKeyId": "example_key_id",
        "S3OutputPath": "s3://some_s3_bucket",
    },
    "Tags": tags,
}


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.transform_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.transform_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.transform_job.lambda_functions.resource_metadata_dao")
def test_create_transform_job_success(
    mock_resource_metadata_dao, mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.create_transform_job.return_value = {"TransformJobArn": "example_arn"}
    expected_response = generate_html_response(200, mock_response)

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_transform_job.assert_called_with(**args)
    mock_pull_config.assert_called_once()

    # update event body to unit test optional parameters
    args.update(optional_parameters)
    event_body.update(optional_parameters)
    mock_event["body"] = json.dumps(event_body)

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_transform_job.assert_called_with(**args)

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        args["TransformJobName"],
        ResourceType.TRANSFORM_JOB,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.transform_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.transform_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.transform_job.lambda_functions.resource_metadata_dao")
def test_create_transform_job_client_error(
    mock_resource_metadata_dao, mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }

    expected_response = generate_html_response(
        "400",
        "An error occurred (ThrottlingException) when calling the CreateTransformJob operation: Dummy error message.",
    )
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.create_transform_job.side_effect = ClientError(error_msg, "CreateTransformJob")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_transform_job.assert_called_with(**args)
    mock_pull_config.assert_called_once()

    mock_resource_metadata_dao.upsert_record.assert_not_called()


@mock.patch("ml_space_lambda.transform_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.transform_job.lambda_functions.sagemaker")
def test_create_transform_job_mismatched_header(
    mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    fake_project = "FakeProject"
    bad_event = copy.deepcopy(mock_event)
    bad_event["headers"]["x-mlspace-project"] = fake_project
    expected_response = generate_html_response(
        400,
        f"Bad Request: Project header, {fake_project}, does not match the project name associated with the transform job, {project_name}.",
    )

    assert lambda_handler(bad_event, mock_context) == expected_response

    mock_sagemaker.create_transform_job.assert_not_called()
    mock_pull_config.assert_not_called()


@mock.patch("ml_space_lambda.transform_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.transform_job.lambda_functions.sagemaker")
def test_create_transform_job_missing_parameters(mock_sagemaker, mock_pull_config):
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.create_transform_job.assert_not_called()
    mock_pull_config.assert_not_called()
