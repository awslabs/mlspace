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

import datetime
import logging
import time
from typing import Dict, List

import boto3
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerDAO, ResourceSchedulerModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import event_wrapper
from ml_space_lambda.utils.mlspace_config import get_environment_variables, retry_config

logger = logging.getLogger(__name__)

env_variables = get_environment_variables()
resource_metadata_dao = ResourceMetadataDAO()
resource_scheduler_dao = ResourceSchedulerDAO()
project_dao = ProjectDAO()

sagemaker = boto3.client("sagemaker", config=retry_config)
emr = boto3.client("emr", config=retry_config)
# Translate isn't available in all regions so we're going to lazy load this
translate = {}
# Iam is only needed if we're trying to attribute batch translate jobs to users
# when created in a notebook so lazy loading this
iam = {}


@event_wrapper
def process_event(event, context):
    # Processing logic is based on the "detail-type" of the event bridge event
    if event["detail-type"] == "SageMaker Notebook Instance State Change":
        _process_notebook_event(event["detail"])
    elif event["detail-type"] == "SageMaker Endpoint State Change":
        _process_endpoint_event(event["detail"])
    elif event["detail-type"] == "SageMaker Model State Change":
        _process_model_event(event["detail"])
    elif event["detail-type"] == "SageMaker Training Job State Change":
        _process_training_job_event(event["detail"])
    elif event["detail-type"] == "SageMaker Transform Job State Change":
        _process_transform_job_event(event["detail"])
    elif event["detail-type"] == "SageMaker Endpoint Config State Change":
        _process_endpoint_config_event(event["detail"])
    elif event["detail-type"] == "EMR Cluster State Change":
        _process_emr_event(event["detail"])
    elif event["detail-type"] == "Translate TextTranslationJob State Change" or (
        event["detail-type"] == "AWS API Call via CloudTrail" and event["source"] == "aws.translate"
    ):
        _process_batch_translate_event(event["detail"])
    elif event["detail-type"] == "SageMaker HyperParameter Tuning Job State Change":
        _process_hpo_event(event["detail"])
    elif event["detail-type"] == "SageMaker Ground Truth Labeling Job State Change" or (
        event["detail-type"] == "AWS API Call via CloudTrail"
        and event["source"] == "aws.sagemaker"
        and "detail" in event
        and event["detail"]["eventName"] == "CreateLabelingJob"
    ):
        # GT event has more relevant info than the "detail" key in it
        _process_labeling_job_event(event)


def _convert_timestamp(event, timestamp_key):
    if timestamp_key in event:
        return (
            datetime.datetime.utcfromtimestamp(event[timestamp_key] / 1000).strftime("%Y-%m-%d %H:%M:%S.%f+00:00")
            if event[timestamp_key]
            else None
        )
    else:
        return None


def _process_notebook_event(details):
    if details["NotebookInstanceStatus"] == "Deleted":
        resource_metadata_dao.delete(details["NotebookInstanceName"], ResourceType.NOTEBOOK)
    elif "system" in details["Tags"] and details["Tags"]["system"] == env_variables["SYSTEM_TAG"]:
        if "user" in details["Tags"] and "project" in details["Tags"]:
            metadata = {
                "NotebookInstanceArn": details["NotebookInstanceArn"],
                "CreationTime": _convert_timestamp(details, "CreationTime"),
                "FailureReason": details["FailureReason"],
                "InstanceType": details["InstanceType"],
                "LastModifiedTime": _convert_timestamp(details, "LastModifiedTime"),
                "NotebookInstanceLifecycleConfigName": details["NotebookInstanceLifecycleConfigName"],
                "NotebookInstanceStatus": details["NotebookInstanceStatus"],
            }
            # It's possible for duplicate CWE to be delivered which means we could end up in a
            # situation where we get a "Deleting" event followed by a "Deleted" event followed by a
            # duplicate of the previous "Deleting" event. We don't want to add a new metadata record
            # after we've already processed the delete so for "Deleting" we only perform updates as
            # opposed to upserts.
            if details["NotebookInstanceStatus"] == "Deleting":
                try:
                    resource_metadata_dao.update(details["NotebookInstanceName"], ResourceType.NOTEBOOK, metadata)
                except ClientError as e:
                    # If we get an error due to the resource not existing, that's fine because we
                    # are about to delete the record anyway. For other errors we don't really care
                    # either but we'll log it just in case.
                    if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                        logger.error(f'Error processing notebook deleting event: {details["NotebookInstanceName"]}')
            else:
                resource_metadata_dao.upsert_record(
                    details["NotebookInstanceName"],
                    ResourceType.NOTEBOOK,
                    details["Tags"]["user"],
                    details["Tags"]["project"],
                    metadata,
                )
        else:
            raise ValueError(
                f'Error processing notebook event - missing required project and user tags. Found tags: {details["Tags"]}'
            )


def _process_endpoint_event(details):
    if details["EndpointStatus"] == "DELETED":
        resource_metadata_dao.delete(details["EndpointName"], ResourceType.ENDPOINT)
    elif "system" in details["Tags"] and details["Tags"]["system"] == env_variables["SYSTEM_TAG"]:
        if "user" in details["Tags"] and "project" in details["Tags"]:
            endpoint_name = details["EndpointName"]
            project_name = details["Tags"]["project"]
            metadata = {
                "CreationTime": _convert_timestamp(details, "CreationTime"),
                "EndpointArn": details["EndpointArn"],
                "EndpointStatus": details["EndpointStatus"],
                "FailureReason": details["FailureReason"],
                "LastModifiedTime": _convert_timestamp(details, "LastModifiedTime"),
            }
            if details["EndpointStatus"] == "CREATING":
                project = project_dao.get(details["Tags"]["project"])
                if project.has_default_stop_time(ResourceType.ENDPOINT):
                    # Endpoint TTL is in hours so we need to convert that to seconds and add to the current time
                    termination_time = time.time() + (
                        int(project.metadata["terminationConfiguration"]["defaultEndpointTTL"]) * 60 * 60
                    )
                    resource_scheduler_dao.create(
                        ResourceSchedulerModel(
                            resource_id=endpoint_name,
                            resource_type=ResourceType.ENDPOINT,
                            termination_time=termination_time,
                            project=project_name,
                        )
                    )
            # It's possible for duplicate CWE to be delivered which means we could end up in a
            # situation where we get a "DELETING" event followed by a "DELETED" event followed by a
            # duplicate of the previous "DELETING" event. We don't want to add a new metadata record
            # after we've already processed the delete so for "DELETING" we only perform updates as
            # opposed to upserts.
            if details["EndpointStatus"] == "DELETING":
                try:
                    resource_metadata_dao.update(details["EndpointName"], ResourceType.ENDPOINT, metadata)
                except ClientError as e:
                    # If we get an error due to the resource not existing, that's fine because we
                    # are about to delete the record anyway. For other errors we don't really care
                    # either but we'll log it just in case.
                    if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                        logger.error(f'Error processing endpoint deleting event: {details["EndpointName"]}')
            else:
                resource_metadata_dao.upsert_record(
                    details["EndpointName"],
                    ResourceType.ENDPOINT,
                    details["Tags"]["user"],
                    details["Tags"]["project"],
                    metadata,
                )
        else:
            raise ValueError(
                f'Error processing endpoint event - missing required project and user tags. Found tags: {details["Tags"]}'
            )


def _process_model_event(details):
    # If this is a delete there will be no tags so we'll just try to delete a corresponding record
    # in our table, if it doesn't exist not a problem. For all other events we can filter them out
    # by checking for the MLSpace system tag
    if len(details["Tags"]) == 0:
        # Check if the model still exists and if not then this truly was a delete
        try:
            sagemaker.describe_model(ModelName=details["ModelName"])
        except ClientError as e:
            # If it's any other client exception we just won't process the event
            if e.response["Error"]["Code"] == "AccessDeniedException":
                if "no identity-based policy allows the sagemaker:DescribeModel action" in e.response["Error"]["Message"]:
                    resource_metadata_dao.delete(details["ModelName"], ResourceType.MODEL)
                    return

        raise ValueError("Error processing model event - missing all tags.")
    elif "system" in details["Tags"] and details["Tags"]["system"] == env_variables["SYSTEM_TAG"]:
        if "user" in details["Tags"] and "project" in details["Tags"]:
            metadata = {
                "CreationTime": _convert_timestamp(details, "CreationTime"),
                "ModelArn": details["ModelArn"],
            }
            resource_metadata_dao.upsert_record(
                details["ModelName"],
                ResourceType.MODEL,
                details["Tags"]["user"],
                details["Tags"]["project"],
                metadata,
            )
        else:
            raise ValueError(
                f'Error processing model event - missing required project and user tags. Found tags: {details["Tags"]}'
            )


def _process_training_job_event(details):
    if "system" in details["Tags"] and details["Tags"]["system"] == env_variables["SYSTEM_TAG"]:
        if "user" in details["Tags"] and "project" in details["Tags"]:
            metadata = {
                "CreationTime": _convert_timestamp(details, "CreationTime"),
                "TrainingJobArn": details["TrainingJobArn"],
                "TrainingJobStatus": details["TrainingJobStatus"],
                "FailureReason": details["FailureReason"],
                "LastModifiedTime": _convert_timestamp(details, "LastModifiedTime"),
                "TrainingStartTime": _convert_timestamp(details, "TrainingStartTime"),
                "TrainingEndTime": _convert_timestamp(details, "TrainingEndTime"),
            }

            resource_metadata_dao.upsert_record(
                details["TrainingJobName"],
                ResourceType.TRAINING_JOB,
                details["Tags"]["user"],
                details["Tags"]["project"],
                metadata,
            )
        else:
            raise ValueError(
                f'Error processing training job event - missing required project and user tags. Found tags: {details["Tags"]}'
            )


def _process_transform_job_event(details):
    if "system" in details["Tags"] and details["Tags"]["system"] == env_variables["SYSTEM_TAG"]:
        if "user" in details["Tags"] and "project" in details["Tags"]:
            metadata = {
                "CreationTime": _convert_timestamp(details, "CreationTime"),
                "TransformJobArn": details["TransformJobArn"],
                "TransformJobStatus": details["TransformJobStatus"],
                "FailureReason": details["FailureReason"],
                "TransformStartTime": _convert_timestamp(details, "TransformStartTime"),
                "TransformEndTime": _convert_timestamp(details, "TransformEndTime"),
            }
            resource_metadata_dao.upsert_record(
                details["TransformJobName"],
                ResourceType.TRANSFORM_JOB,
                details["Tags"]["user"],
                details["Tags"]["project"],
                metadata,
            )
        else:
            raise ValueError(
                f'Error processing transform job event - missing required project and user tags. Found tags: {details["Tags"]}'
            )


def _process_endpoint_config_event(details):
    # If this is a delete there will be no tags so we'll just try to delete a corresponding record
    # in our table, if it doesn't exist not a problem. For all other events we can filter them out
    # by checking for the MLSpace system tag
    if len(details["Tags"]) == 0:
        # Check if the config still exists and if not then this truly was a delete
        try:
            sagemaker.describe_endpoint_config(EndpointConfigName=details["EndpointConfigName"])
        except ClientError as e:
            # If it's any other client exception we just won't process the event
            if e.response["Error"]["Code"] == "ValidationException":
                # This must match the actual string that comes back from the API
                if "Could not find endpoint configuration" in e.response["Error"]["Message"]:
                    resource_metadata_dao.delete(details["EndpointConfigName"], ResourceType.ENDPOINT_CONFIG)
                    return

        raise ValueError("Error processing endpoint config event - missing all tags.")
    elif "system" in details["Tags"] and details["Tags"]["system"] == env_variables["SYSTEM_TAG"]:
        if "user" in details["Tags"] and "project" in details["Tags"]:
            metadata = {
                "CreationTime": _convert_timestamp(details, "CreationTime"),
                "EndpointConfigArn": details["EndpointConfigArn"],
            }
            resource_metadata_dao.upsert_record(
                details["EndpointConfigName"],
                ResourceType.ENDPOINT_CONFIG,
                details["Tags"]["user"],
                details["Tags"]["project"],
                metadata,
            )
        else:
            raise ValueError(
                f'Error processing endpoint config event - missing required project and user tags. Found tags: {details["Tags"]}'
            )


def _process_emr_event(details):
    cluster_id = details["clusterId"]
    cluster_state = details["state"]

    if cluster_state == "TERMINATED":
        # cluster no longer exists, delete it from the resource table
        resource_metadata_dao.delete(cluster_id, ResourceType.EMR_CLUSTER)
    else:
        cluster_details = emr.describe_cluster(ClusterId=cluster_id)
        tags = _parse_tags(cluster_details["Cluster"]["Tags"])
        if "system" in tags and tags["system"] == env_variables["SYSTEM_TAG"]:
            if "user" in tags and "project" in tags:
                user = tags["user"]
                project = tags["project"]
                metadata = {
                    "CreationTime": cluster_details["Cluster"]["Status"]["Timeline"]["CreationDateTime"],
                    "Status": cluster_state,
                    "ReleaseVersion": cluster_details["Cluster"]["ReleaseLabel"],
                    "Name": details["name"],
                    "NormalizedInstanceHours": cluster_details["Cluster"]["NormalizedInstanceHours"],
                }
                resource_metadata_dao.upsert_record(
                    cluster_id,
                    ResourceType.EMR_CLUSTER,
                    user,
                    project,
                    metadata,
                )
            else:
                raise ValueError(
                    f"Error processing EMR State Change event - missing required project and user tags. Found tags: {tags}"
                )


def _process_batch_translate_event(details):
    job_id = None
    is_update = False
    username = None
    project_name = None

    if "eventName" not in details:
        # Process terminal state notifications (non-cloudtrail)
        is_update = True
        job_id = details["jobId"]
    elif (
        details["eventName"] == "StopTextTranslationJob"
        and "requestParameters" in details
        and "jobId" in details["requestParameters"]
    ):
        # Process Cloudtrail API Event for Stop calls
        is_update = True
        job_id = details["requestParameters"]["jobId"]
    elif (
        details["eventName"] == "StartTextTranslationJob"
        and env_variables["MANAGE_IAM_ROLES"]
        and details.get("userIdentity", {}).get("principalId", "").endswith("SageMaker")
        and details.get("responseElements", {}).get("jobId", None) is not None
        and details.get("userIdentity", {}).get("sessionContext", {}).get("sessionIssuer", {}).get("type", "") == "Role"
        and details.get("userIdentity", {}).get("sessionContext", {}).get("sessionIssuer", {}).get("userName", None)
        is not None
    ):
        # If the event was a job submission and it came from a notebook we need to create a new record.
        # Translate jobs don't have tags so instead we have to check the role that was used to create
        # the job and try to determine the user/project from that role. If MLSpace was configured with
        # dynamic roles then it's possible for us to do. If we aren't using dynamic roles we don't have
        # a way to attribute jobs created in a notebook back to a specific user/project
        job_id = details["responseElements"]["jobId"]

        global iam
        if not iam:
            iam = boto3.client("iam", config=retry_config)

        paginator = iam.get_paginator("list_role_tags")
        pages = paginator.paginate()

        for page in pages:
            if "Tags" in page:
                for tag in page["Tags"]:
                    if tag["Key"] == "project":
                        project_name = tag["Value"]
                    elif tag["Key"] == "user":
                        username = tag["Value"]

    if job_id:
        global translate
        if not translate:
            translate = boto3.client("translate", config=retry_config)

        job_details = translate.describe_text_translation_job(JobId=job_id)["TextTranslationJobProperties"]
        metadata = {
            "JobName": job_details["JobName"],
            "JobStatus": job_details["JobStatus"],
            "SubmittedTime": job_details["SubmittedTime"],
            "SourceLanguageCode": job_details["SourceLanguageCode"],
            "TargetLanguageCodes": job_details["TargetLanguageCodes"],
        }
        if is_update:
            # If the event was a terminal status update or a Stop API request we need to update an existing
            # record. If we don't have an existing record we don't really have a good way to associate the
            # job with a user or project so we won't process the event
            resource_metadata_dao.update(job_id, ResourceType.BATCH_TRANSLATE_JOB, metadata)
        else:
            if project_name and username:
                resource_metadata_dao.upsert_record(
                    job_id,
                    ResourceType.BATCH_TRANSLATE_JOB,
                    username,
                    project_name,
                    metadata,
                )
            else:
                raise ValueError("Error processing batch translation job event - missing required project and user tags.")


def _process_hpo_event(details):
    if "system" in details["Tags"] and details["Tags"]["system"] == env_variables["SYSTEM_TAG"]:
        if "user" in details["Tags"] and "project" in details["Tags"]:
            # While the event details contains TrainingJobStatusCounters it appears that the value
            # is never populated so we need to describe the job to ensure we have accurate count
            # metadata. Will need to check if this data is meant to be included because the docs
            # show it being there
            # https://docs.aws.amazon.com/sagemaker/latest/dg/automating-sagemaker-with-eventbridge.html#eventbridge-hpo
            hpo_job = sagemaker.describe_hyper_parameter_tuning_job(
                HyperParameterTuningJobName=details["HyperParameterTuningJobName"]
            )
            metadata = {
                "CreationTime": _convert_timestamp(details, "CreationTime"),
                "FailureReason": hpo_job["FailureReason"] if "FailureReason" in hpo_job else None,
                "HyperParameterTuningEndTime": _convert_timestamp(details, "HyperParameterTuningEndTime"),
                "HyperParameterTuningJobArn": hpo_job["HyperParameterTuningJobArn"],
                "HyperParameterTuningJobStatus": details["HyperParameterTuningJobStatus"],
                "LastModifiedTime": _convert_timestamp(details, "LastModifiedTime"),
                "Strategy": hpo_job["HyperParameterTuningJobConfig"]["Strategy"],
                "TrainingJobStatusCounters": hpo_job["TrainingJobStatusCounters"],
            }
            resource_metadata_dao.upsert_record(
                details["HyperParameterTuningJobName"],
                ResourceType.HPO_JOB,
                details["Tags"]["user"],
                details["Tags"]["project"],
                metadata,
            )
        else:
            raise ValueError(
                f'Error processing HPO job event - missing required project and user tags. Found tags: {details["Tags"]}'
            )


def _process_labeling_job_event(event):
    job_arn = None

    if event["detail-type"] == "SageMaker Ground Truth Labeling Job State Change":
        # Process terminal state notifications (non-cloudtrail)
        job_arn = event["resources"][0]
    elif (
        event["detail"]["eventName"] == "CreateLabelingJob"
        and "responseElements" in event["detail"]
        and "labelingJobArn" in event["detail"]["responseElements"]
    ):
        # Process Cloudtrail API Event for labeling job creation
        job_arn = event["detail"]["responseElements"]["labelingJobArn"]

    if job_arn:
        # Separate call to get tags
        labeling_job_name = job_arn.split("/")[-1].strip()
        job_details = sagemaker.describe_labeling_job(LabelingJobName=labeling_job_name)
        tags = _parse_tags(job_details["Tags"])
        if "system" in tags and tags["system"] == env_variables["SYSTEM_TAG"]:
            if "user" in tags and "project" in tags:
                owner = tags["user"]
                project = tags["project"]
                # ARN will end with something like 'PRE-BoundingBox', so this line will attempt to
                # grab the last string separated by a hyphen. We can then use that in a lookup table
                # for the official job type name.
                task_type = "Custom"
                if "HumanTaskConfig" in job_details and "PreHumanTaskLambdaArn" in job_details["HumanTaskConfig"]:
                    pre_human_task_arn_type = job_details["HumanTaskConfig"]["PreHumanTaskLambdaArn"].split("-")[-1].strip()
                    task_type_map = {
                        "BoundingBox": "Bounding box",
                        "ImageMultiClass": "Image classification",
                        "ImageMultiClassMultiLabel": "Multi-label image classification",
                        "SemanticSegmentation": "Semantic segmentation",
                        "TextMultiClass": "Text classification",
                        "TextMultiClassMultiLabel": "Multi-label text classification",
                        "NamedEntityRecognition": "Named entity recognition",
                        "VideoMultiClass": "Video Classification",
                        "VideoObjectDetection": "Video Frame Object Detection",
                        "VideoObjectTracking": "Video Frame Object Tracking",
                        "3DPointCloudObjectDetection": "3D Point Cloud Object Detection",
                        "3DPointCloudObjectTracking": "3D Point Cloud Object Tracking",
                        "3DPointCloudSemanticSegmentation": "3D Point Cloud Semantic Segmentation",
                        "VerificationBoundingBox": "Bounding box verification",
                        "AdjustmentBoundingBox": "Bounding box adjustment",
                        "VerificationSemanticSegmentation": "Semantic segmentation verification",
                        "AdjustmentSemanticSegmentation": "Semantic segmentation adjustment",
                        "AdjustmentVideoObjectDetection": "Video Frame Object Detection Adjustment",
                        "AdjustmentVideoObjectTracking": "Video Frame Object Tracking Adjustment",
                        "Adjustment3DPointCloudObjectDetection": "3D point cloud object detection adjustment",
                        "Adjustment3DPointCloudObjectTracking": "3D point cloud object tracking adjustment",
                        "Adjustment3DPointCloudSemanticSegmentation": "3D point cloud semantic segmentation adjustment",
                    }
                    task_type = task_type_map.get(pre_human_task_arn_type, "Custom")

                metadata = {
                    "CreationTime": job_details["CreationTime"],
                    "FailureReason": job_details["FailureReason"] if "FailureReason" in job_details else None,
                    "LastModifiedTime": job_details["LastModifiedTime"],
                    "LabelingJobArn": job_arn,
                    "LabelingJobStatus": job_details["LabelingJobStatus"],
                    "LabelCounters": job_details["LabelCounters"],
                    "TaskType": task_type,
                }
                resource_metadata_dao.upsert_record(
                    job_details["LabelingJobName"],
                    ResourceType.LABELING_JOB,
                    owner,
                    project,
                    metadata,
                )
            else:
                raise ValueError(
                    f"Error processing Labeling job event - missing required project and user tags. Found tags: {tags}"
                )


def _parse_tags(tags_list: List[Dict[str, str]]) -> Dict[str, str]:
    """
    Converts a list of tags in the form [{"Key": "keyname", "Value": "valuename"}, ...] to a single dictionary
    of {"keyname": "valuename"} pairs
    """
    return {d["Key"]: d["Value"] for d in tags_list}
