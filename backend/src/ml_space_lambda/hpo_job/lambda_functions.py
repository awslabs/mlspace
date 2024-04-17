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

from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper, generate_tags, query_resource_metadata, retry_config
from ml_space_lambda.utils.image_uri_utils import delete_metric_definition_for_builtin_algorithms
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)

project_user_dao = ProjectUserDAO()
resource_metadata_dao = ResourceMetadataDAO()


def _normalize_job_definition(definition, iam_role, param_file):
    definition["RoleArn"] = iam_role
    definition["OutputDataConfig"]["KmsKeyId"] = param_file["pSMSKMSKeyId"]
    definition["ResourceConfig"]["VolumeKmsKeyId"] = (
        "" if "ml.g" in definition["ResourceConfig"]["InstanceType"] else param_file["pSMSKMSKeyId"]
    )
    definition["VpcConfig"] = {
        "SecurityGroupIds": param_file["pSMSSecurityGroupId"],
    }
    definition["EnableInterContainerTrafficEncryption"] = True
    if "EnableNetworkIsolation" not in definition:
        definition["EnableNetworkIsolation"] = True
    if "subnetIds" in definition:
        definition["VpcConfig"]["Subnets"] = definition["subnetIds"].split(",")
        del definition["subnetIds"]
    else:
        definition["VpcConfig"]["Subnets"] = random.sample(param_file["pSMSSubnetIds"].split(","), 1)
    delete_metric_definition_for_builtin_algorithms(definition["AlgorithmSpecification"])
    return definition


@api_wrapper
def create(event, context):
    event_body = json.loads(event["body"])
    project_name = event_body["ProjectName"]
    hpo_job = event_body["HPOJobDefinition"]
    hpo_job_name = hpo_job["HyperParameterTuningJobName"]
    user_name = event["requestContext"]["authorizer"]["principalId"]

    project_name_from_header = event["headers"]["x-mlspace-project"]
    if project_name_from_header != project_name:
        raise Exception(
            f"Project header, {project_name_from_header}, does not match the project name associated with the HPO job, {project_name}."
        )

    param_file = pull_config_from_s3()
    env_variables = get_environment_variables()

    iam_role = param_file["pSMSRoleARN"]
    if env_variables["MANAGE_IAM_ROLES"]:
        project_user = project_user_dao.get(project_name, user_name)
        iam_role = project_user.role

    args = {}
    args["HyperParameterTuningJobName"] = hpo_job_name
    args["HyperParameterTuningJobConfig"] = hpo_job["HyperParameterTuningJobConfig"]

    # neither TrainingJobDefinition nor TrainingJobDefinitions are required parameters
    if "TrainingJobDefinition" in hpo_job:
        args["TrainingJobDefinition"] = _normalize_job_definition(hpo_job["TrainingJobDefinition"], iam_role, param_file)

    elif "TrainingJobDefinitions" in hpo_job:
        args["TrainingJobDefinitions"] = [
            _normalize_job_definition(definition, iam_role, param_file) for definition in hpo_job["TrainingJobDefinitions"]
        ]

    if "WarmStartConfig" in hpo_job:
        args["WarmStartConfig"] = hpo_job["WarmStartConfig"]

    args["Tags"] = generate_tags(user_name, project_name, env_variables["SYSTEM_TAG"])

    response = sagemaker.create_hyper_parameter_tuning_job(**args)

    # Creates the initial metadata record
    resource_metadata_dao.upsert_record(
        args["HyperParameterTuningJobName"],
        ResourceType.HPO_JOB,
        user_name,
        project_name,
        {},
    )
    return response


@api_wrapper
def describe(event, context):
    hpo_job_name = event["pathParameters"]["jobName"]
    return sagemaker.describe_hyper_parameter_tuning_job(HyperParameterTuningJobName=hpo_job_name)


@api_wrapper
def list_resources(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.HPO_JOB)


@api_wrapper
def list_training_jobs(event, context):
    hpo_job_name = event["pathParameters"]["jobName"]
    return sagemaker.list_training_jobs_for_hyper_parameter_tuning_job(HyperParameterTuningJobName=hpo_job_name)


@api_wrapper
def stop(event, context):
    hpo_job_name = event["pathParameters"]["jobName"]
    sagemaker.stop_hyper_parameter_tuning_job(HyperParameterTuningJobName=hpo_job_name)
    return f"Successfully stopped {hpo_job_name}"
