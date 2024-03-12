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

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.metadata.lambda_functions import list_languages as lambda_handler

mock_context = mock.Mock()
mock_response = {
    "Languages": [
        {"LanguageName": "English", "LanguageCode": "en"},
        {"LanguageName": "Spanish", "LanguageCode": "es"},
    ],
    "DisplayLanguageCode": "en",
}


@mock.patch("ml_space_lambda.metadata.lambda_functions.translate_client")
def test_list_languages_success(mock_translate):
    result = mock_response["Languages"]
    expected_response = generate_html_response(200, result)
    mock_translate.list_languages.return_value = mock_response
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_translate.list_languages.assert_called()


@mock.patch(
    "ml_space_lambda.metadata.lambda_functions.cached_response_translate_languages",
    mock_response["Languages"],
)
@mock.patch("ml_space_lambda.metadata.lambda_functions.translate_client")
def test_list_languages_cached(mock_translate):
    result = mock_response["Languages"]
    expected_response = generate_html_response(200, result)
    mock_translate.list_languages.return_value = mock_response
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_translate.list_languages.assert_not_called()


@mock.patch("ml_space_lambda.metadata.lambda_functions.cached_response_translate_languages", [])
@mock.patch("ml_space_lambda.metadata.lambda_functions.translate_client")
def test_list_languages_client_error(mock_translate):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the ListLanguages operation: Dummy error message.",
    )
    mock_translate.list_languages.side_effect = ClientError(error_msg, "ListLanguages")
    response = lambda_handler({}, mock_context)
    assert response == expected_response
