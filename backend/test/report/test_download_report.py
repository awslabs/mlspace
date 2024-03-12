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

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
mock_context = mock.Mock()

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.report.lambda_functions import download


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.report.lambda_functions.s3")
def test_download_sms_report_success(mock_s3):
    mock_event = {"pathParameters": {"reportName": "example_report"}}
    expected_response = generate_html_response(
        200, "https://s3.us-east-1.amazonaws.com/example_bucket/sms-report/example_report?"
    )

    mock_s3.generate_presigned_url.return_value = (
        "https://s3.us-east-1.amazonaws.com/example_bucket/sms-report/example_report?"
    )
    assert download(mock_event, mock_context) == expected_response

    mock_s3.generate_presigned_url.assert_called_with(
        ClientMethod="get_object",
        Params={"Bucket": "mlspace-data-bucket", "Key": "mlspace-report/example_report"},
        ExpiresIn=120,
    )


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.report.lambda_functions.s3")
def test_download_sms_report_client_error(mock_s3):
    mock_event = {"pathParameters": {"reportName": "example_report"}}

    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the GeneratePresignedUrl operation: Dummy error message.",
    )

    mock_s3.generate_presigned_url.side_effect = ClientError(error_msg, "GeneratePresignedUrl")

    assert download(mock_event, mock_context) == expected_response

    mock_s3.generate_presigned_url.assert_called_with(
        ClientMethod="get_object",
        Params={"Bucket": "mlspace-data-bucket", "Key": "mlspace-report/example_report"},
        ExpiresIn=120,
    )


def test_download_sms_report_generic_error():
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert download({}, mock_context) == expected_response
