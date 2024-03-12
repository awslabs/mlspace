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
import time
import urllib.parse

import boto3

from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.data_access_objects.resource_scheduler import (
    ResourceSchedulerDAO,
    ResourceSchedulerModel,
)
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    generate_tags,
    get_tags_for_resource,
    query_resource_metadata,
    retry_config,
)
from ml_space_lambda.utils.mlspace_config import get_environment_variables

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)

resource_metadata_dao = ResourceMetadataDAO()
resource_scheduler_dao = ResourceSchedulerDAO()
project_dao = ProjectDAO()


@api_wrapper
def create(event, context):
    event_body = json.loads(event["body"])
    endpoint_name = event_body["EndpointName"]
    endpoint_config_name = event_body["EndpointConfigName"]
    project_name = event_body["ProjectName"]
    user_name = event["requestContext"]["authorizer"]["principalId"]

    env_variables = get_environment_variables()

    project_name_from_header = event["headers"]["x-mlspace-project"]
    if project_name_from_header != project_name:
        raise Exception(
            f"Project header, {project_name_from_header}, does not match the project name associated with the endpoint, {project_name}."
        )

    response = sagemaker.create_endpoint(
        EndpointName=endpoint_name,
        EndpointConfigName=endpoint_config_name,
        Tags=generate_tags(user_name, project_name, env_variables["SYSTEM_TAG"]),
    )
    project = project_dao.get(project_name)
    if (
        project.metadata
        and project.metadata["terminationConfiguration"]
        and "defaultEndpointTTL" in project.metadata["terminationConfiguration"]
    ):
        # Endpoint TTL is in hours so we need to convert that to seconds and add to the current time
        termination_time = time.time() + (
            int(project.metadata["terminationConfiguration"]["defaultEndpointTTL"]) * 60 * 60
        )
        resource_scheduler_dao.create(
            ResourceSchedulerModel(
                resource_id=endpoint_name,
                resource_type=ResourceType.ENDPOINT,
                termination_time=termination_time,
                project=project_name,
            )
        )

    # Create the initial endpoint metadata record
    resource_metadata_dao.upsert_record(
        endpoint_name, ResourceType.ENDPOINT, user_name, project_name, {}
    )

    return response


@api_wrapper
def delete(event, context):
    endpoint_name = urllib.parse.unquote(event["pathParameters"]["endpointName"])
    sagemaker.delete_endpoint(EndpointName=endpoint_name)
    resource_scheduler_dao.delete(resource_id=endpoint_name, resource_type=ResourceType.ENDPOINT)
    return f"Successfully deleted {endpoint_name}"


@api_wrapper
def describe(event, context):
    endpoint_name = urllib.parse.unquote(event["pathParameters"]["endpointName"])

    response = sagemaker.describe_endpoint(EndpointName=endpoint_name)
    tags = get_tags_for_resource(sagemaker, response["EndpointArn"])

    # Add termination time metadata to response
    scheduler_model = resource_scheduler_dao.get(
        resource_id=endpoint_name, resource_type=ResourceType.ENDPOINT
    )
    if scheduler_model and scheduler_model.termination_time:
        response["TerminationTime"] = scheduler_model.termination_time
    for tag in tags:
        if tag["Key"] == "user":
            response["Owner"] = tag["Value"]
            break

    return response


@api_wrapper
def list_resources(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.ENDPOINT)


@api_wrapper
def update(event, context):
    endpoint_name = event["pathParameters"]["endpointName"]
    event_body = json.loads(event["body"])
    endpoint_config = event_body["endpointConfigName"]

    return sagemaker.update_endpoint(
        EndpointName=endpoint_name,
        EndpointConfigName=endpoint_config,
        RetainAllVariantProperties=False,
    )
