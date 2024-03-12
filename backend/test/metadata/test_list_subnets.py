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

# Testing for the list_languages Lambda function

from unittest import mock

from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.metadata.lambda_functions import list_subnets as lambda_handler

mock_context = mock.Mock()
mock_ec2_response = {
    "Subnets": [
        {
            "AvailabilityZone": "us-east-1a",
            "AvailabilityZoneId": "abc111",
            "SubnetId": "subnet1",
            "VpcId": "123abc",
        },
        {
            "AvailabilityZone": "us-east-1b",
            "AvailabilityZoneId": "abc222",
            "SubnetId": "subnet2",
            "VpcId": "123abc",
        },
        {
            "AvailabilityZone": "us-east-1c",
            "AvailabilityZoneId": "abc333",
            "SubnetId": "subnet3",
            "VpcId": "123abc",
        },
    ]
}

expected_body = [
    {
        "subnetId": "subnet1",
        "availabilityZone": "us-east-1a",
    },
    {
        "subnetId": "subnet2",
        "availabilityZone": "us-east-1b",
    },
    {
        "subnetId": "subnet3",
        "availabilityZone": "us-east-1c",
    },
]


@mock.patch("ml_space_lambda.metadata.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.metadata.lambda_functions.ec2_client")
def test_list_subnets(mock_ec2, mock_pull_config, mock_s3_param_json):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mock_pull_config.return_value = mock_s3_param_json
    expected_response = generate_html_response(200, expected_body)
    mock_ec2.describe_subnets.return_value = mock_ec2_response
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_ec2.describe_subnets.assert_called_with(SubnetIds=["subnet1", "subnet2", "subnet3"])
    mock_pull_config.assert_called_once()


@mock.patch(
    "ml_space_lambda.metadata.lambda_functions.cached_response_subnets",
    expected_body,
)
@mock.patch("ml_space_lambda.metadata.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.metadata.lambda_functions.ec2_client")
def test_list_subnets_cached(mock_ec2, mock_pull_config):
    expected_response = generate_html_response(200, expected_body)
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_ec2.assert_not_called()
    mock_pull_config.assert_not_called()


@mock.patch("ml_space_lambda.metadata.lambda_functions.cached_response_subnets", [])
@mock.patch("ml_space_lambda.metadata.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.metadata.lambda_functions.ec2_client")
def test_list_subnets_client_error(mock_ec2, mock_pull_config, mock_s3_param_json):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mock_pull_config.return_value = mock_s3_param_json
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the DescribeSubnets operation: Dummy error message.",
    )
    mock_ec2.describe_subnets.side_effect = ClientError(error_msg, "DescribeSubnets")
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_ec2.describe_subnets.assert_called_with(SubnetIds=["subnet1", "subnet2", "subnet3"])
    mock_pull_config.assert_called_once()
