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

from ml_space_lambda.utils.iam_manager import IAMManager
from ml_space_lambda.utils.mlspace_config import get_environment_variables, retry_config

iam = boto3.client("iam", config=retry_config)
log = logging.getLogger(__name__)


def create_instance_constraint_statement(actions: list[str], resources: list[str], allowed_instances: list[str]):
    return {
        "Effect": "Allow",
        "Action": actions,
        "Resource": resources,
        "Condition": {"ForAnyValue:StringEquals": {"sagemaker:InstanceTypes": allowed_instances}},
    }


def create_sagemaker_resource_arn(resource: str, context) -> str:
    components = context.invoked_function_arn.split(":")
    return f"arn:{components[1]}:sagemaker:{components[3]}:{components[4]}:{resource}/*"


def update_instance_constraint_policies(new_configuration, context) -> None:
    env_vars = get_environment_variables()

    # update jobs
    actions = ["sagemaker:CreateTrainingJob", "sagemaker:CreateHyperParameterTuningJob"]
    resources = [
        create_sagemaker_resource_arn("training-job", context),
        create_sagemaker_resource_arn("hyper-parameter-tuning-job", context),
    ]

    training_statement = create_instance_constraint_statement(
        actions,
        resources,
        new_configuration.training_job_instance_types,
    )

    actions = ["sagemaker:CreateTransformJob"]
    resources = [create_sagemaker_resource_arn("transform-job", context)]
    transform_statement = create_instance_constraint_statement(
        actions, resources, new_configuration.transform_jobs_instance_types
    )

    create_instance_constraint_policy_version(
        env_vars["JOB_INSTANCE_CONSTRAINT_POLICY_ARN"], [training_statement, transform_statement]
    )

    # endpoint config
    actions = ["sagemaker:CreateEndpointConfig"]
    resources = [create_sagemaker_resource_arn("endpoint-config", context)]
    endpoint_statement = create_instance_constraint_statement(actions, resources, new_configuration.endpoint_instance_types)
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

    iam_manager = IAMManager(iam)
    iam_manager._delete_unused_policy_versions(policy_arn)
