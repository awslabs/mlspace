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

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.app_configuration.lambda_functions import update_configuration as lambda_handler


mock_time = int(time.time())


def generate_event(config_scope: str, version_id: int):
    return {
        "body": json.dumps(
            {
                "configScope": config_scope,
                "versionId": version_id,
                "changeReason": "Testing",
                "createdAt": mock_time,
                "configuration": {
                    "DisabledInstanceTypes": {
                        "notebook-instance": ["ml.t3.medium", "ml.r5.large"],
                        "endpoint": ["ml.t3.large", "ml.r5.medium"],
                        "training-job": ["ml.t3.xlarge", "ml.r5.small"],
                        "transform-job": ["ml.t3.kindabig", "ml.r5.kindasmall"],
                    },
                    "EnabledServices": {
                        "real-time-translate": "true",
                        "batch-translate-job": "false",
                        "labeling-job": "true",
                        "cluster": "true",
                        "endpoint": "true",
                        "endpoint-config": "false",
                        "hpo-job": "true",
                        "model": "true",
                        "notebook-instance": "false",
                        "training-job": "true",
                        "transform-job": "true",
                    },
                    "ProjectCreation": {"AdminOnly": "true", "AllowedGroups": ["Justice League", "Avengers", "TMNT"]},
                    "EMRConfig": {
                        "cluster-sizes": [
                            {"name": "Small", "size": 3, "master-type": "m5.xlarge", "core-type": "m5.xlarge"},
                            {"name": "Medium", "size": 5, "master-type": "m5.xlarge", "core-type": "m5.xlarge"},
                            {"name": "Large", "size": 7, "master-type": "m5.xlarge", "core-type": "p3.8xlarge"},
                        ],
                        "auto-scaling": {
                            "min-instances": 2,
                            "max-instances": 15,
                            "scale-out": {"increment": 1, "percentage-mem-available": 15, "eval-periods": 1, "cooldown": 300},
                            "scale-in": {"increment": -1, "percentage-mem-available": 75, "eval-periods": 1, "cooldown": 300},
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
                    "SystemBanner": {"Enabled": "true", "TextColor": "Red", "BackgroundColor": "White", "Text": "Jeff Bezos"},
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


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_outdated(mock_app_config_dao):
    version_id = 1
    mock_event = generate_event("global", version_id)

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
