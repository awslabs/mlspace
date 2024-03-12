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
import urllib.parse

import boto3

from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    generate_tags,
    query_resource_metadata,
    retry_config,
)
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)

resource_metadata_dao = ResourceMetadataDAO()


@api_wrapper
def create(event, context):
    event_body = json.loads(event["body"])
    endpoint_config_name = event_body["EndpointConfigName"]
    project_name = event_body["ProjectName"]
    production_variants = event_body["ProductionVariants"]
    data_capture_config = event_body["DataCaptureConfig"]
    user_name = event["requestContext"]["authorizer"]["principalId"]

    project_name_from_header = event["headers"]["x-mlspace-project"]
    if project_name_from_header != project_name:
        raise Exception(
            f"Project header, {project_name_from_header}, does not match the project name associated with the endpoint config, {project_name}."
        )

    env_variables = get_environment_variables()
    param_file = pull_config_from_s3()

    tags_list = generate_tags(user_name, project_name, env_variables["SYSTEM_TAG"])

    content_type_headers = {}
    if isinstance(data_capture_config["CaptureContentTypeHeader"]["CsvContentTypes"], list):
        content_type_headers["CsvContentTypes"] = data_capture_config["CaptureContentTypeHeader"][
            "CsvContentTypes"
        ]
    if isinstance(data_capture_config["CaptureContentTypeHeader"]["JsonContentTypes"], list):
        content_type_headers["JsonContentTypes"] = data_capture_config["CaptureContentTypeHeader"][
            "JsonContentTypes"
        ]

    if data_capture_config["EnableCapture"]:
        response = sagemaker.create_endpoint_config(
            EndpointConfigName=endpoint_config_name,
            ProductionVariants=production_variants,
            DataCaptureConfig={
                "EnableCapture": data_capture_config["EnableCapture"],
                "InitialSamplingPercentage": data_capture_config["InitialSamplingPercentage"],
                "DestinationS3Uri": data_capture_config["DestinationS3Uri"],
                "KmsKeyId": data_capture_config["KmsKeyId"],
                "CaptureOptions": data_capture_config["CaptureOptions"],
                "CaptureContentTypeHeader": content_type_headers,
            },
            Tags=tags_list,
            KmsKeyId=param_file["pSMSKMSKeyId"],
        )
    else:
        response = sagemaker.create_endpoint_config(
            EndpointConfigName=endpoint_config_name,
            ProductionVariants=production_variants,
            Tags=tags_list,
            KmsKeyId=param_file["pSMSKMSKeyId"],
        )

    # Creates the initial metadata record
    # Don't change resource metadata name without also changing in resource_metadata/lambda_function
    resource_metadata_dao.upsert_record(
        endpoint_config_name,
        ResourceType.ENDPOINT_CONFIG,
        user_name,
        project_name,
        {},
    )

    return response


@api_wrapper
def delete(event, context):
    endpoint_config_name = urllib.parse.unquote(event["pathParameters"]["endpointConfigName"])
    sagemaker.delete_endpoint_config(EndpointConfigName=endpoint_config_name)
    return f"Successfully deleted {endpoint_config_name}"


@api_wrapper
def describe(event, context):
    endpoint_config_name = urllib.parse.unquote(event["pathParameters"]["endpointConfigName"])
    return sagemaker.describe_endpoint_config(EndpointConfigName=endpoint_config_name)


@api_wrapper
def list_resources(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.ENDPOINT_CONFIG)
