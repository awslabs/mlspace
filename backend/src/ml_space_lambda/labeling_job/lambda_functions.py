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
import os

import boto3
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import EnvVariable, ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper, generate_tags, query_resource_metadata, retry_config
from ml_space_lambda.utils.groundtruth_utils import (
    LambdaTypes,
    TaskTypes,
    generate_custom_ui_template,
    generate_labels_configuration_file,
    generate_ui_template,
    get_auto_labeling_arn,
    get_groundtruth_lambda_arn,
)
from ml_space_lambda.utils.mlspace_config import get_environment_variables, pull_config_from_s3

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)
resource_metadata_dao = ResourceMetadataDAO()
project_user_dao = ProjectUserDAO()


@api_wrapper
def describe(event, context):
    labeling_job_name = event["pathParameters"]["jobName"]
    return sagemaker.describe_labeling_job(LabelingJobName=labeling_job_name)


@api_wrapper
def list_resources(event, context):
    return query_resource_metadata(resource_metadata_dao, event, ResourceType.LABELING_JOB)


@api_wrapper
def list_workteams(event, context):
    # We don't have to worry about pagination due to the limit of workteams that can exist in an account & region
    #
    # You cannot create more than 25 work teams in an account and region.
    # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sagemaker/client/create_workteam.html
    result = sagemaker.list_workteams(SortBy="Name", SortOrder="Ascending", MaxResults=100)

    return list(
        map(
            lambda team: {"WorkteamName": team["WorkteamName"], "WorkteamArn": team["WorkteamArn"]},
            result["Workteams"],
        )
    )


@api_wrapper
def create(event, context):
    labeling_job_request = json.loads(event["body"])
    username = event["requestContext"]["authorizer"]["principalId"]
    project_name = event["headers"]["x-mlspace-project"]
    param_file = pull_config_from_s3()
    env_variables = get_environment_variables()
    data_bucket_name = param_file["pSMSDataBucketName"]
    task_type = TaskTypes[labeling_job_request["TaskType"]]
    labeling_job: dict = labeling_job_request["JobDefinition"]
    description = labeling_job["HumanTaskConfig"]["TaskDescription"]
    full_instructions = labeling_job_request["FullInstruction"]
    short_instructions = labeling_job_request["ShortInstruction"]
    labeling_job_name = labeling_job["LabelingJobName"]
    labeling_job["LabelingJobName"] = labeling_job_name

    #  Check to see if InputLabelAttributeName was included in the request.
    label_attr = labeling_job.pop(
        "InputLabelAttributeName", None
    )  # pop removes it from the dict, needed for clean sagemaker api call
    if task_type == TaskTypes.VerificationBoundingBox or task_type == TaskTypes.VerificationSemanticSegmentation:
        logger.info("Verification job - Locating LabelAttributeName for the input manifest")

        # If the label_attr was found, dont search the manifest file
        if label_attr and label_attr != "":
            logger.info(f"Found InputLabelAttributeName in request: {label_attr}")

        else:  # If not provided, look in the manfiest file

            logger.warning(f"No InputLabelAttributeName found in request event.  Searching input manifest")

            # Pull the input manifest file
            manifest_s3_uri = labeling_job["InputConfig"]["DataSource"]["S3DataSource"]["ManifestS3Uri"]

            # Parse S3 URI
            s3_uri_parts = manifest_s3_uri.replace("s3://", "").split("/", 1)
            bucket = s3_uri_parts[0]
            key = s3_uri_parts[1]

            # Read first line from S3 manifest file
            s3_client = boto3.client("s3", config=retry_config)
            logger.info("Reading manifest file from S3...")

            try:
                response = s3_client.get_object(Bucket=bucket, Key=key)
                first_line = response["Body"].read().decode("utf-8").split("\n")[0]

                # Parse JSON and get the second key
                manifest_entry = json.loads(first_line)

            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "Unknown")
                logger.error(f"S3 error reading manifest file {manifest_s3_uri}: {error_code} - {e}")
                raise ValueError(f"Could not read manifest file from {manifest_s3_uri}. Error: {error_code}")

            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in manifest file {manifest_s3_uri}: {e}")
                raise ValueError(f"Manifest file contains invalid JSON at {manifest_s3_uri}: {str(e)}")

            except Exception as e:
                logger.error(f"Unexpected error reading manifest file {manifest_s3_uri}: {e}")
                raise ValueError(f"Failed to process manifest file from {manifest_s3_uri}: {str(e)}")
            keys = list(manifest_entry.keys())

            # Check the 2nd item in the keys, this should be the LabelAttributeName
            if len(keys) >= 2:
                label_attr = keys[1]
                logger.info(f"Extracted LabelAttributeName: {label_attr}")
            else:
                label_attr = None
                logger.warning(f"Manifest entry has fewer than 2 keys. Keys: {keys}")

        if not label_attr or not label_attr.strip():
            logger.error("The input manifest's LabelAttributeName is missing or empty for VerificationBoundingBox job")
            raise ValueError("The input manifest's LabelAttributeName is required for VerificationBoundingBox jobs")

        logger.info(f"Successfully found the LabelAttributeName for the input manifest: {label_attr}")

    # Generate labels config file and store in S3 bucket
    stripped_protocol_output_path = labeling_job["OutputConfig"]["S3OutputPath"].removeprefix("s3://")
    stripped_bucket_output_path = os.path.join(*stripped_protocol_output_path.split("/")[1:])
    output_path = os.path.normpath(stripped_bucket_output_path)
    labeling_job["LabelCategoryConfigS3Uri"] = generate_labels_configuration_file(
        labeling_job_request["Labels"], labeling_job_name, data_bucket_name, output_path
    )

    labeling_job["RoleArn"] = param_file["pSMSRoleARN"]
    if env_variables[EnvVariable.MANAGE_IAM_ROLES]:
        project_user = project_user_dao.get(project_name, username)
        labeling_job["RoleArn"] = project_user.role

    labeling_job["HumanTaskConfig"]["PreHumanTaskLambdaArn"] = get_groundtruth_lambda_arn(LambdaTypes.PRE, task_type)

    labeling_job["HumanTaskConfig"]["AnnotationConsolidationConfig"]["AnnotationConsolidationLambdaArn"] = (
        get_groundtruth_lambda_arn(LambdaTypes.ACS, task_type)
    )

    # Check for custom labeling job fields
    custom_labeling_job_fields = labeling_job_request.get("CustomLabelingJobVars")

    if custom_labeling_job_fields and task_type == TaskTypes.PassThrough:

        custom_template_html = custom_labeling_job_fields.get("CustomTaskTemplate", "")

        if custom_template_html == "":
            raise Exception("CustomTaskTemplate is required for Custom task type")

        logger.info("PassThrough task type, using custom UI template")
        # Use custom template
        template_uri = generate_custom_ui_template(
            custom_template_html,
            labeling_job_name,
            description,
            full_instructions,
            short_instructions,
            data_bucket_name,
            output_path,
            label_attr,
        )
    else:
        # Use standard template based on task type
        template_uri = generate_ui_template(
            labeling_job_name,
            task_type,
            description,
            full_instructions,
            short_instructions,
            data_bucket_name,
            output_path,
            label_attr,
        )

    if template_uri is not None:
        labeling_job["HumanTaskConfig"]["UiConfig"]["UiTemplateS3Uri"] = template_uri
    else:
        raise Exception("Unable to create task template")

    if "LabelingJobAlgorithmsConfig" in labeling_job:
        labeling_job["LabelingJobAlgorithmsConfig"]["LabelingJobAlgorithmSpecificationArn"] = get_auto_labeling_arn(task_type)
        labeling_job["LabelingJobAlgorithmsConfig"]["LabelingJobResourceConfig"]["VpcConfig"]["SecurityGroupIds"] = param_file[
            "pSMSSecurityGroupId"
        ]
        labeling_job["LabelingJobAlgorithmsConfig"]["LabelingJobResourceConfig"]["VpcConfig"]["Subnets"] = [
            param_file["pSMSSubnetIds"].split(",")[0]
        ]

    labeling_job["Tags"] = generate_tags(username, project_name, env_variables[EnvVariable.SYSTEM_TAG])

    response = sagemaker.create_labeling_job(**labeling_job)

    # Create the record in the resource_metadata table
    resource_metadata_dao.upsert_record(labeling_job_name, ResourceType.LABELING_JOB, username, project_name, {})

    return response
