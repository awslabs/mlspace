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

import json
import logging
import urllib.parse

import boto3

from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    query_resource_metadata,
    retry_config,
)
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

translate = boto3.client("translate", config=retry_config)
s3 = boto3.client("s3", config=retry_config)
log = logging.getLogger(__name__)
resource_metadata_dao = ResourceMetadataDAO()
failed_job_statuses = ["FAILED", "COMPLETED_WITH_ERROR"]


@api_wrapper
def create(event, context):
    request = json.loads(event["body"])
    username = event["requestContext"]["authorizer"]["principalId"]
    project_name = request["ProjectName"]
    project_name_from_header = event["headers"]["x-mlspace-project"]
    if project_name_from_header != project_name:
        raise Exception(
            f"Project header, {project_name_from_header}, does not match the project name associated with the model, {project_name}."
        )

    param_file = pull_config_from_s3()
    env_variables = get_environment_variables()
    args = {}
    # Required args
    args["JobName"] = request["JobName"]
    args["InputDataConfig"] = request["InputDataConfig"]
    args["OutputDataConfig"] = {
        "S3Uri": request["OutputDataConfig"]["S3Uri"],
        "EncryptionKey": {"Type": "KMS", "Id": param_file["pSMSKMSKeyId"]},
    }
    args["DataAccessRoleArn"] = env_variables["TRANSLATE_DATE_ROLE_ARN"]
    args["SourceLanguageCode"] = request["SourceLanguageCode"]
    args["TargetLanguageCodes"] = request["TargetLanguageCodes"]
    # Optional args
    if request["TerminologyNames"]:
        # only one terminology name is supported for now, so put it into a list
        args["TerminologyNames"] = [request["TerminologyNames"]]
    args["Settings"] = {}
    if request["Settings"]["Formality"]:
        args["Settings"]["Formality"] = request["Settings"]["Formality"]
    if request["Settings"]["Profanity"]:
        args["Settings"]["Profanity"] = request["Settings"]["Profanity"]

    response = translate.start_text_translation_job(**args)
    # Usually we rely on event bridge notifications to create the initial resource metadata
    # record but due to the lack of tags/arns with translate jobs we do it here to ensure
    # we correctly attribute the user/project
    job_details = translate.describe_text_translation_job(JobId=response["JobId"])[
        "TextTranslationJobProperties"
    ]

    # Creates the initial resource metadata record
    resource_metadata_dao.upsert_record(
        job_details["JobId"],
        ResourceType.BATCH_TRANSLATE_JOB,
        username,
        project_name,
        {
            "JobName": job_details["JobName"],
            "JobStatus": job_details["JobStatus"],
            "SubmittedTime": job_details["SubmittedTime"],
            "SourceLanguageCode": job_details["SourceLanguageCode"],
            "TargetLanguageCodes": job_details["TargetLanguageCodes"],
        },
    )

    return response


@api_wrapper
def list(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.BATCH_TRANSLATE_JOB)


@api_wrapper
def describe(event, context):
    job_id = urllib.parse.unquote(event["pathParameters"]["jobId"])
    response = translate.describe_text_translation_job(JobId=job_id)
    job = response["TextTranslationJobProperties"]
    job_status = job["JobStatus"]

    if job_status in failed_job_statuses:
        try:
            metadata = resource_metadata_dao.get(id=job_id, type=ResourceType.BATCH_TRANSLATE_JOB)

            if "Error" not in metadata.metadata:
                # Iterate through each target language code as it's used to name the translation details file
                # and it's possible one target language had errors while the other did not
                for target_language_code in job["TargetLanguageCodes"]:
                    error_found = False
                    s3_uri = f"{job['OutputDataConfig']['S3Uri']}details/{target_language_code}.auxiliary-translation-details.json"
                    path_parts = s3_uri.replace("s3://", "").split("/")
                    bucket = path_parts.pop(0)
                    key = "/".join(path_parts)

                    content_object = s3.get_object(
                        Bucket=bucket,
                        Key=key,
                    )
                    file_content = content_object["Body"].read().decode("utf-8")
                    json_content = json.loads(file_content)

                    # Iterate through the details for each file and set the error data based on the first error found
                    for detail in json_content["details"]:
                        if "auxiliaryData" in detail and "error" in detail["auxiliaryData"]:
                            error_data = detail["auxiliaryData"]["error"]
                            metadata.metadata["Error"] = {}
                            if "errorCode" in error_data and "errorMessage" in error_data:
                                error_found = True
                                metadata.metadata["Error"]["ErrorCode"] = error_data["errorCode"]
                                metadata.metadata["Error"]["ErrorMessage"] = error_data[
                                    "errorMessage"
                                ]
                        if error_found:
                            break
                    if error_found:
                        metadata.metadata["Error"]["S3ErrorLocation"] = key
                        break
                resource_metadata_dao.update(
                    id=job_id, type=ResourceType.BATCH_TRANSLATE_JOB, metadata=metadata.metadata
                )

            response["TextTranslationJobProperties"]["Error"] = metadata.metadata["Error"]
        except Exception as e:
            # Don't fail the describe call just because we couldn't get an error reason
            log.error(f"An exception occurred while retrieving the job failure reason: {e}")

    return response


@api_wrapper
def stop(event, context):
    job_id = urllib.parse.unquote(event["pathParameters"]["jobId"])
    response = translate.stop_text_translation_job(JobId=job_id)
    return response
