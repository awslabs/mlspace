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
from ml_space_lambda.enums import EnvVariable, ServiceType
from ml_space_lambda.metadata.lambda_functions import get_compute_types
from ml_space_lambda.utils.common_functions import generate_html_response
from ml_space_lambda.utils.iam_manager import DYNAMIC_USER_ROLE_TAG, IAMManager
from ml_space_lambda.utils.mlspace_config import get_environment_variables, retry_config

log = logging.getLogger(__name__)
ddb = boto3.client("dynamodb", config=retry_config)
app_configuration_dao = AppConfigurationDAO()
iam = boto3.client("iam", config=retry_config)


def lambda_handler(event, context):
    instances = get_compute_types()
    resp = app_configuration_dao.get("global")
    config = resp[0]

    config["configuration"]["EnabledInstanceTypes"][ServiceType.NOTEBOOK.value] = instances["InstanceTypes"]["InstanceType"]
    config["configuration"]["EnabledInstanceTypes"][ServiceType.TRAINING_JOB.value] = instances["InstanceTypes"][
        "TrainingInstanceType"
    ]
    config["configuration"]["EnabledInstanceTypes"][ServiceType.TRANSFORM_JOB.value] = instances["InstanceTypes"][
        "TransformInstanceType"
    ]
    config["configuration"]["EnabledInstanceTypes"][ServiceType.ENDPOINT.value] = instances["InstanceTypes"][
        "ProductionVariantInstanceType"
    ]

    app_configuration_dao.update(config)

    generate_html_response(200, "Successfully updated app config")


def update_dynamic_roles_with_notebook_policies(event, context):
    env_vars = get_environment_variables()

    if env_vars[EnvVariable.MANAGE_IAM_ROLES.value]:
        return

    iam_manager = IAMManager(iam)
    role_names = iam_manager.find_dynamic_user_roles()
    policy_arns = [
        env_vars[EnvVariable.JOB_INSTANCE_CONSTRAINT_POLICY_ARN.value],
        env_vars[EnvVariable.ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN.value],
        env_vars[EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN.value],
    ]
    iam_manager.attach_policies_to_roles(policy_arns, role_names)

    for role_name in role_names:
        iam.tag_role(RoleName=role_name, Tags=[DYNAMIC_USER_ROLE_TAG])
