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

# Testing for the create_transform_job Lambda function.
import copy
import json
from unittest import mock

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}

TEST_USER_NAME = "jdoe@amazon.com"

# Formality test - Formal vs informal German check: Could you help me out for a minute?
mock_base_event_body = {
    "Text": "Could you help me out for a minute?",
    "SourceLanguageCode": "auto",
    "TargetLanguageCode": "de",
}

mock_response = {
    "TranslatedText": "Könnten Sie mir für eine Minute weiterhelfen?",
    "SourceLanguageCode": "en",
    "TargetLanguageCode": "de",
    "AppliedSettings": {"Formality": "FORMAL", "Profanity": "MASK"},
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.translate_realtime.lambda_functions import translate_text as lambda_handler

mock_base_event = {
    "body": json.dumps(mock_base_event_body),
    "requestContext": {"authorizer": {"principalId": TEST_USER_NAME}},
}
mock_context = mock.Mock()


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.translate_realtime.lambda_functions.translate")
def test_translate_text_job_success_full_body(mock_translate):
    mock_translate.translate_text.return_value = mock_response
    expected_response = generate_html_response(200, mock_response)

    full_event_body = copy.deepcopy(mock_base_event_body)
    full_event_body["TerminologyNames"] = ["example_terminology_name"]
    full_event_body["Settings"] = {"Formality": "FORMAL", "Profanity": "MASK"}
    mock_event = copy.deepcopy(mock_base_event)
    mock_event["body"] = json.dumps(full_event_body)

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_translate.translate_text.assert_called_with(**full_event_body)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.translate_realtime.lambda_functions.translate")
def test_translate_text_job_success_base_body(mock_translate):
    mock_translate.translate_text.return_value = mock_response
    expected_response = generate_html_response(200, mock_response)

    assert lambda_handler(mock_base_event, mock_context) == expected_response

    mock_translate.translate_text.assert_called_with(**mock_base_event_body)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.translate_realtime.lambda_functions.translate")
def test_translate_text_job_fail_missing_param(mock_translate):
    mock_translate.translate_text.return_value = mock_response
    expected_response = generate_html_response(
        400,
        "Bad Request: 'Text'",
    )

    bad_event_body = {
        "SourceLanguageCode": "auto",
        "TargetLanguageCode": "de",
    }
    mock_event = copy.deepcopy(mock_base_event)
    mock_event["body"] = json.dumps(bad_event_body)

    assert lambda_handler(mock_event, mock_context) == expected_response
