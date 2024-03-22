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

from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper, get_tags_for_resource
from ml_space_lambda.utils.mlspace_config import get_environment_variables, retry_config

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)
emr = boto3.client("emr", config=retry_config)
resource_metadata_dao = ResourceMetadataDAO()


@api_wrapper
def sync_metadata(event, context):
    event_body = json.loads(event["body"])
    env_variables = get_environment_variables()

    message = "Successfully created resource metadata records for the selected resource types."
    if "resourceTypes" in event_body:
        if "Notebooks" in event_body["resourceTypes"]:
            _sync_notebooks(env_variables)
        if "Endpoints" in event_body["resourceTypes"]:
            _sync_endpoints(env_variables)
        if "Models" in event_body["resourceTypes"]:
            _sync_models(env_variables)
        if "TrainingJobs" in event_body["resourceTypes"]:
            _sync_training_jobs(env_variables)
        if "TransformJobs" in event_body["resourceTypes"]:
            _sync_transform_jobs(env_variables)
        if "EndpointConfigs" in event_body["resourceTypes"]:
            _sync_endpoint_configs(env_variables)
        if "HPOJobs" in event_body["resourceTypes"]:
            _sync_hpo_jobs(env_variables)
        if "EMRClusters" in event_body["resourceTypes"]:
            _sync_emr_jobs(env_variables)
    else:
        message = "No resource types were specified."
    return {"success": True, "message": message}


def _get_system_owner_and_project(arn, system_tag, tags=[]):
    project = None
    owner = None
    is_mlspace_resource = False

    if not tags:
        tags = get_tags_for_resource(sagemaker, arn)
    for tag in tags:
        if tag["Key"] == "project":
            project = tag["Value"]
        elif tag["Key"] == "user":
            owner = tag["Value"]
        elif tag["Key"] == "system" and tag["Value"] == system_tag:
            is_mlspace_resource = True

    return (is_mlspace_resource, project, owner)


def _sync_notebooks(env_variables):
    paginator = sagemaker.get_paginator("list_notebook_instances")
    pages = paginator.paginate()

    for page in pages:
        if "NotebookInstances" in page:
            for notebook in page["NotebookInstances"]:
                # Check if this is an MLSpace resource based on tags
                (is_mlspace_resource, project, owner) = _get_system_owner_and_project(
                    notebook["NotebookInstanceArn"], env_variables["SYSTEM_TAG"]
                )
                if project and owner and is_mlspace_resource:
                    notebook_metadata = {
                        "NotebookInstanceArn": notebook["NotebookInstanceArn"],
                        "CreationTime": notebook["CreationTime"],
                        "InstanceType": notebook["InstanceType"],
                        "LastModifiedTime": notebook["LastModifiedTime"],
                        "NotebookInstanceLifecycleConfigName": notebook["NotebookInstanceLifecycleConfigName"],
                        "NotebookInstanceStatus": notebook["NotebookInstanceStatus"],
                    }
                    # Create resource metadata record
                    try:
                        resource_metadata_dao.upsert_record(
                            notebook["NotebookInstanceName"],
                            ResourceType.NOTEBOOK,
                            owner,
                            project,
                            notebook_metadata,
                        )
                    except Exception:
                        logger.warn(f'Error generating resource metadata for Notebook: {notebook["NotebookInstanceName"]}')


def _sync_endpoints(env_variables):
    paginator = sagemaker.get_paginator("list_endpoints")
    pages = paginator.paginate()

    for page in pages:
        if "Endpoints" in page:
            for endpoint in page["Endpoints"]:
                # Check if this is an MLSpace resource based on tags
                (is_mlspace_resource, project, owner) = _get_system_owner_and_project(
                    endpoint["EndpointArn"], env_variables["SYSTEM_TAG"]
                )
                if project and owner and is_mlspace_resource:
                    endpoint_metadata = {
                        "CreationTime": endpoint["CreationTime"],
                        "EndpointArn": endpoint["EndpointArn"],
                        "EndpointStatus": endpoint["EndpointStatus"],
                        "LastModifiedTime": endpoint["LastModifiedTime"],
                    }
                    # Create resource metadata record
                    try:
                        resource_metadata_dao.upsert_record(
                            endpoint["EndpointName"],
                            ResourceType.ENDPOINT,
                            owner,
                            project,
                            endpoint_metadata,
                        )
                    except Exception:
                        logger.warn(f'Error generating resource metadata for Endpoint: {endpoint["EndpointName"]}')


def _sync_models(env_variables):
    paginator = sagemaker.get_paginator("list_models")
    pages = paginator.paginate()

    for page in pages:
        if "Models" in page:
            for model in page["Models"]:
                # Check if this is an MLSpace resource based on tags
                (is_mlspace_resource, project, owner) = _get_system_owner_and_project(
                    model["ModelArn"], env_variables["SYSTEM_TAG"]
                )
                if project and owner and is_mlspace_resource:
                    model_metadata = {
                        "CreationTime": model["CreationTime"],
                        "ModelArn": model["ModelArn"],
                    }
                    # Create resource metadata record
                    try:
                        resource_metadata_dao.upsert_record(
                            model["ModelName"],
                            ResourceType.MODEL,
                            owner,
                            project,
                            model_metadata,
                        )
                    except Exception:
                        logger.warn(f'Error generating resource metadata for Model: {model["ModelName"]}')


def _sync_training_jobs(env_variables):
    paginator = sagemaker.get_paginator("list_training_jobs")
    pages = paginator.paginate()

    for page in pages:
        if "TrainingJobSummaries" in page:
            for job in page["TrainingJobSummaries"]:
                # Check if this is an MLSpace resource based on tags
                (is_mlspace_resource, project, owner) = _get_system_owner_and_project(
                    job["TrainingJobArn"], env_variables["SYSTEM_TAG"]
                )
                if project and owner and is_mlspace_resource:
                    job_details = sagemaker.describe_training_job(TrainingJobName=job["TrainingJobName"])
                    job_metadata = {
                        "CreationTime": job_details["CreationTime"],
                        "TrainingJobArn": job_details["TrainingJobArn"],
                        "TrainingJobStatus": job_details["TrainingJobStatus"],
                        "LastModifiedTime": job_details["LastModifiedTime"],
                        "TrainingStartTime": job_details["TrainingStartTime"] if "TrainingStartTime" in job_details else None,
                        "TrainingEndTime": job_details["TrainingEndTime"] if "TrainingEndTime" in job_details else None,
                        "FailureReason": job_details["FailureReason"] if "FailureReason" in job_details else None,
                    }
                    # Create resource metadata record
                    try:
                        resource_metadata_dao.upsert_record(
                            job["TrainingJobName"],
                            ResourceType.TRAINING_JOB,
                            owner,
                            project,
                            job_metadata,
                        )
                    except Exception:
                        logger.warn(f'Error generating resource metadata for Training Job: {job["TrainingJobName"]}')


def _sync_transform_jobs(env_variables):
    paginator = sagemaker.get_paginator("list_transform_jobs")
    pages = paginator.paginate()

    for page in pages:
        if "TransformJobSummaries" in page:
            for job in page["TransformJobSummaries"]:
                # Check if this is an MLSpace resource based on tags
                (is_mlspace_resource, project, owner) = _get_system_owner_and_project(
                    job["TransformJobArn"], env_variables["SYSTEM_TAG"]
                )
                if project and owner and is_mlspace_resource:
                    job_metadata = {
                        "CreationTime": job["CreationTime"],
                        "TransformJobArn": job["TransformJobArn"],
                        "TransformJobStatus": job["TransformJobStatus"],
                        "LastModifiedTime": job["LastModifiedTime"],
                        # TransformStartTime is not available in the summary and isn't totally critical
                        # so we won't bother with a describe call when migrating
                        "TransformStartTime": None,
                        "TransformEndTime": job["TransformEndTime"] if "TransformEndTime" in job else None,
                        "FailureReason": job["FailureReason"] if "FailureReason" in job else None,
                    }
                    # Create resource metadata record
                    try:
                        resource_metadata_dao.upsert_record(
                            job["TransformJobName"],
                            ResourceType.TRANSFORM_JOB,
                            owner,
                            project,
                            job_metadata,
                        )
                    except Exception:
                        logger.warn(f'Error generating resource metadata for Transform Job: {job["TransformJobName"]}')


def _sync_endpoint_configs(env_variables):
    paginator = sagemaker.get_paginator("list_endpoint_configs")
    pages = paginator.paginate()

    for page in pages:
        if "EndpointConfigs" in page:
            for config in page["EndpointConfigs"]:
                # Check if this is an MLSpace resource based on tags
                (is_mlspace_resource, project, owner) = _get_system_owner_and_project(
                    config["EndpointConfigArn"], env_variables["SYSTEM_TAG"]
                )
                if project and owner and is_mlspace_resource:
                    config_metadata = {
                        "CreationTime": config["CreationTime"],
                        "EndpointConfigArn": config["EndpointConfigArn"],
                    }
                    # Create resource metadata record
                    try:
                        resource_metadata_dao.upsert_record(
                            config["EndpointConfigName"],
                            ResourceType.ENDPOINT_CONFIG,
                            owner,
                            project,
                            config_metadata,
                        )
                    except Exception:
                        logger.warn(f'Error generating resource metadata for Endpoint Config: {config["EndpointConfigName"]}')


def _sync_hpo_jobs(env_variables):
    paginator = sagemaker.get_paginator("list_hyper_parameter_tuning_jobs")
    pages = paginator.paginate()

    for page in pages:
        if "HyperParameterTuningJobSummaries" in page:
            for job in page["HyperParameterTuningJobSummaries"]:
                # HPO ARNs from the list call are always lowercase but the actual arns CAN be mixed case
                # if the name is mixed case (but aren't always mixed case). There was a recent change
                # related to ARN casing so to be safe we need to describe the job to get the correct
                # ARN
                job_details = sagemaker.describe_hyper_parameter_tuning_job(
                    HyperParameterTuningJobName=job["HyperParameterTuningJobName"]
                )
                # Check if this is an MLSpace resource based on tags
                (is_mlspace_resource, project, owner) = _get_system_owner_and_project(
                    job_details["HyperParameterTuningJobArn"], env_variables["SYSTEM_TAG"]
                )
                if project and owner and is_mlspace_resource:
                    job_metadata = {
                        "CreationTime": job["CreationTime"],
                        "FailureReason": job["FailureReason"] if "FailureReason" in job else None,
                        "HyperParameterTuningEndTime": (
                            job["HyperParameterTuningEndTime"] if "HyperParameterTuningEndTime" in job else None
                        ),
                        "HyperParameterTuningJobArn": job_details["HyperParameterTuningJobArn"],
                        "HyperParameterTuningJobStatus": job["HyperParameterTuningJobStatus"],
                        "LastModifiedTime": job["LastModifiedTime"],
                        "Strategy": job["Strategy"],
                        "TrainingJobStatusCounters": job["TrainingJobStatusCounters"],
                    }
                    # Create resource metadata record
                    try:
                        resource_metadata_dao.upsert_record(
                            job["HyperParameterTuningJobName"],
                            ResourceType.HPO_JOB,
                            owner,
                            project,
                            job_metadata,
                        )
                    except Exception:
                        logger.warn(f'Error generating resource metadata for HPO Job: {job["HyperParameterTuningJobName"]}')


def _sync_emr_jobs(env_variables):
    paginator = emr.get_paginator("list_clusters")
    pages = paginator.paginate()

    for page in pages:
        if "Clusters" in page:
            for cluster in page["Clusters"]:
                # Describe the cluster so we can get the ReleaseLabel value and Tags
                cluster_details = emr.describe_cluster(ClusterId=cluster["Id"])
                # Check if this is an MLSpace resource based on tags
                (is_mlspace_resource, project, owner) = _get_system_owner_and_project(
                    cluster["ClusterArn"], env_variables["SYSTEM_TAG"], cluster_details["Cluster"]["Tags"]
                )
                if project and owner and is_mlspace_resource:
                    status = cluster["Status"]["State"]
                    if status != "TERMINATED":
                        metadata = {
                            "CreationTime": cluster["Status"]["Timeline"]["CreationDateTime"],
                            "Status": status,
                            "ReleaseVersion": cluster_details["Cluster"]["ReleaseLabel"],
                            "Name": cluster["Name"],
                            "NormalizedInstanceHours": cluster["NormalizedInstanceHours"],
                        }
                        # Create resource metadata record
                        try:
                            resource_metadata_dao.upsert_record(
                                cluster["Id"],
                                ResourceType.EMR_CLUSTER,
                                owner,
                                project,
                                metadata,
                            )
                        except Exception:
                            logger.warn(f'Error generating resource metadata for Model: {cluster["Name"]}')
