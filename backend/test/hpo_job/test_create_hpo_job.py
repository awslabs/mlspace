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
import os
from typing import List, Optional
from unittest import mock

from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "BUCKET": "mlspace-data-bucket",
    "S3_KEY": "example_s3_key",
}

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.hpo_job.lambda_functions import create as lambda_handler

user_name = "jdoe@amazon.com"
hpo_job_name = "example_hpo_job"
project_name = "example_project"
tuning_job_name = "example_tuning_job_name"
mock_arn_from_s3_config = "mock_iam_role_from_s3_config"
mock_arn_from_dynamo = "mock_iam_role_from_dynamo"

mock_context = mock.Mock()
mock_tags = generate_tags(user_name, project_name, "MLSpace")


def _mock_job_definition(subnets: List[str], enable_isolation: Optional[bool] = True):
    return {
        "OutputDataConfig": {
            "KmsKeyId": "example_key_id",
            "S3OutputPath": "s3://example_s3_bucket",
        },
        "ResourceConfig": {"InstanceType": "ml.m4.xlarge", "VolumeKmsKeyId": "example_key_id"},
        "RoleArn": mock_arn_from_s3_config,
        "VpcConfig": {
            "SecurityGroupIds": ["example_security_group_id"],
            "Subnets": subnets,
        },
        "EnableInterContainerTrafficEncryption": True,
        "EnableNetworkIsolation": enable_isolation,
    }


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.random")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.resource_metadata_dao")
def test_create_hpo_job_single_job_success(
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

    event_body = {
        "HPOJobDefinition": {
            "HyperParameterTuningJobName": tuning_job_name,
            "HyperParameterTuningJobConfig": {
                "HyperParameterTuningJobObjective": {
                    "MetricName": "example_metric_name",
                    "Type": "Maximize",
                },
            },
            "TrainingJobDefinition": {
                "OutputDataConfig": {
                    "KmsKeyId": "old_kms_key",
                    "S3OutputPath": "s3://example_s3_bucket",
                },
                "ResourceConfig": {"InstanceType": "ml.m4.xlarge"},
                "EnableNetworkIsolation": False,
                "subnetIds": "example_subnet1",
            },
            "WarmStartConfig": {
                "ParentHyperParameterTuningJobs": [{"HyperParameterTuningJobName": tuning_job_name}],
                "WarmStartType": "TRANSFER_LEARNING",
            },
        },
        "ProjectName": project_name,
    }

    mock_event = {
        "body": json.dumps(event_body),
        "requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}},
        "headers": {"x-mlspace-project": project_name},
    }

    args = {
        "HyperParameterTuningJobName": tuning_job_name,
        "HyperParameterTuningJobConfig": {
            "HyperParameterTuningJobObjective": {
                "MetricName": "example_metric_name",
                "Type": "Maximize",
            },
        },
        "TrainingJobDefinition": _mock_job_definition(["example_subnet1"], False),
        "WarmStartConfig": {
            "ParentHyperParameterTuningJobs": [{"HyperParameterTuningJobName": tuning_job_name}],
            "WarmStartType": "TRANSFER_LEARNING",
        },
        "Tags": mock_tags,
    }

    expected_response = generate_html_response(200, {"HyperParameterTuningJobArn": "example_hpo_job_arn"})

    mock_sagemaker.create_hyper_parameter_tuning_job.return_value = {"HyperParameterTuningJobArn": "example_hpo_job_arn"}

    mock_pull_config.return_value = mock_s3_param_json
    mock_project_user_dao.get.return_value = ProjectUserModel(
        project_name=project_name, username=user_name, role=mock_arn_from_dynamo
    )

    # use default of pulling iam_roles from s3 config
    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_hyper_parameter_tuning_job.assert_called_with(**args)
    mock_pull_config.assert_called_once()

    mlspace_config.env_variables = {}

    # remove subnetIds to test pulling from s3 config
    del event_body["HPOJobDefinition"]["TrainingJobDefinition"]["subnetIds"]
    mock_event["body"] = json.dumps(event_body)

    mock_random.sample.return_value = ["example_subnet2"]
    args["TrainingJobDefinition"]["RoleArn"] = mock_arn_from_dynamo
    args["TrainingJobDefinition"]["VpcConfig"]["Subnets"] = ["example_subnet2"]

    # patch variable to test pulling config from dynamo
    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "fakeFunctionName"}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_hyper_parameter_tuning_job.assert_called_with(**args)
    mock_project_user_dao.getassert_called_with(project_name, user_name)

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        tuning_job_name,
        ResourceType.HPO_JOB,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.hpo_job.lambda_functions.random")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.resource_metadata_dao")
def test_create_hpo_job_multiple_jobs_success(
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
    mocked_random_subnet = "example_subnet3"
    mock_random.sample.return_value = [mocked_random_subnet]

    event_body = {
        "HPOJobDefinition": {
            "HyperParameterTuningJobName": tuning_job_name,
            "HyperParameterTuningJobConfig": {
                "HyperParameterTuningJobObjective": {
                    "MetricName": "example_metric_name",
                    "Type": "Maximize",
                },
            },
            "TrainingJobDefinitions": [
                {
                    "OutputDataConfig": {
                        "KmsKeyId": "old_kms_key",
                        "S3OutputPath": "s3://example_s3_bucket",
                    },
                    "ResourceConfig": {"InstanceType": "ml.m4.xlarge"},
                    "subnetIds": "example_subnet1,example_subnet3",
                },
                {
                    "OutputDataConfig": {
                        "KmsKeyId": "old_kms_key",
                        "S3OutputPath": "s3://example_s3_bucket",
                    },
                    "ResourceConfig": {"InstanceType": "ml.m4.xlarge"},
                    "EnableNetworkIsolation": False,
                },
                {
                    "OutputDataConfig": {
                        "KmsKeyId": "old_kms_key",
                        "S3OutputPath": "s3://example_s3_bucket",
                    },
                    "ResourceConfig": {"InstanceType": "ml.m4.xlarge"},
                    "subnetIds": "example_subnet2",
                },
            ],
            "WarmStartConfig": {
                "ParentHyperParameterTuningJobs": [{"HyperParameterTuningJobName": tuning_job_name}],
                "WarmStartType": "TRANSFER_LEARNING",
            },
        },
        "ProjectName": project_name,
    }

    mock_event = {
        "body": json.dumps(event_body),
        "requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}},
        "headers": {"x-mlspace-project": project_name},
    }

    args = {
        "HyperParameterTuningJobName": tuning_job_name,
        "HyperParameterTuningJobConfig": {
            "HyperParameterTuningJobObjective": {
                "MetricName": "example_metric_name",
                "Type": "Maximize",
            },
        },
        "TrainingJobDefinitions": [
            _mock_job_definition(["example_subnet1", "example_subnet3"]),
            _mock_job_definition([mocked_random_subnet], False),
            _mock_job_definition(["example_subnet2"]),
        ],
        "WarmStartConfig": {
            "ParentHyperParameterTuningJobs": [{"HyperParameterTuningJobName": tuning_job_name}],
            "WarmStartType": "TRANSFER_LEARNING",
        },
        "Tags": mock_tags,
    }

    expected_response = generate_html_response(200, {"HyperParameterTuningJobArn": "example_hpo_job_arn"})

    mlspace_config.env_variables = {}

    mock_sagemaker.create_hyper_parameter_tuning_job.return_value = {"HyperParameterTuningJobArn": "example_hpo_job_arn"}

    mock_pull_config.return_value = mock_s3_param_json

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_pull_config.assert_called_once()

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_hyper_parameter_tuning_job.assert_called_with(**args)
    mock_project_user_dao.get.assert_not_called()

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        tuning_job_name,
        ResourceType.HPO_JOB,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.hpo_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.resource_metadata_dao")
def test_create_hpo_job_no_jobs_success(
    mock_resource_metadata_dao,
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_s3_param_json,
):
    # neither TrainingJobDefinition nor TrainingJobDefinitions are required
    # parameters, so we need to test with neither included

    event_body = {
        "HPOJobDefinition": {
            "HyperParameterTuningJobName": tuning_job_name,
            "HyperParameterTuningJobConfig": {
                "HyperParameterTuningJobObjective": {
                    "MetricName": "example_metric_name",
                    "Type": "Maximize",
                },
            },
        },
        "ProjectName": project_name,
        "subnetIds": "example_subnet1,example_subnet2,example_subnet3",
    }

    mock_event = {
        "body": json.dumps(event_body),
        "requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}},
        "headers": {"x-mlspace-project": project_name},
    }

    args = {
        "HyperParameterTuningJobName": tuning_job_name,
        "HyperParameterTuningJobConfig": {
            "HyperParameterTuningJobObjective": {
                "MetricName": "example_metric_name",
                "Type": "Maximize",
            },
        },
        "Tags": mock_tags,
    }

    expected_response = generate_html_response(200, {"HyperParameterTuningJobArn": "example_hpo_job_arn"})

    mock_sagemaker.create_hyper_parameter_tuning_job.return_value = {"HyperParameterTuningJobArn": "example_hpo_job_arn"}

    mock_pull_config.return_value = mock_s3_param_json

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_pull_config.assert_called_once()

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_hyper_parameter_tuning_job.assert_called_with(**args)
    mock_project_user_dao.get.assert_not_called()

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        tuning_job_name,
        ResourceType.HPO_JOB,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.hpo_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.resource_metadata_dao")
def test_create_hpo_job_client_error(
    mock_resource_metadata_dao,
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_s3_param_json,
):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the CreateHyperParameterTuningJob operation: Dummy error message.",
    )

    event_body = {
        "HPOJobDefinition": {
            "HyperParameterTuningJobName": tuning_job_name,
            "HyperParameterTuningJobConfig": {
                "HyperParameterTuningJobObjective": {
                    "MetricName": "example_metric_name",
                    "Type": "Maximize",
                },
            },
            "TrainingJobDefinitions": [
                {
                    "OutputDataConfig": {
                        "KmsKeyId": "old_kms_key",
                        "S3OutputPath": "s3://example_s3_bucket",
                    },
                    "ResourceConfig": {"InstanceType": "ml.m4.xlarge"},
                    "subnetIds": "example_subnet1",
                },
                {
                    "OutputDataConfig": {
                        "KmsKeyId": "old_kms_key",
                        "S3OutputPath": "s3://example_s3_bucket",
                    },
                    "ResourceConfig": {"InstanceType": "ml.m4.xlarge"},
                    "subnetIds": "example_subnet1",
                },
                {
                    "OutputDataConfig": {
                        "KmsKeyId": "old_kms_key",
                        "S3OutputPath": "s3://example_s3_bucket",
                    },
                    "ResourceConfig": {"InstanceType": "ml.m4.xlarge"},
                    "subnetIds": "example_subnet1",
                },
            ],
            "WarmStartConfig": {
                "ParentHyperParameterTuningJobs": [{"HyperParameterTuningJobName": tuning_job_name}],
                "WarmStartType": "TRANSFER_LEARNING",
            },
        },
        "ProjectName": project_name,
    }

    mock_event = {
        "body": json.dumps(event_body),
        "requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}},
        "headers": {"x-mlspace-project": project_name},
    }

    args = {
        "HyperParameterTuningJobName": tuning_job_name,
        "HyperParameterTuningJobConfig": {
            "HyperParameterTuningJobObjective": {
                "MetricName": "example_metric_name",
                "Type": "Maximize",
            },
        },
        "TrainingJobDefinitions": [
            _mock_job_definition(["example_subnet1"]),
            _mock_job_definition(["example_subnet1"]),
            _mock_job_definition(["example_subnet1"]),
        ],
        "WarmStartConfig": {
            "ParentHyperParameterTuningJobs": [{"HyperParameterTuningJobName": tuning_job_name}],
            "WarmStartType": "TRANSFER_LEARNING",
        },
        "Tags": mock_tags,
    }

    mock_sagemaker.create_hyper_parameter_tuning_job.side_effect = ClientError(error_msg, "CreateHyperParameterTuningJob")
    mock_pull_config.return_value = mock_s3_param_json

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_hyper_parameter_tuning_job.assert_called_with(**args)

    mock_pull_config.assert_called_once()
    mock_project_user_dao.get.assert_not_called()

    mock_resource_metadata_dao.upsert_record.assert_not_called()


@mock.patch("ml_space_lambda.hpo_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.project_user_dao")
def test_create_hpo_mismatched_header(mock_project_user_dao, mock_sagemaker, mock_pull_config, mock_s3_param_json):
    event_body = {
        "HPOJobDefinition": {
            "HyperParameterTuningJobName": tuning_job_name,
            "HyperParameterTuningJobConfig": {
                "HyperParameterTuningJobObjective": {
                    "MetricName": "example_metric_name",
                    "Type": "Maximize",
                },
            },
            "TrainingJobDefinitions": [
                {
                    "OutputDataConfig": {
                        "KmsKeyId": "old_kms_key",
                        "S3OutputPath": "s3://example_s3_bucket",
                    },
                }
            ],
            "WarmStartConfig": {
                "ParentHyperParameterTuningJobs": [{"HyperParameterTuningJobName": tuning_job_name}],
                "WarmStartType": "TRANSFER_LEARNING",
            },
        },
        "ProjectName": project_name,
        "subnetIds": "example_subnet1,example_subnet2,example_subnet3",
    }

    fake_project = "FakeProject"
    mock_event = {
        "body": json.dumps(event_body),
        "requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}},
        "headers": {"x-mlspace-project": fake_project},
    }

    expected_response = generate_html_response(
        400,
        f"Bad Request: Project header, {fake_project}, does not match the project name associated with the HPO job, {project_name}.",
    )

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_hyper_parameter_tuning_job.assert_not_called()
    mock_pull_config.assert_not_called()
    mock_project_user_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.hpo_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.hpo_job.lambda_functions.sagemaker")
def test_create_hpo_job_missing_parameters(mock_sagemaker, mock_pull_config, mock_project_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.create_hyper_parameter_tuning_job.assert_not_called()
    mock_pull_config.assert_not_called()
    mock_project_user_dao.get.assert_not_called()
