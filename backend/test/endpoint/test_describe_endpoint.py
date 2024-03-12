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

from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
mock_context = mock.Mock()
mock_endpoint_name = "example_endpoint"

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.endpoint.lambda_functions import describe as lambda_handler


@mock.patch("ml_space_lambda.endpoint.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
def test_describe_endpoint_success(mock_sagemaker, mock_resource_dao):
    mock_event = {"pathParameters": {"endpointName": mock_endpoint_name}}
    mock_username = "jdoe@amazon.com"
    mock_response = {
        "EndpointName": mock_endpoint_name,
        "EndpointStatus": "Fake",
        "EndpointArn": "endpoint-arn",
        "Owner": mock_username,
    }
    term_time = 1234567890
    mock_resource_dao.get.return_value = ResourceSchedulerModel(
        resource_id="some-id",
        resource_type=ResourceType.ENDPOINT,
        termination_time=term_time,
        project="some-project",
    )
    mock_sagemaker.describe_endpoint.return_value = mock_response
    mock_sagemaker.list_tags.side_effect = [
        {
            "Tags": [
                {
                    "Key": "user",
                    "Value": mock_username,
                },
                {
                    "Key": "project",
                    "Value": "test-project",
                },
            ],
            "NextToken": "mock_next_token",
        },
        {
            "Tags": [
                {
                    "Key": "SecondPageTag",
                    "Value": "UnitTest",
                },
            ],
        },
    ]
    mock_response["TerminationTime"] = term_time
    expected_response = generate_html_response(200, mock_response)

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.describe_endpoint.assert_called_with(EndpointName=mock_endpoint_name)


@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
def test_describe_endpoint_client_error(mock_sagemaker):
    mock_event = {"pathParameters": {"endpointName": mock_endpoint_name}}
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }

    mock_sagemaker.describe_endpoint.side_effect = ClientError(error_msg, "DescribeEndpoint")
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the DescribeEndpoint operation: Dummy error message.",
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.describe_endpoint.assert_called_with(EndpointName=mock_endpoint_name)


@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
def test_describe_endpoint_missing_parameters(mock_sagemaker):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.describe_endpoint.assert_not_called()
