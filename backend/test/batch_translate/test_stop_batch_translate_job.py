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

# Testing for the stop_text_translation_job Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.batch_translate.lambda_functions import stop as lambda_handler

job_id = "example_job_id"

mock_event = {"pathParameters": {"jobId": job_id}}
mock_context = mock.Mock()

mock_response = {
    "JobId": job_id,
    "JobStatus": "STOPPING",
}


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
def test_stop_batch_translate_job_success(mock_translate):
    mock_translate.stop_text_translation_job.return_value = mock_response

    expected_response = generate_html_response(200, mock_response)

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_translate.stop_text_translation_job.assert_called_with(JobId=job_id)


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
def test_stop_batch_translate_job_client_error(mock_translate):
    error_msg = {
        "Error": {"Code": "ResourceNotFoundException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ResourceNotFoundException) when calling the stopTextTranslationJob operation: Dummy error message.",
    )

    mock_translate.stop_text_translation_job.side_effect = ClientError(error_msg, "stopTextTranslationJob")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_translate.stop_text_translation_job.assert_called_with(JobId=job_id)


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
def test_stop_batch_training_job_missing_parameters(mock_translate):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_translate.stop_text_translation_job.assert_not_called()
