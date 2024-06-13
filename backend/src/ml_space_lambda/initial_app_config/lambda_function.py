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
from ml_space_lambda.utils.common_functions import generate_html_response, has_tags
from ml_space_lambda.utils.mlspace_config import get_environment_variables, retry_config

log = logging.getLogger(__name__)
ddb = boto3.client("dynamodb", config=retry_config)
app_configuration_dao = AppConfigurationDAO()
iam = boto3.client("iam", config=retry_config)


def lambda_handler(event, context):
    instances = get_compute_types()
    resp = app_configuration_dao.get("global", 1)
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
    update_dynamic_roles()

    generate_html_response(200, "Successfully updated app config")


def update_dynamic_roles():
    env_vars = get_environment_variables()

    if env_vars["MANAGE_IAM_ROLES"] == "false":
        return

    paginator = iam.get_paginator("list_roles")
    pages = paginator.paginate()

    for page in pages:
        if "Roles" in page:
            for role in page["Roles"]:
                tags = iam.list_role_tags(RoleName=role["RoleName"])

                # make sure all expected tags exist to try and ensure this is an MLSpace role
                if "Tags" in tags and has_tags(tags["Tags"], system_tag=env_vars["SYSTEM_TAG"]):
                    # some system roles are tagged properly but with MLSpaceApplication as the user
                    if not has_tags(tags["Tags"], user_name="MLSpaceApplication", system_tag=env_vars["SYSTEM_TAG"]):
                        policies = [
                            env_vars["JOB_INSTANCE_CONSTRAINT_POLICY_ARN"],
                            env_vars["ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN"],
                        ]
                        for policy_arn in policies:
                            iam.attach_role_policy(PolicyArn=policy_arn, RoleName=role["RoleName"])

                        iam.tag_role(RoleName=role["RoleName"], Tags=[{"Key": "dynamic-user-role", "Value": "true"}])
