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

import boto3

from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper, generate_tags, query_resource_metadata, retry_config
from ml_space_lambda.utils.groundtruth_utils import (
    LambdaTypes,
    TaskTypes,
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
    labeling_job = labeling_job_request["JobDefinition"]
    description = labeling_job["HumanTaskConfig"]["TaskDescription"]
    full_instructions = labeling_job_request["FullInstruction"]
    short_instructions = labeling_job_request["ShortInstruction"]
    labeling_job_name = labeling_job["LabelingJobName"]
    labeling_job["LabelingJobName"] = labeling_job_name

    # Generate labels config file and store in S3 bucket
    output_path = labeling_job["OutputConfig"]["S3OutputPath"].replace("s3://{}/".format(data_bucket_name), "")
    labeling_job["LabelCategoryConfigS3Uri"] = generate_labels_configuration_file(
        labeling_job_request["Labels"], labeling_job_name, data_bucket_name, output_path
    )

    labeling_job["RoleArn"] = param_file["pSMSRoleARN"]
    if env_variables["MANAGE_IAM_ROLES"]:
        project_user = project_user_dao.get(project_name, username)
        labeling_job["RoleArn"] = project_user.role

    labeling_job["HumanTaskConfig"]["PreHumanTaskLambdaArn"] = get_groundtruth_lambda_arn(LambdaTypes.PRE, task_type)

    labeling_job["HumanTaskConfig"]["AnnotationConsolidationConfig"]["AnnotationConsolidationLambdaArn"] = (
        get_groundtruth_lambda_arn(LambdaTypes.ACS, task_type)
    )

    template_uri = generate_ui_template(
        labeling_job_name,
        task_type,
        description,
        full_instructions,
        short_instructions,
        data_bucket_name,
        output_path,
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

    labeling_job["Tags"] = generate_tags(username, project_name, env_variables["SYSTEM_TAG"])

    response = sagemaker.create_labeling_job(**labeling_job)

    # Create the record in the resource_metadata table
    resource_metadata_dao.upsert_record(labeling_job_name, ResourceType.LABELING_JOB, username, project_name, {})

    return response
