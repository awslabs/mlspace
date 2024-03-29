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

# Testing for the describe_config Lambda function
from unittest import mock

from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.config.lambda_functions import describe

mock_context = mock.Mock()


@mock.patch("ml_space_lambda.config.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.config.lambda_functions.sagemaker")
def test_describe_config_success(mock_sagemaker, mock_pull_config, mock_s3_param_json):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}

    expected_body = {
        "environmentVariables": {
            "BUCKET": "mlspace-data-bucket",
            "S3_KEY": "notebook-params.json",
            "SYSTEM_TAG": "MLSpace",
            "CLUSTER_CONFIG_KEY": "cluster-config.json",
            "DATASETS_TABLE": "mlspace-datasets",
            "PROJECTS_TABLE": "mlspace-projects",
            "PROJECT_USERS_TABLE": "mlspace-project-users",
            "USERS_TABLE": "mlspace-users",
            "RESOURCE_SCHEDULE_TABLE": "mlspace-resource-schedule",
            "RESOURCE_METADATA_TABLE": "mlspace-resource-metadata",
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
        },
        "s3ParamFile": {
            "pSMSKMSKeyId": "example_key_id",
            "pSMSRoleARN": "mock_iam_role_from_s3_config",
            "pSMSSecurityGroupId": ["example_security_group_id"],
            "pSMSLifecycleConfigName": "fakeLifecycleConfig",
            "pSMSSubnetIds": "subnet1,subnet2,subnet3",
        },
        "notebookLifecycleConfig": {
            "NotebookInstanceLifecycleConfigArn": "arn:aws:sagemaker:us-east-1:...",
            "NotebookInstanceLifecycleConfigName": "mlspace-notebook-lifecycle-config",
            "OnCreate": [{"Content": ""}],
            "OnStart": [{"Content": ""}],
        },
    }
    expected_response = generate_html_response(200, expected_body)
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.describe_notebook_instance_lifecycle_config.return_value = {
        "NotebookInstanceLifecycleConfigArn": "arn:aws:sagemaker:us-east-1:...",
        "NotebookInstanceLifecycleConfigName": "mlspace-notebook-lifecycle-config",
        "OnCreate": [{"Content": ""}],
        "OnStart": [{"Content": ""}],
        "ResponseMetadata": {},
    }

    with mock.patch.dict("os.environ", {"AWS_DEFAULT_REGION": "us-iso-east-1"}, clear=True):
        assert describe({}, mock_context) == expected_response

    mock_sagemaker.describe_notebook_instance_lifecycle_config.assert_called_with(
        NotebookInstanceLifecycleConfigName="fakeLifecycleConfig"
    )
    mock_pull_config.assert_called_once()


@mock.patch("ml_space_lambda.config.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.config.lambda_functions.sagemaker")
def test_describe_config_client_error(mock_sagemaker, mock_pull_config, mock_s3_param_json):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    mock_sagemaker.describe_notebook_instance_lifecycle_config.side_effect = ClientError(
        error_msg, "DescribeNotebookInstanceLifecycleConfig"
    )
    mock_pull_config.return_value = mock_s3_param_json
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the "
        "DescribeNotebookInstanceLifecycleConfig operation: "
        "Dummy error message.",
    )

    with mock.patch.dict("os.environ", {"AWS_DEFAULT_REGION": "us-iso-east-1"}, clear=True):
        assert describe({}, mock_context) == expected_response
    mock_sagemaker.describe_notebook_instance_lifecycle_config.assert_called_with(
        NotebookInstanceLifecycleConfigName="fakeLifecycleConfig"
    )
    mock_pull_config.assert_called_once()
