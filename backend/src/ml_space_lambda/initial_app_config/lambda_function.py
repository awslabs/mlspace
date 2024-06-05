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

import logging

import boto3

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationDAO
from ml_space_lambda.enums import ServiceType
from ml_space_lambda.metadata.lambda_functions import get_compute_types
from ml_space_lambda.utils.mlspace_config import retry_config

log = logging.getLogger(__name__)
ddb = boto3.client("dynamodb", config=retry_config)
app_configuration_dao = AppConfigurationDAO()


def lambda_handler(event, context):
    instances = get_compute_types()
    resp = app_configuration_dao.get("global", 1)
    config = resp[0]["configuration"]

    config["EnabledInstanceTypes"][ServiceType.NOTEBOOK.value] = instances["InstanceTypes"]["InstanceType"]
    config["EnabledInstanceTypes"][ServiceType.TRAINING_JOB.value] = instances["InstanceTypes"]["TrainingInstanceType"]
    config["EnabledInstanceTypes"][ServiceType.TRANSFORM_JOB.value] = instances["InstanceTypes"]["TransformInstanceType"]
    config["EnabledInstanceTypes"][ServiceType.ENDPOINT.value] = instances["InstanceTypes"]["ProductionVariantInstanceType"]

    app_configuration_dao.update(config)
