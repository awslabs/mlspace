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
from unittest import mock

from ml_space_lambda.data_access_objects.app_configuration import ServiceInstanceTypes
from ml_space_lambda.enums import ResourceType, ServiceType
from ml_space_lambda.utils import mlspace_config

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "JOB_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/job-instance-constraint",
    "ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/job-instance-constraint",
}

mock_context = mock.Mock()
mock_context.invoked_function_arn.split.return_value = "arn:aws:lambda:us-east-1:123456789010:function/some-lambda".split(":")

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.app_configuration.lambda_functions import update_instance_constraint_policies
    from ml_space_lambda.app_configuration.policy_helper.notebook import (
        create_instance_constraint_policy_version,
        create_instance_constraint_statement,
        create_sagemaker_resource_arn,
    )


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.app_configuration.policy_helper.notebook.create_instance_constraint_policy_version")
def test_update_instance_constraint_policies(create_instance_constraint_policy_version):
    # Clear out previously cached env variables
    mlspace_config.env_variables = {}

    new_configuration = ServiceInstanceTypes.from_dict(
        {
            ServiceType.NOTEBOOK.value: ["ml.t3.medium"],
            ServiceType.ENDPOINT.value: ["ml.t3.large"],
            ServiceType.TRAINING_JOB.value: ["ml.t3.xlarge"],
            ServiceType.TRANSFORM_JOB.value: ["ml.t3.kindabig"],
        }
    )

    update_instance_constraint_policies(new_configuration, mock_context)
    create_instance_constraint_policy_version.assert_has_calls(
        [
            mock.call(TEST_ENV_CONFIG["JOB_INSTANCE_CONSTRAINT_POLICY_ARN"], mock.ANY),
            mock.call(TEST_ENV_CONFIG["ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN"], mock.ANY),
        ]
    )


def test_create_instance_constraint_statement():
    actions = ["sagemaker:CreateTraningJob", "sagemaker:CreateTransformJob"]
    resources = [
        create_sagemaker_resource_arn(ResourceType.TRAINING_JOB.value, mock_context),
        create_sagemaker_resource_arn(ResourceType.ENDPOINT_CONFIG.value, mock_context),
    ]
    allowed_instances = ["ml.m4.large"]
    expectedResponse = {
        "Effect": "Allow",
        "Action": actions,
        "Resource": resources,
        "Condition": {"ForAnyValue:StringEquals": {"sagemaker:InstanceTypes": allowed_instances}},
    }
    assert expectedResponse == create_instance_constraint_statement(actions, resources, allowed_instances)


def test_create_sagemaker_resource_arn():
    arn = create_sagemaker_resource_arn("testing", mock_context)
    assert arn == "arn:aws:sagemaker:us-east-1:123456789010:testing/*"


@mock.patch("ml_space_lambda.utils.iam_manager.boto3")
@mock.patch("ml_space_lambda.app_configuration.policy_helper.notebook.iam")
def test_create_instance_constraint_policy_version(iam, boto3):
    policy_arn = "arn:aws:iam:::policy/some_policy"
    statements = []

    iam.create_policy_version.return_value = {
        "Versions": [{"IsDefaultVersion": False, "VersionId": 1}, {"IsDefaultVersion": True, "VersionId": 2}]
    }

    iam.list_policy_versions.return_value = {
        "Versions": [{"VersionId": 1, "IsDefaultVersion": False}, {"VersionId": 2, "IsDefaultVersion": True}]
    }

    create_instance_constraint_policy_version(policy_arn, statements)

    iam.create_policy_version.assert_called_once()
    iam.create_policy_version.assert_called_with(
        PolicyArn=policy_arn,
        PolicyDocument=json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": statements,
            }
        ),
        SetAsDefault=True,
    )

    iam.delete_policy_version.assert_called_with(PolicyArn=policy_arn, VersionId=1)
