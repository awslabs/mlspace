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
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    generate_tags,
    get_tags_for_resource,
    query_resource_metadata,
    retry_config,
)

# The sagemaker SDK isn't directly compatible with Lambda
# https://github.com/aws/sagemaker-python-sdk/issues/1200
# To get around this we just grabbed the single file of the SDK that we need in order to generate
# image URIs
from ml_space_lambda.utils.image_uris import retrieve
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)
region = boto3.Session().region_name
project_user_dao = ProjectUserDAO()
resource_metadata_dao = ResourceMetadataDAO()


@api_wrapper
def create(event, context):
    event_body = json.loads(event["body"])
    model_name = event_body["ModelName"]
    primary_container = event_body["PrimaryContainer"]
    project_name = event_body["ProjectName"]
    user_name = event["requestContext"]["authorizer"]["principalId"]
    project_name_from_header = event["headers"]["x-mlspace-project"]
    if project_name_from_header != project_name:
        raise Exception(
            f"Project header, {project_name_from_header}, does not match the project name associated with the model, {project_name}."
        )

    param_file = pull_config_from_s3()
    env_variables = get_environment_variables()

    # get list of subnets if provided, otherwise choose a random subnet
    subnets = event_body.get("VpcConfig", {}).get("Subnets", None)
    if not subnets:
        subnets = random.sample(param_file["pSMSSubnetIds"].split(","), 2)

    enable_network_isolation = event_body.get("EnableNetworkIsolation", True)

    iam_role = param_file["pSMSRoleARN"]
    if env_variables["MANAGE_IAM_ROLES"]:
        project_user = project_user_dao.get(project_name, user_name)
        iam_role = project_user.role

    # Build the primary container dictionary and handle optional inputs coming from the UI form.
    primary_container_dict = {
        "Image": primary_container["Image"],
        "Mode": primary_container["Mode"],
    }

    if "ContainerHostname" in primary_container:
        primary_container_dict["ContainerHostname"] = primary_container["ContainerHostname"]
    if "ModelDataUrl" in primary_container:
        primary_container_dict["ModelDataUrl"] = primary_container["ModelDataUrl"]
    if "Environment" in primary_container:
        primary_container_dict["Environment"] = primary_container["Environment"]

    response = sagemaker.create_model(
        ModelName=model_name,
        PrimaryContainer=primary_container_dict,
        ExecutionRoleArn=iam_role,
        Tags=generate_tags(user_name, project_name, env_variables["SYSTEM_TAG"]),
        VpcConfig={
            "SecurityGroupIds": param_file["pSMSSecurityGroupId"],
            "Subnets": subnets,
        },
        EnableNetworkIsolation=enable_network_isolation,
    )

    # Creates the initial metadata record
    resource_metadata_dao.upsert_record(
        model_name,
        ResourceType.MODEL,
        user_name,
        project_name,
        {},
    )

    return response


@api_wrapper
def delete(event, context):
    model_name = event["pathParameters"]["modelName"]
    # If delete_model is successful, the service sends
    # back an HTTP 200 response with an empty HTTP body.
    sagemaker.delete_model(ModelName=model_name)
    return f"Successfully deleted {model_name}"


@api_wrapper
def describe(event, context):
    model_name = event["pathParameters"]["modelName"]
    response = sagemaker.describe_model(ModelName=model_name)
    # Remove response metadata. Not needed by the front end UI.
    response.pop("ResponseMetadata", None)
    tags = get_tags_for_resource(sagemaker, response["ModelArn"])
    for tag in tags:
        if tag["Key"] == "user":
            response["Owner"] = tag["Value"]
            break

    return response


@api_wrapper
def list_images(event, context):
    # We don't use the SageMaker python SDK here due to the size of the SDK and the limitations
    # of lambda (see https://github.com/aws/sagemaker-python-sdk/issues/3926). Instead we
    # periodically sync the registry metadata for the images (see README.md for more) and recreate
    # the image uri retrieve method present in the SDK
    frameworks = [
        "blazingtext",
        "factorization-machines",
        "forecasting-deepar",
        "image-classification",
        "linear-learner",
        "kmeans",
        "knn",
        "object2vec",
        "pca",
        "xgboost",
        "semantic-segmentation",
        "object-detection",
    ]
    img_uris = {}
    image_scope = None
    if "queryStringParameters" in event and event["queryStringParameters"] and "imageScope" in event["queryStringParameters"]:
        image_scope = event["queryStringParameters"]["imageScope"]
    for framework in frameworks:
        img_uri = retrieve(framework, region, version="latest", image_scope=image_scope)
        img_uris[framework] = img_uri

    return img_uris


@api_wrapper
def list_resources(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.MODEL)
