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

# Testing for the list_terminologies Lambda function.
import copy
import datetime
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}
mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.custom_terminology.lambda_functions import list as lambda_handler

FAKE_NEXT_TOKEN = "Fake-Next-Page-Marker"

list_terminologies_response = {
    "TerminologyPropertiesList": [
        {
            "Name": "term_name",
            "Description": "some terminology",
            "Arn": "arn:term",
            "SourceLanguageCode": "en",
            "TargetLanguageCodes": [
                "en,fr,es",
            ],
            "EncryptionKey": {"Type": "KMS", "Id": "123abc"},
            "SizeBytes": 123,
            "TermCount": 123,
            "CreatedAt": datetime.date.today(),
            "LastUpdatedAt": datetime.date.today(),
            "Directionality": "UNI",
            "Message": "hello world!",
            "SkippedTermCount": 123,
            "Format": "CSV",
        },
    ],
    "NextToken": "123abc",
}

mock_event = {
    "queryStringParameters": {
        "nextToken": FAKE_NEXT_TOKEN,
        "pageSize": "10",
    },
}


@mock.patch("ml_space_lambda.custom_terminology.lambda_functions.translate")
def test_list_terminologies_success(mock_translate):
    mock_translate.list_terminologies.return_value = list_terminologies_response
    expected_response = generate_html_response(
        200,
        {
            "records": [list_terminologies_response["TerminologyPropertiesList"][0]],
            "nextToken": list_terminologies_response["NextToken"],
        },
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    test_kwargs = {
        "NextToken": mock_event["queryStringParameters"]["nextToken"],
        "MaxResults": mock_event["queryStringParameters"]["pageSize"],
    }
    mock_translate.list_terminologies.assert_called_with(**test_kwargs)


@mock.patch("ml_space_lambda.custom_terminology.lambda_functions.translate")
def test_list_terminologies_success_no_optionals(mock_translate):
    response_no_next_token = copy.deepcopy(list_terminologies_response)
    response_no_next_token.pop("NextToken")
    mock_translate.list_terminologies.return_value = response_no_next_token
    expected_response = generate_html_response(
        200,
        {"records": [response_no_next_token["TerminologyPropertiesList"][0]]},
    )

    mock_event_no_optionals = {
        "queryStringParameters": {"madeUpParameter": "test"},
    }

    assert lambda_handler(mock_event_no_optionals, mock_context) == expected_response
    mock_translate.list_terminologies.assert_called_with()

    mock_event_no_query_string = {}

    assert lambda_handler(mock_event_no_query_string, mock_context) == expected_response
    mock_translate.list_terminologies.assert_called_with()


@mock.patch("ml_space_lambda.custom_terminology.lambda_functions.translate")
def test_list_terminologies_client_error(mock_translate):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }

    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the ListTerminologies operation: Dummy error message.",
    )

    mock_translate.list_terminologies.side_effect = ClientError(error_msg, "ListTerminologies")
    assert lambda_handler(mock_event, mock_context) == expected_response
