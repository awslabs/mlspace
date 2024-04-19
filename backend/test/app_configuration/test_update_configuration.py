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

import pytest

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "DATA_BUCKET": "mlspace-data-bucket"}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.app_configuration.lambda_functions import update_configuration as lambda_handler


def generate_event(dataset_type: str, dataset_scope: str):
    return {
        "body": json.dumps(
            {
                "scope": "global",
                "versionId": 0,
                "configuration": {
                    "DisabledInstanceTypes": {
                        "Notebooks": ["ml.t3.medium", "ml.r5.large"],
                        "Endpoints": ["ml.t3.large", "ml.r5.medium"],
                        "TrainingJobs": ["ml.t3.xlarge", "ml.r5.small"],
                        "TransformJobs": ["ml.t3.kindbig", "ml.r5.kindsmall"],
                    },
                    "EnabledServices": {
                        "RealTimeTranslation": True,
                        "BatchTranslation": False,
                        "GroundTruth": True,
                        "EMR": False,
                    },
                    "ProjectCreation": {"AdminOnly": True, "AllowedGroups": ["Justice League", "Avengers", "TMNT"]},
                    "EMR": {"config": "TODO"},
                    "SystemBanner": {"Enabled": True, "TextColor": "Red", "BackgroundColor": "White", "Text": "Jeff Bezos"},
                },
            }
        ),
        "requestContext": {"authorizer": {"principalId": "jdoe"}},
    }
