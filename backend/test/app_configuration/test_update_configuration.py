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

from ml_space_lambda.enums import ServiceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "JOB_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/job-instance-constraint",
    "ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/job-instance-constraint",
}

mock_context = mock.Mock()
mock_context.invoked_function_arn.split.return_value = "arn:aws:lambda:us-east-1:123456789010:function/some-lambda".split(":")

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.app_configuration.lambda_functions import update_configuration as lambda_handler

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
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_success(mock_app_config_dao, update_instance_constraint_policies, config_scope: str):
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
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_outdated(mock_app_config_dao, update_instance_constraint_policies, config_scope: str):
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


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_unexpected_exception(mock_app_config_dao, update_instance_constraint_policies):
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
