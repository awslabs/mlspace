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

# Testing for the describe_text_translation_job Lambda function.
import datetime
import json
from io import BytesIO
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.batch_translate.lambda_functions import describe as lambda_handler

job_id = "example_job_id"
s3_bucket = "translate-testing-mlspace"
s3_key = "English"
s3_detail_file = "details/en.auxiliary-translation-details.json"
s3_output_location = f"s3://{s3_bucket}/{s3_key}/"

mock_event = {"pathParameters": {"jobId": job_id}}
mock_context = mock.Mock()
mock_error_metadata = {
    "Error": {
        "ErrorCode": "MockError",
        "ErrorMessage": "Mocking message",
        "S3ErrorLocation": f"{s3_key}/{s3_detail_file}",
    }
}


def generate_mock_response(include_error: bool = False):
    response = {
        "TextTranslationJobProperties": {
            "JobId": job_id,
            "JobName": "test_job_name",
            "JobStatus": "FAILED",
            "JobDetails": {
                "TranslatedDocumentsCount": 123,
                "DocumentsWithErrorsCount": 123,
                "InputDocumentsCount": 123,
            },
            "SourceLanguageCode": "es",
            "TargetLanguageCodes": [
                "en",
                "fr",
            ],
            "TerminologyNames": [
                "bob",
            ],
            "ParallelDataNames": [
                "",
            ],
            "Message": "Success!",
            "SubmittedTime": datetime.date.today(),
            "EndTime": datetime.date.today(),
            "InputDataConfig": {
                "S3Uri": "s3://translate-testing-mlspace/Spanish/",
                "ContentType": "text/plain",
            },
            "OutputDataConfig": {
                "S3Uri": s3_output_location,
                "EncryptionKey": {"Type": "KMS", "Id": "some_key"},
            },
            "DataAccessRoleArn": "some_role",
            "Settings": {"Formality": "", "Profanity": ""},
        }
    }
    if include_error:
        response["TextTranslationJobProperties"]["Error"] = mock_error_metadata["Error"]
    return response


def generate_mock_metadata_model(has_error_metadata: bool):
    return ResourceMetadataModel(
        job_id,
        ResourceType.BATCH_TRANSLATE_JOB,
        "mock_user",
        "mock_project",
        mock_error_metadata if has_error_metadata else {},
    )


mock_s3_translate_detail_file = {
    "details": [
        {
            "sourceFile": "english_test_doc.txt",
            "auxiliaryData": {
                "error": {"errorCode": "MockError", "errorMessage": "Mocking message"}
            },
        }
    ]
}

mock_s3_get_object_response = {
    "Body": BytesIO(bytes(json.dumps(mock_s3_translate_detail_file), "utf-8"))
}


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
def test_describe_batch_translate_job_success_error_in_metadata(
    mock_translate, mock_resource_metadata_dao
):
    mock_translate.describe_text_translation_job.return_value = generate_mock_response()
    mock_resource_metadata_dao.get.return_value = generate_mock_metadata_model(True)

    expected_response = generate_html_response(200, generate_mock_response(True))

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_translate.describe_text_translation_job.assert_called_with(JobId=job_id)
    mock_resource_metadata_dao.get.assert_called_with(
        id=job_id, type=ResourceType.BATCH_TRANSLATE_JOB
    )
    mock_resource_metadata_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.s3")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
def test_describe_batch_translate_job_success_error_not_in_metadata(
    mock_translate, mock_resource_metadata_dao, mock_s3
):
    mock_translate.describe_text_translation_job.return_value = generate_mock_response()
    mock_resource_metadata_dao.get.return_value = generate_mock_metadata_model(False)
    mock_resource_metadata_dao.update.return_value = None
    mock_s3.get_object.return_value = mock_s3_get_object_response

    expected_response = generate_html_response(200, generate_mock_response(True))

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_translate.describe_text_translation_job.assert_called_with(JobId=job_id)
    mock_resource_metadata_dao.get.assert_called_with(
        id=job_id, type=ResourceType.BATCH_TRANSLATE_JOB
    )
    mock_resource_metadata_dao.update.assert_called_with(
        id=job_id,
        type=ResourceType.BATCH_TRANSLATE_JOB,
        metadata=generate_mock_metadata_model(True).metadata,
    )
    mock_s3.get_object.assert_called_with(Bucket=s3_bucket, Key=f"{s3_key}/{s3_detail_file}")


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.s3")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
def test_describe_batch_translate_job_success_error_not_in_metadata_client_error(
    mock_translate, mock_resource_metadata_dao, mock_s3
):
    error_msg = {
        "Error": {"Code": "ResourceNotFoundException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_translate.describe_text_translation_job.return_value = generate_mock_response()
    mock_resource_metadata_dao.get.return_value = generate_mock_metadata_model(False)
    mock_resource_metadata_dao.update.return_value = None
    mock_s3.get_object.side_effect = ClientError(error_msg, "S3GetObject")

    expected_response = generate_html_response(200, generate_mock_response(False))

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_translate.describe_text_translation_job.assert_called_with(JobId=job_id)
    mock_resource_metadata_dao.get.assert_called_with(
        id=job_id, type=ResourceType.BATCH_TRANSLATE_JOB
    )
    mock_resource_metadata_dao.update.assert_not_called()
    mock_s3.get_object.assert_called_with(Bucket=s3_bucket, Key=f"{s3_key}/{s3_detail_file}")


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
def test_describe_batch_translate_job_client_error(mock_translate):
    error_msg = {
        "Error": {"Code": "ResourceNotFoundException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ResourceNotFoundException) when calling the DescribeTextTranslationJob operation: Dummy error message.",
    )

    mock_translate.describe_text_translation_job.side_effect = ClientError(
        error_msg, "DescribeTextTranslationJob"
    )

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_translate.describe_text_translation_job.assert_called_with(JobId=job_id)


@mock.patch("ml_space_lambda.batch_translate.lambda_functions.translate")
def test_describe_batch_training_job_missing_parameters(mock_translate):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_translate.describe_text_translation_job.assert_not_called()
