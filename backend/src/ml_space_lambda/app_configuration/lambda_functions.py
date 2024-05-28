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

import boto3

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationDAO, AppConfigurationModel, SettingsModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper
from ml_space_lambda.utils.mlspace_config import get_environment_variables, retry_config

iam = boto3.client("iam", config=retry_config)
log = logging.getLogger(__name__)
app_configuration_dao = AppConfigurationDAO()


@api_wrapper
def get_configuration(event, context):
    configScope = event["queryStringParameters"]["configScope"]
    num_versions = int(event["queryStringParameters"].get("numVersions", 1))

    return app_configuration_dao.get(configScope=configScope, num_versions=num_versions)


@api_wrapper
def update_configuration(event, context):
    request = json.loads(event["body"])
    configScope = request["configScope"]
    version_id = request["versionId"] + 1  # increment so this will be the latest version

    new_configuration = SettingsModel.from_dict(request["configuration"])

    previous_app_configurations = app_configuration_dao.get(configScope=configScope, num_versions=1)
    if len(previous_app_configurations) > 0:
        previous_configuration = previous_app_configurations[0].configuration
        update_instance_constraint_policies(
            previous_configuration.disabled_instance_types, new_configuration.disabled_instance_types, context
        )

    app_configuration = AppConfigurationModel(
        configScope=configScope,
        version_id=version_id,
        configuration=new_configuration,
        changed_by=event["requestContext"]["authorizer"]["principalId"],
        change_reason=request["changeReason"],
        created_at=time.time(),
    )

    try:
        # Create a record for this configuration and mark it the latest config by incrementing the version Id
        app_configuration_dao.create(config=app_configuration)
    except Exception as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            e.response["ResponseMetadata"]["HTTPStatusCode"] = 429
        raise e

    return f"Successfully updated configuration for {configScope}, version {version_id}."


def create_instance_constraint_statement(
    statement_id: str, actions: list[str], resources: list[str], allowed_instances: list[str]
):
    return {
        "Sid": statement_id,
        "Effect": "Allow",
        "Action": actions,
        "Resource": resources,
        "Condition": {"ForAnyValue:StringEquals": {"sagemaker:InstanceTypes": allowed_instances}},
    }


def create_sagemaker_resource_arn(resource: str, context) -> str:
    components = context.invoked_function_arn.split(":")
    return f"arn:{components[1]}:sagemaker:{components[3]}:{components[4]}:{resource}/*"


def update_instance_constraint_policies(previous_configuration, new_configuration, context) -> None:
    env_vars = get_environment_variables()

    # update jobs
    actions = ["sagemaker:CreateTrainingJob", "sagemaker:CreateHyperParameterTuningJob", "sagemaker:CreateTransformJob"]
    resources = [
        create_sagemaker_resource_arn(ResourceType.TRAINING_JOB.value, context),
        create_sagemaker_resource_arn(ResourceType.HPO_JOB.value, context),
        create_sagemaker_resource_arn(ResourceType.TRANSFORM_JOB.value, context),
    ]

    training_statement = create_instance_constraint_statement(
        "training1",
        actions,
        resources,
        new_configuration.training_job_instance_types,
    )

    transform_statement = create_instance_constraint_statement(
        "transform1", actions, resources, new_configuration.transform_jobs_instance_types
    )

    create_instance_constraint_policy_version(
        env_vars["JOB_INSTANCE_CONSTRAINT_POLICY_ARN"], [training_statement, transform_statement]
    )

    # endpoint config
    actions = ["sagemaker:CreateEndpointConfig"]
    resources = [create_sagemaker_resource_arn(ResourceType.ENDPOINT.value, context)]
    endpoint_statement = create_instance_constraint_statement(
        "endpoint1", actions, resources, new_configuration.endpoint_instance_types
    )
    create_instance_constraint_policy_version(env_vars["ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN"], [endpoint_statement])


def create_instance_constraint_policy_version(policy_arn: str, statements: list) -> None:
    log.info("Creating new version %s", policy_arn)
    iam.create_policy_version(
        PolicyArn=policy_arn,
        PolicyDocument=json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": statements,
            }
        ),
        SetAsDefault=True,
    )

    delete_non_default_policy(policy_arn)


def delete_non_default_policy(policy_arn: str) -> None:
    list_policy_versions_response = iam.list_policy_versions(PolicyArn=policy_arn)
    log.info(list_policy_versions_response)
    for version in list_policy_versions_response["Versions"]:
        if not version["IsDefaultVersion"]:
            log.info("Deleting version %s", version)
            iam.delete_policy_version(PolicyArn=policy_arn, VersionId=version["VersionId"])
