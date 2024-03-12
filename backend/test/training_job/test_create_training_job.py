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

import copy
import json
import os
from unittest import mock
from unittest.mock import call, Mock

from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "BUCKET": "example_bucket",
    "S3_KEY": "example_s3_key",
}

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.training_job.lambda_functions import create as lambda_handler

user_name = "jdoe@amazon.com"
training_job_name = "example_training_job"
project_name = "example_project"

event_body = {
    "TrainingJobName": training_job_name,
    "HyperParameters": {"batch_size": "100"},
    "AlgorithmSpecification": {
        "AlgorithmName": "string",
        "EnableSageMakerMetricsTimeSeries": True,
        "MetricDefinitions": [
            {
                "Name": "custom_metric",
                "Regex": "test:custom",
            },
            {
                "Name": "custom_metric_2",
                "Regex": "validation:custom",
            },
        ],
        "TrainingImage": "example_training_image",
        "TrainingInputMode": "example_training_input_mode",
    },
    "InputDataConfig": [
        {
            "ChannelName": "string",
            "CompressionType": "string",
            "ContentType": "string",
            "TrainingImage": "string",
            "TrainingInputMode": "string",
        },
    ],
    "OutputDataConfig": {"KmsKeyId": "old_kms_key", "S3OutputPath": "s3://example_s3_bucket"},
    "ResourceConfig": {
        "InstanceCount": 1,
        "InstanceGroups": [
            {"InstanceCount": 1, "InstanceGroupName": "string", "InstanceType": "string"},
        ],
        "InstanceType": "example_instance_type",
        "VolumeKmsKeyId": "old_kms_key",
        "VolumeSizeInGB": 50,
    },
    "StoppingCondition": {"MaxRuntimeInSeconds": 60, "MaxWaitTimeInSeconds": 60},
    "ProjectName": project_name,
    "subnetIds": "example_subnet1,example_subnet2,example_subnet3",
}


mock_event = {
    "body": json.dumps(event_body),
    "requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}},
    "headers": {"x-mlspace-project": project_name},
}
mock_context = Mock()

mock_arn_from_s3_config = "mock_iam_role_from_s3_config"
mock_arn_from_dynamo = "mock_iam_role_from_dynamo"

mock_tags = generate_tags(user_name, project_name, "MLSpace")

args = {
    "TrainingJobName": training_job_name,
    "HyperParameters": {"batch_size": "100"},
    "AlgorithmSpecification": {
        "TrainingImage": "example_training_image",
        "TrainingInputMode": "example_training_input_mode",
        "EnableSageMakerMetricsTimeSeries": True,
        "MetricDefinitions": [
            {
                "Name": "custom_metric",
                "Regex": "test:custom",
            },
            {
                "Name": "custom_metric_2",
                "Regex": "validation:custom",
            },
        ],
    },
    "RoleArn": mock_arn_from_s3_config,
    "InputDataConfig": [
        {
            "ChannelName": "string",
            "CompressionType": "string",
            "ContentType": "string",
            "TrainingImage": "string",
            "TrainingInputMode": "string",
        },
    ],
    "OutputDataConfig": {"KmsKeyId": "example_key_id", "S3OutputPath": "s3://example_s3_bucket"},
    "ResourceConfig": {
        "InstanceType": "example_instance_type",
        "InstanceCount": 1,
        "VolumeSizeInGB": 50,
        "VolumeKmsKeyId": "example_key_id",
    },
    "VpcConfig": {
        "SecurityGroupIds": ["example_security_group_id"],
        "Subnets": ["example_subnet1", "example_subnet2", "example_subnet3"],
    },
    "StoppingCondition": {
        "MaxRuntimeInSeconds": 60,
    },
    "Tags": mock_tags,
    "EnableNetworkIsolation": True,
    "EnableInterContainerTrafficEncryption": True,
}


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.training_job.lambda_functions.random")
@mock.patch("ml_space_lambda.training_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.training_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.training_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.training_job.lambda_functions.resource_metadata_dao")
def test_create_training_job_success(
    mock_resource_metadata_dao,
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}

    expected_response = generate_html_response(200, {"TrainingJobArn": "example_training_job_arn"})

    mock_sagemaker.create_training_job.return_value = {"TrainingJobArn": "example_training_job_arn"}

    mock_pull_config.return_value = mock_s3_param_json
    mock_project_user_dao.get.return_value = ProjectUserModel(
        username=user_name, project_name=project_name, role=mock_arn_from_dynamo
    )

    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_training_job.assert_called_with(**args)

    mock_pull_config.assert_called_once()

    mlspace_config.env_variables = {}

    # remove subnetIds to test pulling from dynamo
    event_body.pop("subnetIds")
    mock_event["body"] = json.dumps(event_body)

    mock_random.sample.return_value = ["example_subnet2"]
    args["RoleArn"] = mock_arn_from_dynamo
    args["VpcConfig"]["Subnets"] = ["example_subnet2"]

    # patch variable to test pulling config from dynamo
    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": "True"}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_training_job.assert_called_with(**args)
    mock_project_user_dao.get.assert_called_with(project_name, user_name)

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        training_job_name,
        ResourceType.TRAINING_JOB,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.training_job.lambda_functions.random")
@mock.patch("ml_space_lambda.training_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.training_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.training_job.lambda_functions.project_user_dao")
def test_create_training_job_client_error(
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}

    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the CreateTrainingJob operation: Dummy error message.",
    )

    # reset to pull from s3
    args["RoleArn"] = mock_arn_from_s3_config

    mock_random.sample.return_value = ["example_subnet2"]
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.create_training_job.side_effect = ClientError(error_msg, "CreateTrainingJob")

    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_training_job.assert_called_with(**args)

    mock_pull_config.assert_called_once()
    mock_project_user_dao.get.assert_not_called()


# This test addresses special cases where built-in algorithms are not publicly available in MLSpace
# Current common example is xgboost training algorithm
@mock.patch("ml_space_lambda.training_job.lambda_functions.random")
@mock.patch("ml_space_lambda.training_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.training_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.training_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.training_job.lambda_functions.resource_metadata_dao")
def test_create_training_job_custom_builtin_error(
    mock_resource_metadata_dao,
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}

    error_msg = {
        "Error": {
            "Code": "ValidationException",
            "Message": "An error occurred (ValidationException) when calling the CreateTrainingJob operation: You can't override the metric definitions for Amazon SageMaker algorithms. Please retry the request without specifying metric definitions.",
        },
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        200, {"TrainingJobArn": "example_training_job_arn", "DeletedMetricsDefinitions": True}
    )

    args_without_metric_definitions = copy.deepcopy(args)
    del args_without_metric_definitions["AlgorithmSpecification"]["MetricDefinitions"]

    mock_random.sample.return_value = ["example_subnet2"]
    mock_pull_config.return_value = mock_s3_param_json

    # Pytest has a bug where objects mutated between calls show the mutation on both calls
    # Ref: https://docs.python.org/3/library/unittest.mock-examples.html#coping-with-mutable-arguments
    # This is the recommended solution for checking calls on mutable inputs
    def copy_call_args(mock):
        new_mock = Mock()
        new_mock.side_effect = [
            ClientError(error_msg, "CreateTrainingJob"),
            {"TrainingJobArn": "example_training_job_arn"},
        ]

        def side_effect(*args, **kwargs):
            args = copy.deepcopy(args)
            kwargs = copy.deepcopy(kwargs)
            return new_mock(*args, **kwargs)

        mock.side_effect = side_effect
        return new_mock

    re_mocked_sagemacker_create_training_job = copy_call_args(mock_sagemaker.create_training_job)

    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    re_mocked_sagemacker_create_training_job.assert_has_calls(
        [call(**args), call(**args_without_metric_definitions)]
    )

    mock_pull_config.assert_called_once()
    mock_project_user_dao.get.assert_not_called()

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        training_job_name,
        ResourceType.TRAINING_JOB,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.training_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.training_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.training_job.lambda_functions.project_user_dao")
def test_create_training_job_mismatched_header(
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}

    fake_project = "FakeProject"
    bad_event = copy.deepcopy(mock_event)
    bad_event["headers"]["x-mlspace-project"] = fake_project
    expected_response = generate_html_response(
        400,
        f"Bad Request: Project header, {fake_project}, does not match the project name associated with the training job, {project_name}.",
    )

    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(bad_event, mock_context) == expected_response

    mock_sagemaker.create_training_job.assert_not_called()
    mock_pull_config.assert_not_called()
    mock_project_user_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.training_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.training_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.training_job.lambda_functions.sagemaker")
def test_create_training_job_missing_parameters(
    mock_sagemaker, mock_project_user_dao, mock_pull_config
):
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.create_training_job.assert_not_called()
    mock_pull_config.assert_not_called()
    mock_project_user_dao.get.assert_not_called()
