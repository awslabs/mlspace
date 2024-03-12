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

# Testing for the list_endpoint Lambda function
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}
# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.metadata.lambda_functions import compute_types as lambda_handler

mock_context = mock.Mock()

mock_ec2_response = [
    {
        "InstanceTypeOfferings": [
            {
                "InstanceType": "c5.large",
            },
            {
                "InstanceType": "c5.xlarge",
            },
            {
                "InstanceType": "c5.2xlarge",
            },
        ]
    },
]
expected_body = {
    "InstanceTypes": {
        "InstanceType": ["ml.c5.xlarge", "ml.c5.2xlarge"],
        "TransformInstanceType": ["ml.c5.xlarge", "ml.c5.2xlarge"],
        "ProcessingInstanceType": ["ml.c5.xlarge", "ml.c5.2xlarge"],
        "TrainingInstanceType": ["ml.c5.xlarge", "ml.c5.2xlarge"],
        "AppInstanceType": ["ml.c5.large", "ml.c5.xlarge", "ml.c5.2xlarge"],
        "ProductionVariantInstanceType": ["ml.c5.large", "ml.c5.xlarge", "ml.c5.2xlarge"],
    },
    "AcceleratorTypes": {
        "NotebookInstanceAcceleratorType": [
            "ml.eia1.medium",
            "ml.eia1.large",
            "ml.eia1.xlarge",
            "ml.eia2.medium",
            "ml.eia2.large",
            "ml.eia2.xlarge",
        ],
        "ProductionVariantAcceleratorType": [
            "ml.eia1.medium",
            "ml.eia1.large",
            "ml.eia1.xlarge",
            "ml.eia2.medium",
            "ml.eia2.large",
            "ml.eia2.xlarge",
        ],
    },
}


@mock.patch("ml_space_lambda.metadata.lambda_functions.ec2_client")
def test_describe_compute_types_success(mock_ec2):
    expected_response = generate_html_response(200, expected_body)
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = mock_ec2_response
    mock_ec2.get_paginator.return_value = mock_paginator
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_ec2.get_paginator.assert_called()


@mock.patch("ml_space_lambda.metadata.lambda_functions.ec2_client")
def test_describe_compute_types_cached(mock_ec2):
    expected_response = generate_html_response(200, expected_body)
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_ec2.get_paginator.assert_not_called()


@mock.patch.dict(
    "ml_space_lambda.metadata.lambda_functions.cached_response_compute_types", {}, clear=True
)
@mock.patch("ml_space_lambda.metadata.lambda_functions.ec2_client")
def test_describe_compute_types_client_error(mock_ec2):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the GetPaginator operation: Dummy error message.",
    )
    mock_ec2.get_paginator.side_effect = ClientError(error_msg, "GetPaginator")
    response = lambda_handler({}, mock_context)
    assert response == expected_response
