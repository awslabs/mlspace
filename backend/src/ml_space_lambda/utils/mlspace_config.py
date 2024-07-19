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
import os

import boto3

from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.common_functions import retry_config

param_file = {}
env_variables = {}

ENV_DEFAULTS = {
    EnvVariable.APP_CONFIGURATION_TABLE: "mlspace-app-configuration",
    EnvVariable.APP_ROLE_NAME: "mlspace-app-role",
    EnvVariable.AWS_DEFAULT_REGION: "us-iso-east-1",
    EnvVariable.BUCKET: "mlspace-data-bucket",
    EnvVariable.DATA_BUCKET: "mlspace-data-bucket",
    EnvVariable.DATASETS_TABLE: "mlspace-datasets",
    EnvVariable.DYNAMO_TABLE: "mlspace-project",
    EnvVariable.ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN: "",
    EnvVariable.EMR_CONFIG_BUCKET: "mlspace-emr-config-bucket",
    EnvVariable.EMR_EC2_ROLE_NAME: "EMR_EC2_DefaultRole",
    EnvVariable.EMR_EC2_SSH_KEY: "",
    EnvVariable.EMR_SERVICE_ROLE_NAME: "EMR_DefaultRole",
    EnvVariable.EMR_SECURITY_CONFIGURATION: "MLSpace-EMR-SecurityConfig",
    EnvVariable.JOB_INSTANCE_CONSTRAINT_POLICY_ARN: "",
    EnvVariable.KMS_INSTANCE_CONDITIONS_POLICY_ARN: "",
    EnvVariable.LOG_BUCKET: "mlspace-log-bucket",
    EnvVariable.MANAGE_IAM_ROLES: "",
    EnvVariable.NEW_USER_SUSPENSION_DEFAULT: "True",
    EnvVariable.NOTEBOOK_ROLE_NAME: "",
    EnvVariable.RESOURCE_METADATA_TABLE: "mlspace-resource-metadata",
    EnvVariable.RESOURCE_SCHEDULE_TABLE: "mlspace-resource-schedule",
    EnvVariable.PERMISSIONS_BOUNDARY_ARN: "",
    EnvVariable.PROJECTS_TABLE: "mlspace-projects",
    EnvVariable.PROJECT_USERS_TABLE: "mlspace-project-users",
    EnvVariable.S3_KEY: "notebook-params.json",
    EnvVariable.SYSTEM_TAG: "MLSpace",
    EnvVariable.TRANSLATE_DATE_ROLE_ARN: "",
    EnvVariable.USERS_TABLE: "mlspace-users",
    EnvVariable.GROUPS_TABLE: "mlspace-groups",
    EnvVariable.GROUP_USERS_TABLE: "mlspace-group-users",
    EnvVariable.GROUP_DATASETS_TABLE: "mlspace-group-datasets",
}


def pull_config_from_s3() -> dict:
    global param_file
    if not param_file:
        bucket = os.environ["BUCKET"]
        key = os.environ["S3_KEY"]
        s3 = boto3.client("s3", config=retry_config)

        s3_resp = s3.get_object(Bucket=bucket, Key=key)
        param_file = json.loads(s3_resp["Body"].read().decode())

    return param_file


def get_environment_variables() -> dict:
    global env_variables
    if not env_variables:
        env_variables = dict((env_var, os.getenv(env_var, ENV_DEFAULTS[env_var])) for env_var in ENV_DEFAULTS)

    return env_variables
