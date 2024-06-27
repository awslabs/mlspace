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
import logging
import random

import boto3
import botocore

from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import EnvVariable, ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper, generate_tags, query_resource_metadata, retry_config
from ml_space_lambda.utils.image_uri_utils import delete_metric_definition_for_builtin_algorithms
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)
project_user_dao = ProjectUserDAO()
resource_metadata_dao = ResourceMetadataDAO()


@api_wrapper
def create(event, context):
    event_body = json.loads(event["body"])
    training_job_name = event_body["TrainingJobName"]
    hyper_parameters = event_body["HyperParameters"]
    algorithm_specs = event_body["AlgorithmSpecification"]
    input_data_config = event_body["InputDataConfig"]
    output_data_config = event_body["OutputDataConfig"]
    resource_config = event_body["ResourceConfig"]
    stopping_condition = event_body["StoppingCondition"]
    project_name = event_body["ProjectName"]
    username = event["requestContext"]["authorizer"]["principalId"]

    project_name_from_header = event["headers"]["x-mlspace-project"]
    if project_name_from_header != project_name:
        raise Exception(
            f"Project header, {project_name_from_header}, does not match the project name associated with the training job, {project_name}."
        )

    param_file = pull_config_from_s3()
    env_variables = get_environment_variables()

    # get list of subnets if provided, otherwise choose a random subnet
    subnets = []
    if "subnetIds" in event_body:
        subnets = event_body["subnetIds"].split(",")
    else:
        subnets = random.sample(param_file["pSMSSubnetIds"].split(","), 1)

    iam_role = param_file["pSMSRoleARN"]
    if env_variables[EnvVariable.MANAGE_IAM_ROLES]:
        project_user = project_user_dao.get(project_name, username)
        iam_role = project_user.role

    if "AlgorithmName" in algorithm_specs and "TrainingImage" in algorithm_specs:
        del algorithm_specs["AlgorithmName"]

    training_job_definition = dict(
        TrainingJobName=training_job_name,
        HyperParameters=hyper_parameters,
        AlgorithmSpecification=algorithm_specs,
        RoleArn=iam_role,
        InputDataConfig=input_data_config,
        OutputDataConfig={
            "KmsKeyId": param_file["pSMSKMSKeyId"],
            "S3OutputPath": output_data_config["S3OutputPath"],
        },
        ResourceConfig={
            "InstanceType": resource_config["InstanceType"],
            "InstanceCount": int(resource_config["InstanceCount"]),
            "VolumeSizeInGB": int(resource_config["VolumeSizeInGB"]),
            "VolumeKmsKeyId": "" if "ml.g" in resource_config["InstanceType"] else param_file["pSMSKMSKeyId"],
        },
        VpcConfig={
            "SecurityGroupIds": param_file["pSMSSecurityGroupId"],
            "Subnets": subnets,
        },
        StoppingCondition={"MaxRuntimeInSeconds": int(stopping_condition["MaxRuntimeInSeconds"])},
        Tags=generate_tags(username, project_name, env_variables[EnvVariable.SYSTEM_TAG]),
        EnableNetworkIsolation=event_body["EnableNetworkIsolation"] if "EnableNetworkIsolation" in event_body else True,
        EnableInterContainerTrafficEncryption=True,
    )

    deleted_metric_definitions = delete_metric_definition_for_builtin_algorithms(
        training_job_definition["AlgorithmSpecification"]
    )

    try:
        response = sagemaker.create_training_job(**training_job_definition)
    except botocore.exceptions.ClientError as error:
        # This if should no longer occur due to delete_metric_definition_for_builtin_algorithm(), but is left as a failsafe for built-in algorithms where the framework name doesn't match the repository name
        # Example of framework = repository name - image_uri_config/semantic-segmentation.json
        # Example of framework != repository name - image_uri_config/xgboost.json OR image_uri_config/huggingface.json
        if "You can't override the metric definitions for Amazon SageMaker algorithms" in error.response["Error"]["Message"]:
            del training_job_definition["AlgorithmSpecification"]["MetricDefinitions"]
            response = sagemaker.create_training_job(**training_job_definition)
            deleted_metric_definitions = True
        else:
            raise error

    # If the metric definitions were deleted due to the job being submited as a BYOM, but the algorithm was a built-in, add a response showing the metrics definitions were removed
    if deleted_metric_definitions:
        response["DeletedMetricsDefinitions"] = True

    # Creates the initial metadata record
    resource_metadata_dao.upsert_record(
        training_job_name,
        ResourceType.TRAINING_JOB,
        username,
        project_name,
        {},
    )

    return response


@api_wrapper
def describe(event, context):
    training_job_name = event["pathParameters"]["jobName"]

    # Call to describe the job
    response = sagemaker.describe_training_job(TrainingJobName=training_job_name)

    # Emptying arrays with unnecessary details to handle response
    response["SecondaryStatusTransitions"] = []
    response["FinalMetricDataList"] = []

    return response


@api_wrapper
def list_resources(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.TRAINING_JOB)
