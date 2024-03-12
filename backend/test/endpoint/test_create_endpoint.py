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
import time
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "ENVIRONMENT": "testing",
}
# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.endpoint.lambda_functions import create as lambda_handler

user_name = "jdoe@amazon.com"
project_name = "example_project"

mock_event = {
    "body": json.dumps(
        {
            "EndpointName": "example_endpoint",
            "EndpointConfigName": "example_config",
            "ProjectName": project_name,
            "UserName": user_name,
        }
    ),
    "requestContext": {"authorizer": {"principalId": user_name}},
    "headers": {"x-mlspace-project": project_name},
}

mock_project = ProjectModel(
    name=project_name,
    description="description",
    suspended=False,
    created_by="me",
    created_at=123,
    last_updated_at=321,
    metadata={
        "terminationConfiguration": {
            "defaultEndpointTTL": 72,
            "allowNotebookOwnerOverride": True,
        }
    },
)

mock_context = mock.Mock()

expected_tags = generate_tags(user_name, project_name, "MLSpace")


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.endpoint.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.endpoint.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.endpoint.lambda_functions.resource_metadata_dao")
def test_create_endpoint_success(
    mock_resource_metadata_dao, mock_sagemaker, mock_resource_dao, mock_project_dao
):
    mock_response = {"EndpointArn": "arn:aws:sagemaker:us-east-1:9999999999:resource-id"}

    mock_sagemaker.create_endpoint.return_value = mock_response
    mock_project_dao.get.return_value = mock_project
    mocked_endpoint_name = "example_endpoint"

    expected_response = generate_html_response(200, mock_response)
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_endpoint.assert_called_with(
        EndpointName=mocked_endpoint_name,
        EndpointConfigName="example_config",
        Tags=expected_tags,
    )
    endpoint_schedule = mock_resource_dao.create.call_args.args[0]
    assert endpoint_schedule.resource_id == mocked_endpoint_name
    assert endpoint_schedule.resource_type == ResourceType.ENDPOINT
    # We're mocking a termination time of 3 days so ensure the termination time makes sense
    assert endpoint_schedule.termination_time > (time.time() + (71 * 60 * 60))
    assert endpoint_schedule.project == mock_project.name

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        mocked_endpoint_name,
        ResourceType.ENDPOINT,
        user_name,
        project_name,
        {},
    )


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
def test_create_endpoint_mismached_header(mock_sagemaker):
    fake_project = "FakeProject"
    bad_event = copy.deepcopy(mock_event)
    bad_event["headers"]["x-mlspace-project"] = fake_project
    expected_response = generate_html_response(
        400,
        f"Bad Request: Project header, {fake_project}, does not match the project name associated with the endpoint, {project_name}.",
    )

    assert lambda_handler(bad_event, mock_context) == expected_response

    mock_sagemaker.create_endpoint.assert_not_called()


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
def test_create_endpoint_client_error(mock_sagemaker):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    mock_sagemaker.create_endpoint.side_effect = ClientError(error_msg, "CreateEndpoint")
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the CreateEndpoint operation: Dummy error message.",
    )
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_sagemaker.create_endpoint.assert_called_with(
        EndpointName="example_endpoint",
        EndpointConfigName="example_config",
        Tags=expected_tags,
    )


def test_create_endpoint_generic_error():
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert lambda_handler({}, mock_context) == expected_response
