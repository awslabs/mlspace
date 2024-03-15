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

import boto3

from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper, generate_tags, query_resource_metadata, retry_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)
resource_metadata_dao = ResourceMetadataDAO()


@api_wrapper
def create(event, context):
    event_body = json.loads(event["body"])
    user_name = event["requestContext"]["authorizer"]["principalId"]
    project_name = event_body["ProjectName"]
    transform_job_name = event_body["TransformJobName"]

    project_name_from_header = event["headers"]["x-mlspace-project"]
    if project_name_from_header != project_name:
        raise Exception(
            f"Project header, {project_name_from_header}, does not match the project name associated with the transform job, {project_name}."
        )

    param_file = pull_config_from_s3()
    env_variables = get_environment_variables()

    args = {}

    # Required fields
    args["TransformJobName"] = f"{project_name}-{transform_job_name}"
    args["ModelName"] = event_body["ModelName"]
    args["TransformInput"] = event_body["TransformInput"]
    args["TransformResources"] = event_body["TransformResources"]
    args["TransformOutput"] = event_body["TransformOutput"]
    args["TransformOutput"]["KmsKeyId"] = param_file["pSMSKMSKeyId"]
    args["TransformResources"]["VolumeKmsKeyId"] = param_file["pSMSKMSKeyId"]

    # Conditional fields
    if "ModelClientConfig" in event_body:
        args["ModelClientConfig"] = event_body["ModelClientConfig"]
    if "MaxPayloadInMB" in event_body:
        args["MaxPayloadInMB"] = event_body["MaxPayloadInMB"]
    if "BatchStrategy" in event_body:
        args["BatchStrategy"] = event_body["BatchStrategy"]
    if "DataProcessing" in event_body:
        args["DataProcessing"] = event_body["DataProcessing"]
    if "ExperimentConfig" in event_body:
        args["ExperimentConfig"] = event_body["ExperimentConfig"]
    if "Environment" in event_body:
        args["Environment"] = event_body["Environment"]
    args["Tags"] = generate_tags(user_name, project_name, env_variables["SYSTEM_TAG"])

    response = sagemaker.create_transform_job(**args)
    # Creates the initial metadata record
    # Don't change resource metadata name without also changing in resource_metadata/lambda_function
    resource_metadata_dao.upsert_record(
        args["TransformJobName"],
        ResourceType.TRANSFORM_JOB,
        user_name,
        project_name,
        {},
    )

    return response


@api_wrapper
def describe(event, context):
    transform_job_name = event["pathParameters"]["jobName"]
    return sagemaker.describe_transform_job(TransformJobName=transform_job_name)


@api_wrapper
def list_resources(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.TRANSFORM_JOB)


@api_wrapper
def stop(event, context):
    transform_job_name = event["pathParameters"]["jobName"]
    sagemaker.stop_transform_job(TransformJobName=transform_job_name)

    return f"Successfully stopped {transform_job_name}"
