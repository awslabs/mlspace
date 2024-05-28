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
import time
from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.app_configuration import ServiceInstanceTypes
from ml_space_lambda.enums import ResourceType, ServiceType
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "JOB_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/job-instance-constraint",
    "ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/job-instance-constraint",
    "NOTEBOOK_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/endpoint-instance-constraint",
}

mock_context = mock.Mock()
mock_context.invoked_function_arn.split.return_value = "arn:aws:lambda:us-east-1:123456789010:function/some-lambda".split(":")

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.app_configuration.lambda_functions import (
        create_instance_constraint_policy_version,
        create_instance_constraint_statement,
        create_sagemaker_resource_arn,
        delete_non_default_policy,
    )
    from ml_space_lambda.app_configuration.lambda_functions import update_configuration as lambda_handler
    from ml_space_lambda.app_configuration.lambda_functions import update_instance_constraint_policies

mock_time = int(time.time())


def generate_event(config_scope: str, version_id: int, enabled_instances=None):
    return {
        "body": json.dumps(
            {
                "configScope": config_scope,
                "versionId": version_id,
                "changeReason": "Testing",
                "createdAt": mock_time,
                "configuration": {
                    "EnabledInstanceTypes": enabled_instances
                    or {
                        ServiceType.NOTEBOOK.value: ["ml.t3.medium", "ml.r5.large"],
                        ServiceType.ENDPOINT.value: ["ml.t3.large", "ml.r5.medium"],
                        ServiceType.TRAINING_JOB.value: ["ml.t3.xlarge", "ml.r5.small"],
                        ServiceType.TRANSFORM_JOB.value: ["ml.t3.kindabig", "ml.r5.kindasmall"],
                    },
                    "EnabledServices": {
                        ServiceType.REALTIME_TRANSLATE.value: "true",
                        ServiceType.BATCH_TRANSLATE.value: "false",
                        ServiceType.LABELING_JOB.value: "true",
                        ServiceType.EMR_CLUSTER.value: "true",
                        ServiceType.ENDPOINT.value: "true",
                        ServiceType.ENDPOINT_CONFIG.value: "false",
                        ServiceType.HPO_JOB.value: "true",
                        ServiceType.MODEL.value: "true",
                        ServiceType.NOTEBOOK.value: "false",
                        ServiceType.TRAINING_JOB.value: "true",
                        ServiceType.TRANSFORM_JOB.value: "true",
                    },
                    "ProjectCreation": {"isAdminOnly": "true", "allowedGroups": ["Justice League", "Avengers", "TMNT"]},
                    "EMRConfig": {
                        "clusterTypes": [
                            {"name": "Small", "size": 3, "masterType": "m5.xlarge", "coreType": "m5.xlarge"},
                            {"name": "Medium", "size": 5, "masterType": "m5.xlarge", "coreType": "m5.xlarge"},
                            {"name": "Large", "size": 7, "masterType": "m5.xlarge", "coreType": "p3.8xlarge"},
                        ],
                        "autoScaling": {
                            "minInstances": 2,
                            "maxInstances": 15,
                            "scaleOut": {"increment": 1, "percentageMemAvailable": 15, "evalPeriods": 1, "cooldown": 300},
                            "scaleIn": {"increment": -1, "percentageMemAvailable": 75, "evalPeriods": 1, "cooldown": 300},
                        },
                        "applications": [
                            {"Name": "Hadoop"},
                            {"Name": "Spark"},
                            {"Name": "Ganglia"},
                            {"Name": "Hive"},
                            {"Name": "Tez"},
                            {"Name": "Presto"},
                            {"Name": "Livy"},
                        ],
                    },
                    "SystemBanner": {
                        "isEnabled": "true",
                        "textColor": "Red",
                        "backgroundColor": "White",
                        "text": "Jeff Bezos",
                    },
                },
            }
        ),
        "requestContext": {"authorizer": {"principalId": "jdoe"}},
    }


@pytest.mark.parametrize(
    "config_scope",
    [
        ("global"),
        ("project_name"),
    ],
    ids=[
        "update_config_app",
        "update_config_project",
    ],
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_success(mock_app_config_dao, config_scope: str):
    version_id = 1
    mock_event = generate_event(config_scope, version_id)
    mock_app_config_dao.create.return_value = None

    # Add 1 to version ID as it's incremented as part of the update
    success_response = f"Successfully updated configuration for {config_scope}, version {version_id+1}."
    expected_response = generate_html_response(200, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response


@pytest.mark.parametrize(
    "config_scope",
    [
        ("global"),
        ("project_name"),
    ],
    ids=[
        "update_config_app_outdated",
        "update_config_project_outdated",
    ],
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_outdated(mock_app_config_dao, config_scope: str):
    version_id = 1
    mock_event = generate_event(config_scope, version_id)

    error_msg = {
        "Error": {"Code": "ConditionalCheckFailedException", "Message": "The conditional request failed."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        429,
        "An error occurred (ConditionalCheckFailedException) when calling the PutItem operation: The conditional request failed.",
    )

    mock_app_config_dao.create.side_effect = ClientError(error_msg, "PutItem")
    assert lambda_handler(mock_event, mock_context) == expected_response


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_unexpected_exception(mock_app_config_dao):
    version_id = 1
    mock_event = generate_event("global", version_id)

    error_msg = {
        "Error": {"Code": "UnexpectedException", "Message": "Some unexpected exception occurred."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (UnexpectedException) when calling the PutItem operation: Some unexpected exception occurred.",
    )

    mock_app_config_dao.create.side_effect = ClientError(error_msg, "PutItem")
    assert lambda_handler(mock_event, mock_context) == expected_response


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.iam")
def test_update_instance_constraint_policies_nochanges(iam):
    previous_configuration = ServiceInstanceTypes.from_dict(
        {
            ServiceType.NOTEBOOK.value: ["ml.t3.medium", "ml.r5.large"],
            ServiceType.ENDPOINT.value: ["ml.t3.large", "ml.r5.medium"],
            ServiceType.TRAINING_JOB.value: ["ml.t3.xlarge", "ml.r5.small"],
            ServiceType.TRANSFORM_JOB.value: ["ml.t3.kindabig", "ml.r5.kindasmall"],
        }
    )

    update_instance_constraint_policies(previous_configuration, previous_configuration, mock_context)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.iam")
def test_update_instance_constraint_policies_allchanges(iam):
    # Clear out previously cached env variables
    mlspace_config.env_variables = {}
    previous_configuration = ServiceInstanceTypes.from_dict(
        {
            ServiceType.NOTEBOOK.value: ["ml.t3.medium", "ml.r5.large"],
            ServiceType.ENDPOINT.value: ["ml.t3.large", "ml.r5.medium"],
            ServiceType.TRAINING_JOB.value: ["ml.t3.xlarge", "ml.r5.small"],
            ServiceType.TRANSFORM_JOB.value: ["ml.t3.kindabig", "ml.r5.kindasmall"],
        }
    )

    new_configuration = ServiceInstanceTypes.from_dict(
        {
            ServiceType.NOTEBOOK.value: ["ml.t3.medium"],
            ServiceType.ENDPOINT.value: ["ml.t3.large"],
            ServiceType.TRAINING_JOB.value: ["ml.t3.xlarge"],
            ServiceType.TRANSFORM_JOB.value: ["ml.t3.kindabig"],
        }
    )

    update_instance_constraint_policies(previous_configuration, new_configuration, mock_context)
    iam.create_policy_version.assert_has_calls(
        [
            mock.call(
                PolicyArn=TEST_ENV_CONFIG["JOB_INSTANCE_CONSTRAINT_POLICY_ARN"], PolicyDocument=mock.ANY, SetAsDefault=True
            ),
            mock.call(
                PolicyArn=TEST_ENV_CONFIG["ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN"],
                PolicyDocument=mock.ANY,
                SetAsDefault=True,
            ),
        ]
    )


def test_create_instance_constraint_statement():
    statement_id = "sid1"
    actions = ["sagemaker:CreateTraningJob", "sagemaker:CreateTransformJob"]
    resources = [
        create_sagemaker_resource_arn(ResourceType.TRAINING_JOB.value, mock_context),
        create_sagemaker_resource_arn(ResourceType.ENDPOINT_CONFIG.value, mock_context),
    ]
    allowed_instances = ["ml.m4.large"]
    expectedResponse = {
        "Sid": statement_id,
        "Effect": "Allow",
        "Action": actions,
        "Resource": resources,
        "Condition": {"ForAnyValue:StringEquals": {"sagemaker:InstanceTypes": allowed_instances}},
    }
    assert expectedResponse == create_instance_constraint_statement("sid1", actions, resources, allowed_instances)


def test_create_sagemaker_resource_arn():
    arn = create_sagemaker_resource_arn("testing", mock_context)
    assert arn == "arn:aws:sagemaker:us-east-1:123456789010:testing/*"


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.iam")
def test_create_instance_constraint_policy_version(iam):
    policy_arn = "arn:aws:iam:::policy/some_policy"
    statements = []

    iam.create_policy_version.return_value = {
        "Versions": [{"IsDefaultVersion": False, "VersionId": 1}, {"IsDefaultVersion": True, "VersionId": 2}]
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


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.iam")
def test_delete_non_default_policy(iam):
    policy_arn = "arn:aws:iam:::policy/some_policy"
    iam.list_policy_versions.return_value = {
        "Versions": [{"IsDefaultVersion": False, "VersionId": 1}, {"IsDefaultVersion": True, "VersionId": 2}]
    }

    delete_non_default_policy(policy_arn)

    iam.list_policy_versions.assert_called_once()
    iam.list_policy_versions.assert_called_with(PolicyArn=policy_arn)
    iam.delete_policy_version.assert_called_once()
    iam.delete_policy_version.assert_called_with(PolicyArn=policy_arn, VersionId=1)
