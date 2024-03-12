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

# Testing for the describe_labeling_job Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "MANAGE_IAM_ROLES": "true",
    "SYSTEM_TAG": "mlspace",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.labeling_job.lambda_functions import list_workteams

labeling_job_name = "example_labeling_job_name"

mock_event = {"pathParameters": {"jobName": f"{labeling_job_name}"}}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.labeling_job.lambda_functions.sagemaker")
def test_list_workteams_happy(
    mock_sagemaker,
):
    mock_response = {
        "Workteams": [
            {"WorkteamName": "A", "WorkteamArn": "arnA"},
            {"WorkteamName": "B", "WorkteamArn": "arnB"},
        ]
    }

    mock_sagemaker.list_workteams.return_value = mock_response
    expected_response = generate_html_response(200, mock_response["Workteams"])
    assert list_workteams({}, mock_context) == expected_response


@mock.patch("ml_space_lambda.labeling_job.lambda_functions.sagemaker")
def test_list_workteams_fail(
    mock_sagemaker,
):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the ListWorkteams operation: Dummy error message.",
    )
    mock_sagemaker.list_workteams.side_effect = ClientError(error_msg, "ListWorkteams")
    assert list_workteams({}, mock_context) == expected_response
