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

import logging
import sys

import boto3

from ml_space_lambda.utils.common_functions import api_wrapper, retry_config
from ml_space_lambda.utils.mlspace_config import pull_config_from_s3

logger = logging.getLogger(__name__)
sagemaker = boto3.client("sagemaker", config=retry_config)


this = sys.modules[__name__]

this.ec2_client = boto3.client("ec2", config=retry_config)
this.sagemaker_client = boto3.client("sagemaker", config=retry_config)
this.translate_client = boto3.client("translate", config=retry_config)
this.cached_response_compute_types = None
this.cached_response_translate_languages = None
this.cached_response_subnets = None

# List of ec2 instance types to just disallow across all of MLSpace
this.ec2_instance_type_deny = []  # e.g. ["t2.xlarge"]
# Update as new shapes/apis are supported in MLSpace
this.sagemaker_shapes = [
    "InstanceType",
    "TransformInstanceType",
    "ProcessingInstanceType",
    "TrainingInstanceType",
    "AppInstanceType",
    "ProductionVariantInstanceType",
]
# Map with key to match sagemaker shape; value is a list of types to not allow/return
this.sagemaker_instance_type_deny = {}  # e.g. { "InstanceType": ["ml.t2.xlarge"] }

# Note there is no API available to filter these values.
this.sagemaker_eia_shapes = [
    "NotebookInstanceAcceleratorType",
    "ProductionVariantAcceleratorType",
]


@api_wrapper
def compute_types(event, context):
    response = {"InstanceTypes": {}, "AcceleratorTypes": {}}

    if this.cached_response_compute_types:
        response = this.cached_response_compute_types
    else:
        paginator = this.ec2_client.get_paginator("describe_instance_type_offerings")
        response_iterator = paginator.paginate()
        ec2_instances = []
        for page in response_iterator:
            for offering in page["InstanceTypeOfferings"]:
                if offering["InstanceType"] not in this.ec2_instance_type_deny:
                    ec2_instances.append(offering["InstanceType"])

        for sagemaker_shape in this.sagemaker_shapes:
            all_instance_types = this.sagemaker_client._service_model.shape_for(
                sagemaker_shape
            ).enum
            deny_by_shape = this.sagemaker_instance_type_deny.get(sagemaker_shape, [])
            intersection = [
                it
                for it in all_instance_types
                if it not in deny_by_shape and it[3:] in ec2_instances
            ]
            response["InstanceTypes"][sagemaker_shape] = intersection

        for sagemaker_shape in this.sagemaker_eia_shapes:
            all_instance_types = this.sagemaker_client._service_model.shape_for(
                sagemaker_shape
            ).enum
            deny_by_shape = this.sagemaker_instance_type_deny.get(sagemaker_shape, [])
            # Note there is no EC2 or other api to filter eia on.
            intersection = [it for it in all_instance_types if it not in deny_by_shape]
            response["AcceleratorTypes"][sagemaker_shape] = intersection

        # Done with all shapes so we'll set the cache now!
        this.cached_response_compute_types = response

    return response


@api_wrapper
def notebook_options(event, context):
    # Set the default option of 'No configuration' as first item in array
    configs = ["No configuration"]
    response_iterator = sagemaker.get_paginator("list_notebook_instance_lifecycle_configs")

    for page in response_iterator.paginate():
        for config in page["NotebookInstanceLifecycleConfigs"]:
            if config["NotebookInstanceLifecycleConfigName"].endswith("-int-mls-conf") is False:
                configs.append(config["NotebookInstanceLifecycleConfigName"])

    return {"lifecycleConfigs": configs}


@api_wrapper
def list_languages(event, context):
    language_list = []

    if this.cached_response_translate_languages:
        language_list = this.cached_response_translate_languages
    else:
        response = this.translate_client.list_languages(DisplayLanguageCode="en", MaxResults=500)
        language_list = response["Languages"]
        this.cached_response_translate_languages = language_list

    return language_list


@api_wrapper
def list_subnets(event, context):
    subnets = []

    if this.cached_response_subnets:
        subnets = this.cached_response_subnets
    else:
        param_file = pull_config_from_s3()
        response = this.ec2_client.describe_subnets(
            SubnetIds=param_file["pSMSSubnetIds"].split(",")
        )
        if "Subnets" in response:
            for subnet in response["Subnets"]:
                subnets.append(
                    {"subnetId": subnet["SubnetId"], "availabilityZone": subnet["AvailabilityZone"]}
                )
        this.cached_response_subnets = subnets

    return subnets
