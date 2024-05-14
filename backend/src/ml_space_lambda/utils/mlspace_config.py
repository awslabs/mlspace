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

from ml_space_lambda.utils.common_functions import retry_config

param_file = {}
env_variables = {}


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
        env_variables = {
            "BUCKET": os.getenv("BUCKET", "mlspace-data-bucket"),
            "S3_KEY": os.getenv("S3_KEY", "notebook-params.json"),
            "SYSTEM_TAG": os.getenv("SYSTEM_TAG", "MLSpace"),
            "DATASETS_TABLE": os.getenv("DATASETS_TABLE", "mlspace-datasets"),
            "PROJECTS_TABLE": os.getenv("PROJECTS_TABLE", "mlspace-projects"),
            "PROJECT_USERS_TABLE": os.getenv("PROJECT_USERS_TABLE", "mlspace-project-users"),
            "USERS_TABLE": os.getenv("USERS_TABLE", "mlspace-users"),
            "RESOURCE_SCHEDULE_TABLE": os.getenv("RESOURCE_SCHEDULE_TABLE", "mlspace-resource-schedule"),
            "RESOURCE_METADATA_TABLE": os.getenv("RESOURCE_METADATA_TABLE", "mlspace-resource-metadata"),
            "APP_CONFIGURATION_TABLE": os.getenv("APP_CONFIGURATION_TABLE", "mlspace-app-configuration"),
            "AWS_DEFAULT_REGION": os.getenv("AWS_DEFAULT_REGION", "us-iso-east-1"),
            "DATA_BUCKET": os.getenv("DATA_BUCKET", "mlspace-data-bucket"),
            "EMR_CONFIG_BUCKET": os.getenv("EMR_CONFIG_BUCKET", "mlspace-emr-config-bucket"),
            "MANAGE_IAM_ROLES": os.getenv("MANAGE_IAM_ROLES", ""),
            "LOG_BUCKET": os.getenv("LOG_BUCKET", "mlspace-log-bucket"),
            "DYNAMO_TABLE": os.getenv("DYNAMO_TABLE", "mlspace-project"),
            "EMR_EC2_ROLE_NAME": os.getenv("EMR_EC2_ROLE_NAME", "EMR_EC2_DefaultRole"),
            "EMR_SERVICE_ROLE_NAME": os.getenv("EMR_SERVICE_ROLE_NAME", "EMR_DefaultRole"),
            "EMR_SECURITY_CONFIGURATION": os.getenv("EMR_SECURITY_CONFIGURATION", "MLSpace-EMR-SecurityConfig"),
            "NEW_USER_SUSPENSION_DEFAULT": os.getenv("NEW_USER_SUSPENSION_DEFAULT", "True"),
            "TRANSLATE_DATE_ROLE_ARN": os.getenv("TRANSLATE_DATE_ROLE_ARN", ""),
        }

    return env_variables
