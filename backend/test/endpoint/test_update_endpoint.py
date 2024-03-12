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

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}
mock_context = mock.Mock()
# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.endpoint.lambda_functions import update as lambda_handler


@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
def test_update_endpoint_success(mock_sagemaker):
    mock_event = {
        "pathParameters": {
            "endpointName": "example_endpoint",
        },
        "body": json.dumps(
            {
                "endpointConfigName": "example_config_name",
            }
        ),
    }
    mock_response = {
        "EndpointName": "example_endpoint",
        "EndpointStatus": "Fake",
    }

    mock_sagemaker.update_endpoint.return_value = mock_response
    expected_response = generate_html_response(200, mock_response)
    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.update_endpoint.assert_called_with(
        EndpointName="example_endpoint",
        EndpointConfigName="example_config_name",
        RetainAllVariantProperties=False,
    )


@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
def test_update_endpoint_client_error(mock_sagemaker):
    mock_event = {
        "pathParameters": {
            "endpointName": "example_endpoint",
        },
        "body": json.dumps(
            {
                "endpointConfigName": "example_config_name",
            }
        ),
    }
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }

    mock_sagemaker.update_endpoint.side_effect = ClientError(error_msg, "UpdateEndpoint")
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the UpdateEndpoint operation: Dummy error message.",
    )
    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.update_endpoint.assert_called_with(
        EndpointName="example_endpoint",
        EndpointConfigName="example_config_name",
        RetainAllVariantProperties=False,
    )


@mock.patch("ml_space_lambda.endpoint.lambda_functions.sagemaker")
def test_update_endpoint_missing_parameters(mock_sagemaker):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.update_endpoint.assert_not_called()
