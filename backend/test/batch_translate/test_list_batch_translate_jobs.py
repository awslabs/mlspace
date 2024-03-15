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

# Testing for the list_text_translation_jobs Lambda function.
from typing import Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}
mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.batch_translate.lambda_functions import list as lambda_handler

MOCK_PROJECT_NAME = "mock_project1"
MOCK_USERNAME = "jdoe@amazon.com"
FAKE_NEXT_TOKEN = "Fake-Next-Page-Marker"


def _mock_job_metadata(identifier: str, username: Optional[str] = MOCK_USERNAME) -> ResourceMetadataModel:
    return ResourceMetadataModel(
        identifier,
        ResourceType.BATCH_TRANSLATE_JOB,
        username,
        MOCK_PROJECT_NAME,
        {
            "JobName": f"batch-translate-{identifier}",
            "JobStatus": "SUBMITTED",
            "SubmittedTime": "2023-08-11 09:33:05.109000+00:00",
            "SourceLanguageCode": "en",
            "TargetLanguageCodes": ["fr"],
        },
    )


list_batch_translate_response = {
    "TextTranslationJobPropertiesList": [
        {
            "JobId": "123abc",
            "JobName": MOCK_PROJECT_NAME + "-test_job_name",
            "JobStatus": "COMPLETED",
        }
    ],
    "NextToken": "123abc",
}


mock_event = {
    "pathParameters": {"projectName": MOCK_PROJECT_NAME},
    "queryStringParameters": {
        "nextToken": FAKE_NEXT_TOKEN,
        "pageSize": "10",
    },
}


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
def test_list_text_translation_jobs_success(mock_resource_metadata_dao):
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults(
        [
            _mock_job_metadata("job1"),
            _mock_job_metadata("job2"),
        ],
        "anotherToken",
    )

    expected_response = generate_html_response(
        200,
        {
            "records": [
                _mock_job_metadata("job1").to_dict(),
                _mock_job_metadata("job2").to_dict(),
            ],
            "nextToken": "anotherToken",
        },
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.BATCH_TRANSLATE_JOB, limit=10, next_token=FAKE_NEXT_TOKEN
    )


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
def test_list_text_translation_jobs_client_error(mock_resource_metadata_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    exception_response = ClientError(error_msg, "Query")
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = exception_response
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the Query operation: Dummy error message.",
    )

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.BATCH_TRANSLATE_JOB, limit=10, next_token=FAKE_NEXT_TOKEN
    )


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
def test_list_text_translation_jobs_generic_error(mock_resource_metadata_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_not_called()
