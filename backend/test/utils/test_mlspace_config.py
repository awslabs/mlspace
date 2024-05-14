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
from io import BytesIO
from unittest import mock

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "BUCKET": "testS3Bucket",
    "S3_KEY": "testS3Key",
}


@mock.patch("ml_space_lambda.utils.mlspace_config.boto3.client")
def test_pull_config_from_s3(mock_s3, mock_s3_param_json):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}

    mock_s3.return_value.get_object.return_value = {
        "Body": BytesIO(bytes(json.dumps(mock_s3_param_json), "utf-8")),
    }

    with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
        assert mlspace_config.pull_config_from_s3() == mock_s3_param_json

    mock_s3.return_value.get_object.assert_called_with(Bucket="testS3Bucket", Key="testS3Key")


def test_environment_variables():
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}
    with mock.patch.dict("os.environ", {"AWS_DEFAULT_REGION": "us-iso-east-1"}, clear=True):
        assert get_environment_variables() == {
            "BUCKET": "mlspace-data-bucket",
            "S3_KEY": "notebook-params.json",
            "SYSTEM_TAG": "MLSpace",
            "DATASETS_TABLE": "mlspace-datasets",
            "PROJECTS_TABLE": "mlspace-projects",
            "USERS_TABLE": "mlspace-users",
            "PROJECT_USERS_TABLE": "mlspace-project-users",
            "RESOURCE_SCHEDULE_TABLE": "mlspace-resource-schedule",
            "RESOURCE_METADATA_TABLE": "mlspace-resource-metadata",
            "APP_CONFIGURATION_TABLE": "mlspace-app-configuration",
            "AWS_DEFAULT_REGION": "us-iso-east-1",
            "DATA_BUCKET": "mlspace-data-bucket",
            "EMR_CONFIG_BUCKET": "mlspace-emr-config-bucket",
            "MANAGE_IAM_ROLES": "",
            "LOG_BUCKET": "mlspace-log-bucket",
            "DYNAMO_TABLE": "mlspace-project",
            "EMR_EC2_ROLE_NAME": "EMR_EC2_DefaultRole",
            "EMR_SERVICE_ROLE_NAME": "EMR_DefaultRole",
            "EMR_SECURITY_CONFIGURATION": "MLSpace-EMR-SecurityConfig",
            "NEW_USER_SUSPENSION_DEFAULT": "True",
            "TRANSLATE_DATE_ROLE_ARN": "",
        }
