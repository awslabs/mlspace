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

import copy

# Testing for the start_text_translation_job Lambda function.
import json
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.batch_translate.lambda_functions import create as lambda_handler

job_id = "example_job_id"
mock_project_name = "TestProject"

mock_body = {
    "JobName": "testjob",
    "ProjectName": mock_project_name,
    "InputDataConfig": {
        "S3Uri": "s3://translate-testing-mlspace/English/",
        "ContentType": "text/plain",
    },
    "OutputDataConfig": {
        "S3Uri": "s3://translate-testing-mlspace/French/",
        "EncryptionKey": {"Type": "", "Id": ""},
    },
    "SourceLanguageCode": "en",
    "TargetLanguageCodes": ["fr"],
    "TerminologyNames": "",
    "Settings": {
        "Formality": "",
        "Profanity": "",
    },
}


mock_context = mock.Mock()

mock_response = {"JobId": job_id, "JobStatus": "SUBMITTED"}
mock_describe_response = {
    "TextTranslationJobProperties": {
        "JobId": job_id,
        "JobName": "UnitTestJob",
        "JobStatus": "SUBMITTED",
        "SubmittedTime": "2023-08-11 09:33:05.109000+00:00",
        "SourceLanguageCode": "en",
        "TargetLanguageCodes": ["fr"],
        "TerminologyNames": "",
        "Settings": {
            "Formality": "",
            "Profanity": "",
        },
        "InputDataConfig": {
            "S3Uri": "s3://translate-testing-mlspace/English/",
            "ContentType": "text/plain",
        },
        "OutputDataConfig": {
            "S3Uri": "s3://translate-testing-mlspace/French/",
            "EncryptionKey": {"Type": "", "Id": ""},
        },
    }
}

mock_username = "some_username"


def create_mock_event(mock_body):
    return {
        "body": json.dumps(mock_body),
        "requestContext": {"authorizer": {"principalId": mock_username}},
        "headers": {"x-mlspace-project": mock_project_name},
    }


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
def test_create_batch_translate_job_success(mock_resource_metadata_dao, mock_translate, mock_pull_config, mock_s3_param_json):
    mock_translate.start_text_translation_job.return_value = mock_response
    mock_translate.describe_text_translation_job.return_value = mock_describe_response
    mock_pull_config.return_value = mock_s3_param_json

    mock_body_with_optionals = copy.deepcopy(mock_body)
    mock_body_with_optionals["TerminologyNames"] = "TestProject-CustomTerminologyTest"
    mock_body_with_optionals["Settings"] = {"Formality": "FORMAL", "Profanity": "MASK"}

    expected_response = generate_html_response(200, mock_response)
    expected_call = {
        "JobName": mock_body_with_optionals["JobName"],
        "InputDataConfig": mock_body_with_optionals["InputDataConfig"],
        "OutputDataConfig": {
            "S3Uri": mock_body_with_optionals["OutputDataConfig"]["S3Uri"],
            "EncryptionKey": {"Type": "KMS", "Id": "example_key_id"},
        },
        "DataAccessRoleArn": "",
        "SourceLanguageCode": "en",
        "TargetLanguageCodes": ["fr"],
        "TerminologyNames": [mock_body_with_optionals["TerminologyNames"]],
        "Settings": {
            "Formality": mock_body_with_optionals["Settings"]["Formality"],
            "Profanity": mock_body_with_optionals["Settings"]["Profanity"],
        },
    }

    assert lambda_handler(create_mock_event(mock_body_with_optionals), mock_context) == expected_response

    mock_translate.start_text_translation_job.assert_called_with(**expected_call)
    mock_translate.describe_text_translation_job.assert_called_with(JobId=job_id)
    mock_resource_metadata_dao.upsert_record.assert_called_with(
        job_id,
        ResourceType.BATCH_TRANSLATE_JOB,
        mock_username,
        mock_project_name,
        {
            "JobName": mock_describe_response["TextTranslationJobProperties"]["JobName"],
            "JobStatus": mock_describe_response["TextTranslationJobProperties"]["JobStatus"],
            "SubmittedTime": mock_describe_response["TextTranslationJobProperties"]["SubmittedTime"],
            "SourceLanguageCode": mock_describe_response["TextTranslationJobProperties"]["SourceLanguageCode"],
            "TargetLanguageCodes": mock_describe_response["TextTranslationJobProperties"]["TargetLanguageCodes"],
        },
    )


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
def test_create_batch_translate_job_no_optional_fields_success(
    mock_resource_metadata_dao, mock_translate, mock_pull_config, mock_s3_param_json
):
    mock_translate.start_text_translation_job.return_value = mock_response
    mock_translate.describe_text_translation_job.return_value = mock_describe_response
    mock_pull_config.return_value = mock_s3_param_json

    expected_response = generate_html_response(200, mock_response)
    expected_call = {
        "JobName": mock_body["JobName"],
        "InputDataConfig": mock_body["InputDataConfig"],
        "OutputDataConfig": {
            "S3Uri": mock_body["OutputDataConfig"]["S3Uri"],
            "EncryptionKey": {"Type": "KMS", "Id": "example_key_id"},
        },
        "DataAccessRoleArn": "",
        "SourceLanguageCode": "en",
        "TargetLanguageCodes": ["fr"],
        "Settings": {},
    }

    assert lambda_handler(create_mock_event(mock_body), mock_context) == expected_response

    mock_translate.start_text_translation_job.assert_called_with(**expected_call)
    mock_translate.describe_text_translation_job.assert_called_with(JobId=job_id)
    mock_resource_metadata_dao.upsert_record.assert_called_with(
        job_id,
        ResourceType.BATCH_TRANSLATE_JOB,
        mock_username,
        mock_project_name,
        {
            "JobName": mock_describe_response["TextTranslationJobProperties"]["JobName"],
            "JobStatus": mock_describe_response["TextTranslationJobProperties"]["JobStatus"],
            "SubmittedTime": mock_describe_response["TextTranslationJobProperties"]["SubmittedTime"],
            "SourceLanguageCode": mock_describe_response["TextTranslationJobProperties"]["SourceLanguageCode"],
            "TargetLanguageCodes": mock_describe_response["TextTranslationJobProperties"]["TargetLanguageCodes"],
        },
    )


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
def test_create_batch_translate_job_client_error(
    mock_resource_metadata_dao, mock_translate, mock_pull_config, mock_s3_param_json
):
    mock_pull_config.return_value = mock_s3_param_json
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (MissingParameter) when calling the startTextTranslationJob operation: Dummy error message.",
    )

    mock_translate.start_text_translation_job.side_effect = ClientError(error_msg, "startTextTranslationJob")

    assert lambda_handler(create_mock_event(mock_body), mock_context) == expected_response

    mock_translate.describe_text_translation_job.assert_not_called()
    mock_resource_metadata_dao.upsert_record.assert_not_called()


def test_create_batch_translate_mismatched_project_name_error():
    mock_fake_project_name = "fraudulent-project"
    expected_response = generate_html_response(
        400,
        f"Bad Request: Project header, {mock_fake_project_name}, does not match the project name associated with the model, {mock_project_name}.",
    )

    wrong_project_name_event = {
        "body": json.dumps(mock_body),
        "requestContext": {"authorizer": {"principalId": mock_username}},
        "headers": {"x-mlspace-project": mock_fake_project_name},
    }

    assert lambda_handler(wrong_project_name_event, mock_context) == expected_response
