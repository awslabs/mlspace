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

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationModel
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.app_configuration.lambda_functions import get_configuration as lambda_handler


def generate_event(config_scope: str):
    return {
        "body": json.dumps(
            {
                "configScope": config_scope,
                "numVersions": 5,
            }
        ),
    }

def generate_app_config_model(config_scope: str):
    return AppConfigurationModel(
        config_scope,
        1,
        None,
        'tester',
        'testing'
    )

@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_get_config_success(mock_app_config_dao):
    config_scope = 'global'
    mock_event = generate_event(config_scope)
    mock_app_model = generate_app_config_model(config_scope)
    mock_app_config_dao.get.return_value = mock_app_model

    success_response = mock_app_model
    expected_response = generate_html_response(200, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response