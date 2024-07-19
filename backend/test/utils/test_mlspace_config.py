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
from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.mlspace_config import get_environment_variables

TEST_ENV_CONFIG = {
    EnvVariable.AWS_DEFAULT_REGION: "us-east-1",
    EnvVariable.BUCKET: "testS3Bucket",
    EnvVariable.S3_KEY: "testS3Key",
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
            EnvVariable.APP_ROLE_NAME: "mlspace-app-role",
            EnvVariable.APP_CONFIGURATION_TABLE: "mlspace-app-configuration",
            EnvVariable.AWS_DEFAULT_REGION: "us-iso-east-1",
            EnvVariable.BUCKET: "mlspace-data-bucket",
            EnvVariable.DATA_BUCKET: "mlspace-data-bucket",
            EnvVariable.DATASETS_TABLE: "mlspace-datasets",
            EnvVariable.DYNAMO_TABLE: "mlspace-project",
            EnvVariable.EMR_CONFIG_BUCKET: "mlspace-emr-config-bucket",
            EnvVariable.EMR_EC2_ROLE_NAME: "EMR_EC2_DefaultRole",
            EnvVariable.EMR_EC2_SSH_KEY: "",
            EnvVariable.EMR_SERVICE_ROLE_NAME: "EMR_DefaultRole",
            EnvVariable.EMR_SECURITY_CONFIGURATION: "MLSpace-EMR-SecurityConfig",
            EnvVariable.ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN: "",
            EnvVariable.JOB_INSTANCE_CONSTRAINT_POLICY_ARN: "",
            EnvVariable.LOG_BUCKET: "mlspace-log-bucket",
            EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN: "",
            EnvVariable.MANAGE_IAM_ROLES: "",
            EnvVariable.NEW_USER_SUSPENSION_DEFAULT: "True",
            EnvVariable.NOTEBOOK_ROLE_NAME: "",
            EnvVariable.PERMISSIONS_BOUNDARY_ARN: "",
            EnvVariable.PROJECTS_TABLE: "mlspace-projects",
            EnvVariable.PROJECT_USERS_TABLE: "mlspace-project-users",
            EnvVariable.GROUPS_TABLE: "mlspace-groups",
            EnvVariable.GROUP_DATASETS_TABLE: "mlspace-group-datasets",
            EnvVariable.GROUP_USERS_TABLE: "mlspace-group-users",
            EnvVariable.RESOURCE_METADATA_TABLE: "mlspace-resource-metadata",
            EnvVariable.RESOURCE_SCHEDULE_TABLE: "mlspace-resource-schedule",
            EnvVariable.S3_KEY: "notebook-params.json",
            EnvVariable.SYSTEM_TAG: "MLSpace",
            EnvVariable.TRANSLATE_DATE_ROLE_ARN: "",
            EnvVariable.USERS_TABLE: "mlspace-users",
        }
