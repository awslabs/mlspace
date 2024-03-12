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

import copy
import json
import os
from unittest import mock

from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "BUCKET": "testS3Bucket",
    "S3_KEY": "testS3Key",
    "AWS_ACCESS_KEY_ID": "fakeAccessKey",
    "AWS_SECRET_ACCESS_KEY": "fakeSecretKey",
}

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.model.lambda_functions import create as lambda_handler

MOCK_USERNAME = "jdoe@amazon.com"
MOCK_MODEL_NAME = "example_model"
MOCK_PROJECT_NAME = "example_project"
MOCK_ARN_FROM_S3_CONFIG = "mock_iam_role_from_s3_config"
MOCK_TAGS = generate_tags(MOCK_USERNAME, MOCK_PROJECT_NAME, "MLSpace")

mock_event_list = [
    {
        "body": json.dumps(
            {
                "ModelName": MOCK_MODEL_NAME,
                "EndpointName": "example_endpoint",
                "EndpointConfigName": "example_config",
                "ProjectName": MOCK_PROJECT_NAME,
                "PrimaryContainer": {
                    "Image": "example_image",
                    "Mode": "example_mode",
                    "ContainerHostname": "example_hostname",
                    "ModelDataUrl": "s3://some-s3-bucket",
                    "Environment": {"samplekey": "samplevalue"},
                },
            }
        ),
        "requestContext": {
            "authorizer": {
                "principalId": MOCK_USERNAME,
            }
        },
        "headers": {"x-mlspace-project": MOCK_PROJECT_NAME},
    },
    {
        "body": json.dumps(
            {
                "ModelName": MOCK_MODEL_NAME,
                "EndpointName": "example_endpoint",
                "EndpointConfigName": "example_config",
                "ProjectName": MOCK_PROJECT_NAME,
                "PrimaryContainer": {
                    "Image": "example_image",
                    "Mode": "example_mode",
                    "ContainerHostname": "example_hostname",
                    "ModelDataUrl": "s3://some-s3-bucket",
                    "Environment": {"samplekey": "samplevalue"},
                },
                "VpcConfig": {
                    "Subnets": ["mock_event_subnet1", "mock_event_subnet2", "mock_event_subnet3"]
                },
            }
        ),
        "requestContext": {
            "authorizer": {
                "principalId": MOCK_USERNAME,
            }
        },
        "headers": {"x-mlspace-project": MOCK_PROJECT_NAME},
    },
    {
        "body": json.dumps(
            {
                "ModelName": MOCK_MODEL_NAME,
                "EndpointName": "example_endpoint",
                "EndpointConfigName": "example_config",
                "ProjectName": MOCK_PROJECT_NAME,
                "PrimaryContainer": {
                    "Image": "example_image",
                    "Mode": "example_mode",
                },
                "VpcConfig": {
                    "Subnets": ["mock_event_subnet1", "mock_event_subnet2", "mock_event_subnet3"]
                },
            }
        ),
        "requestContext": {
            "authorizer": {
                "principalId": MOCK_USERNAME,
            }
        },
        "headers": {"x-mlspace-project": MOCK_PROJECT_NAME},
    },
]

mock_context = mock.Mock()

mock_project_user = ProjectUserModel(
    username="jdoe@amazon.com",
    project_name=MOCK_PROJECT_NAME,
    permissions=[],
    role="mock_iam_role_from_dynamo",
)

mock_primary_container_list = [
    {
        "Image": "example_image",
        "Mode": "example_mode",
        "ContainerHostname": "example_hostname",
        "ModelDataUrl": "s3://some-s3-bucket",
        "Environment": {"samplekey": "samplevalue"},
    },
    {
        "Image": "example_image",
        "Mode": "example_mode",
    },
]


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.model.lambda_functions.random")
@mock.patch("ml_space_lambda.model.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.model.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.model.lambda_functions.resource_metadata_dao")
def test_create_model_success_all_optional_parameters_s3_config(
    mock_resource_metadata_dao,
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}

    expected_response = generate_html_response(
        200, {"ModelArn": f"arn:aws:sagemaker:example:model/{MOCK_MODEL_NAME}"}
    )

    mock_sagemaker.create_model.return_value = {
        "ModelArn": f"arn:aws:sagemaker:example:model/{MOCK_MODEL_NAME}"
    }

    mock_pull_config.return_value = mock_s3_param_json
    mock_project_user_dao.get.return_value = mock_project_user
    mock_random.sample.return_value = ["mock_event_subnet2"]

    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event_list[0], mock_context) == expected_response

    mock_sagemaker.create_model.assert_called_with(
        ModelName=MOCK_MODEL_NAME,
        PrimaryContainer=mock_primary_container_list[0],
        ExecutionRoleArn=MOCK_ARN_FROM_S3_CONFIG,
        Tags=MOCK_TAGS,
        VpcConfig={
            "SecurityGroupIds": ["example_security_group_id"],
            "Subnets": ["mock_event_subnet2"],
        },
        EnableNetworkIsolation=True,
    )

    mock_pull_config.assert_called_once()
    mock_project_user_dao.get.assert_not_called()

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        MOCK_MODEL_NAME,
        ResourceType.MODEL,
        MOCK_USERNAME,
        MOCK_PROJECT_NAME,
        {},
    )


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.model.lambda_functions.random")
@mock.patch("ml_space_lambda.model.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.model.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.model.lambda_functions.resource_metadata_dao")
def test_create_model_success_all_optional_parameters_iam_role_from_dynamo(
    mock_resource_metadata_dao,
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}

    expected_response = generate_html_response(
        200, {"ModelArn": f"arn:aws:sagemaker:example:model/{MOCK_MODEL_NAME}"}
    )

    mock_sagemaker.create_model.return_value = {
        "ModelArn": f"arn:aws:sagemaker:example:model/{MOCK_MODEL_NAME}"
    }
    mock_random.sample.return_value = ["mock_event_subnet2"]
    mock_pull_config.return_value = mock_s3_param_json
    mock_project_user_dao.get.return_value = mock_project_user

    # patch variable to test pulling config from dynamo
    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": "True"}):
        assert lambda_handler(mock_event_list[1], mock_context) == expected_response

    mock_sagemaker.create_model.assert_called_with(
        ModelName=MOCK_MODEL_NAME,
        PrimaryContainer=mock_primary_container_list[0],
        ExecutionRoleArn="mock_iam_role_from_dynamo",
        Tags=MOCK_TAGS,
        VpcConfig={
            "SecurityGroupIds": ["example_security_group_id"],
            "Subnets": ["mock_event_subnet1", "mock_event_subnet2", "mock_event_subnet3"],
        },
        EnableNetworkIsolation=True,
    )
    mock_pull_config.assert_called_once()
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        MOCK_MODEL_NAME,
        ResourceType.MODEL,
        MOCK_USERNAME,
        MOCK_PROJECT_NAME,
        {},
    )


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.model.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.model.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.model.lambda_functions.resource_metadata_dao")
def test_create_model_success_no_optional_parameters(
    mock_resource_metadata_dao,
    mock_project_user_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}

    expected_response = generate_html_response(
        200, {"ModelArn": f"arn:aws:sagemaker:example:model/{MOCK_MODEL_NAME}"}
    )

    mock_sagemaker.create_model.return_value = {
        "ModelArn": f"arn:aws:sagemaker:example:model/{MOCK_MODEL_NAME}"
    }

    mock_pull_config.return_value = mock_s3_param_json

    assert lambda_handler(mock_event_list[2], mock_context) == expected_response

    mock_sagemaker.create_model.assert_called_with(
        ModelName=MOCK_MODEL_NAME,
        PrimaryContainer=mock_primary_container_list[1],
        ExecutionRoleArn="mock_iam_role_from_s3_config",
        Tags=MOCK_TAGS,
        VpcConfig={
            "SecurityGroupIds": ["example_security_group_id"],
            "Subnets": ["mock_event_subnet1", "mock_event_subnet2", "mock_event_subnet3"],
        },
        EnableNetworkIsolation=True,
    )
    mock_pull_config.assert_called_once()
    mock_project_user_dao.get.assert_not_called()

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        MOCK_MODEL_NAME,
        ResourceType.MODEL,
        MOCK_USERNAME,
        MOCK_PROJECT_NAME,
        {},
    )


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.model.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.model.lambda_functions.project_user_dao")
def test_create_model_client_error(
    mock_project_user_dao, mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}
    mlspace_config.param_file = {}

    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the GetObject operation: Dummy error message.",
    )
    mock_sagemaker.create_model.side_effect = ClientError(error_msg, "GetObject")
    mock_pull_config.return_value = mock_s3_param_json

    assert lambda_handler(mock_event_list[1], mock_context) == expected_response

    mock_sagemaker.create_model.assert_called_with(
        ModelName=MOCK_MODEL_NAME,
        PrimaryContainer=mock_primary_container_list[0],
        ExecutionRoleArn=MOCK_ARN_FROM_S3_CONFIG,
        Tags=MOCK_TAGS,
        VpcConfig={
            "SecurityGroupIds": ["example_security_group_id"],
            "Subnets": ["mock_event_subnet1", "mock_event_subnet2", "mock_event_subnet3"],
        },
        EnableNetworkIsolation=True,
    )

    mock_pull_config.assert_called_once()
    mock_project_user_dao.get.assert_not_called()


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.model.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.model.lambda_functions.project_user_dao")
def test_create_model_mismatched_header(
    mock_project_user_dao, mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}
    mlspace_config.param_file = {}
    fake_project = "FakeProject"
    bad_event = copy.deepcopy(mock_event_list[1])
    bad_event["headers"]["x-mlspace-project"] = fake_project
    expected_response = generate_html_response(
        400,
        f"Bad Request: Project header, {fake_project}, does not match the project name associated with the model, {MOCK_PROJECT_NAME}.",
    )

    assert lambda_handler(bad_event, mock_context) == expected_response

    mock_sagemaker.create_model.assert_not_called()
    mock_pull_config.assert_not_called()
    mock_project_user_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.model.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.model.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
def test_create_model_missing_parameters(mock_sagemaker, mock_pull_config, mock_project_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.create_model.assert_not_called()
    mock_pull_config.assert_not_called()
    mock_project_user_dao.get.assert_not_called()
