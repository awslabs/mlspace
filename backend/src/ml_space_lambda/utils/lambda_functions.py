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

import json
import logging

import boto3

from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.iam_manager import IAMManager
from ml_space_lambda.utils.instances import nitro_abbreviated_union, nitro_instances
from ml_space_lambda.utils.mlspace_config import get_environment_variables, retry_config

log = logging.getLogger(__name__)
ddb = boto3.client("dynamodb", config=retry_config)
iam = boto3.client("iam", config=retry_config)
ec2 = boto3.client("ec2", config=retry_config)
sagemaker = boto3.client("sagemaker", config=retry_config)
sagemaker_shapes = [
    "InstanceType",
    "TransformInstanceType",
    "ProcessingInstanceType",
    "TrainingInstanceType",
    "AppInstanceType",
    "ProductionVariantInstanceType",
]

sagemaker_eia_shapes = [
    "NotebookInstanceAcceleratorType",
    "ProductionVariantAcceleratorType",
]


def update_instance_kms_key_conditions(event, ctx):
    # exit early
    env_variables = get_environment_variables()
    if not env_variables[EnvVariable.MANAGE_IAM_ROLES]:
        return

    # build collection of instances used for sagemaker services
    sagemaker_instances = {}
    for sagemaker_shape in sagemaker_shapes + sagemaker_eia_shapes:
        for instance_type in sagemaker._service_model.shape_for(sagemaker_shape).enum:
            components = instance_type.split(".")
            family_name = ".".join(components[:2])
            family = sagemaker_instances.get(family_name, set())
            family.add(instance_type)
            sagemaker_instances[family_name] = family

    # build collection of instances used for other services
    standard_instances = {}
    for instance_type in nitro_instances():
        family_name = instance_type.split(".")[0]
        family = standard_instances.get(family_name, set())
        family.add(instance_type)
        standard_instances[family_name] = family

    ml_instances = nitro_abbreviated_union(sagemaker_instances, "ml")
    std_instances = nitro_abbreviated_union(standard_instances)

    policy_document = json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": [
                        "sagemaker:CreateEndpointConfig",
                        "sagemaker:CreateHyperParameterTuningJob",
                        "sagemaker:CreateNotebookInstance",
                        "sagemaker:CreateTrainingJob",
                        "sagemaker:CreateTransformJob",
                    ],
                    "Resource": "*",
                    "Effect": "Deny",
                    "Condition": {
                        "Null": {"sagemaker:VolumeKmsKey": "true"},
                        "ForAllValues:StringNotLike": {"sagemaker:InstanceTypes": list(ml_instances + std_instances)},
                    },
                }
            ],
        }
    )

    policy_arn = env_variables[EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN.value]
    iam.create_policy_version(PolicyArn=policy_arn, SetAsDefault=True, PolicyDocument=policy_document)
    iam_manager = IAMManager(iam)
    iam_manager._delete_unused_policy_versions(policy_arn)

    return policy_document
