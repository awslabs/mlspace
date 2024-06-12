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

import logging
from enum import Enum

import boto3

from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import retry_config

log = logging.getLogger(__name__)
resource_metadata_dao = ResourceMetadataDAO()
sagemaker = boto3.client("sagemaker", config=retry_config)
emr = boto3.client("emr", config=retry_config)
translate = boto3.client("translate", config=retry_config)


class ResourceHandlingProperty(str, Enum):
    FILTER_EXPRESSION = "FilterExpression"
    FILTER_VALUES = "FilterValues"
    FILTER_NAMES = "FilterNames"
    STOP_FUNCTION = "StopFunction"
    DELETE_FUNCTION = "DeleteFunction"


# Stopping / Suspending Functions
def stop_batch_translate_job(id=str):
    translate.stop_text_translation_job(JobId=id)


def stop_labeling_job(id=str):
    sagemaker.stop_labeling_job(LabelingJobName=id)


# Delete Functions
def delete_emr_cluster(id=str):
    emr.set_termination_protection(JobFlowIds=[id], TerminationProtected=False)
    emr.terminate_job_flows(JobFlowIds=[id])


# A dictionary of values that support suspending or terminating resources
resource_handling = {
    ResourceType.BATCH_TRANSLATE_JOB: {
        ResourceHandlingProperty.FILTER_EXPRESSION: "metadata.JobStatus IN (:jobStatus)",
        ResourceHandlingProperty.FILTER_VALUES: {":jobStatus": "SUBMITTED"},
        ResourceHandlingProperty.STOP_FUNCTION: stop_batch_translate_job,
    },
    ResourceType.LABELING_JOB: {
        ResourceHandlingProperty.FILTER_EXPRESSION: "metadata.LabelingJobStatus IN (:jobStatus)",
        ResourceHandlingProperty.FILTER_VALUES: {":jobStatus": "InProgress"},
        ResourceHandlingProperty.STOP_FUNCTION: stop_labeling_job,
    },
    ResourceType.EMR_CLUSTER: {
        ResourceHandlingProperty.FILTER_EXPRESSION: "#m.#s IN (:clusterStatus)",
        ResourceHandlingProperty.FILTER_VALUES: {":clusterStatus": "WAITING"},
        ResourceHandlingProperty.FILTER_NAMES: {"#m": "metadata", "#s": "Status"},
        # If EMR would be stopped, terminate it instead. It is an expensive resources and can't be stopped or suspended
        ResourceHandlingProperty.STOP_FUNCTION: delete_emr_cluster,
        ResourceHandlingProperty.DELETE_FUNCTION: delete_emr_cluster,
    },
}


def suspend_all_of_type(resource_type: ResourceType, project: str = None, user: str = None, fetch_all: bool = True):
    log.info(
        f"Attempting to suspend all resources of Type: {str(resource_type)} | Project: {str(project)} | User: {str(user)}"
    )
    # Resource to suspend
    if resource_type in resource_handling:
        resources = resource_metadata_dao.get_all_of_type_with_filters(
            resource_type,
            project=project,
            user=user,
            fetch_all=fetch_all,
            filter_expression=(
                resource_handling[resource_type][ResourceHandlingProperty.FILTER_EXPRESSION]
                if ResourceHandlingProperty.FILTER_EXPRESSION in resource_handling[resource_type]
                else None
            ),
            filter_values=(
                resource_handling[resource_type][ResourceHandlingProperty.FILTER_VALUES]
                if ResourceHandlingProperty.FILTER_VALUES in resource_handling[resource_type]
                else None
            ),
            filter_names=(
                resource_handling[resource_type][ResourceHandlingProperty.FILTER_NAMES]
                if ResourceHandlingProperty.FILTER_NAMES in resource_handling[resource_type]
                else None
            ),
        )
        if len(resources.records) == 0:
            log.info(f"No matching records for {str(resource_type)} were found")
        for record in resources.records:
            if user is None or record.user == user:
                log.info(f"Attempting to stop {str(resource_type)} record {record.id}")
                resource_handling[resource_type][ResourceHandlingProperty.STOP_FUNCTION](record.id)
    else:
        log.warning(f"Attempted to suspend resources for a service without handling: {resource_type}")
