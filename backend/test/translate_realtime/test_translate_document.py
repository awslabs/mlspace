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
# Document Text: "Could you help me out for a minute?"
# This models the expected Uint8Array input
mock_base_event_body = {
    "Document": {
        "Content": [
            67,
            111,
            117,
            108,
            100,
            32,
            121,
            111,
            117,
            32,
            104,
            101,
            108,
            112,
            32,
            109,
            101,
            32,
            111,
            117,
            116,
            32,
            102,
            111,
            114,
            32,
            97,
            32,
            109,
            105,
            110,
            117,
            116,
            101,
            63,
            10,
        ],
        "ContentType": "text/plain",
    },
    "SourceLanguageCode": "auto",
    "TargetLanguageCode": "de",
    "TerminologyNames": ["example_terminology_name"],
    "Settings": {"Formality": "FORMAL", "Profanity": "MASK"},
}

called_with_args = copy.deepcopy(mock_base_event_body)
called_with_args["Document"]["Content"] = bytes(bytearray(called_with_args["Document"]["Content"]))


mock_boto_response = {
    "TranslatedDocument": {
        "Content": b"K\xc3\xb6nnten Sie mir f\xc3\xbcr eine Minute weiterhelfen?",
    },
    "SourceLanguageCode": "en",
    "TargetLanguageCode": "de",
    "AppliedSettings": {"Formality": "FORMAL", "Profanity": "MASK"},
}

mock_api_response = copy.deepcopy(mock_boto_response)
mock_api_response["TranslatedDocument"]["Content"] = [
    75,
    195,
    182,
    110,
    110,
    116,
    101,
    110,
    32,
    83,
    105,
    101,
    32,
    109,
    105,
    114,
    32,
    102,
    195,
    188,
    114,
    32,
    101,
    105,
    110,
    101,
    32,
    77,
    105,
    110,
    117,
    116,
    101,
    32,
    119,
    101,
    105,
    116,
    101,
    114,
    104,
    101,
    108,
    102,
    101,
    110,
    63,
]

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.translate_realtime.lambda_functions import translate_document as lambda_handler

mock_base_event = {
    "body": json.dumps(mock_base_event_body),
    "requestContext": {"authorizer": {"principalId": TEST_USER_NAME}},
}
mock_context = mock.Mock()


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.translate_realtime.lambda_functions.translate")
def test_translate_document_job_success(mock_translate):
    mock_translate.translate_document.return_value = mock_boto_response
    expected_response = generate_html_response(200, mock_api_response)

    assert lambda_handler(mock_base_event, mock_context) == expected_response

    mock_translate.translate_document.assert_called_with(**called_with_args)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.translate_realtime.lambda_functions.translate")
def test_translate_document_job_value_error(mock_translate):
    expected_response = generate_html_response(
        400,
        "Bad Request: byte must be in range(0, 256)",
    )

    invalidated_event_body = copy.deepcopy(mock_base_event_body)
    invalidated_event_body["Document"]["Content"] = [300, 10, 400, -25]
    mock_event = copy.deepcopy(mock_base_event)
    mock_event["body"] = json.dumps(invalidated_event_body)

    assert lambda_handler(mock_event, mock_context) == expected_response


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.translate_realtime.lambda_functions.translate")
def test_translate_text_job_fail_missing_param(mock_translate):
    expected_response = generate_html_response(
        400,
        "Bad Request: 'Document'",
    )

    bad_event_body = {
        "SourceLanguageCode": "auto",
        "TargetLanguageCode": "de",
    }
    mock_event = copy.deepcopy(mock_base_event)
    mock_event["body"] = json.dumps(bad_event_body)

    assert lambda_handler(mock_event, mock_context) == expected_response
