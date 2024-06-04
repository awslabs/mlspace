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

from enum import Enum

import boto3

from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import retry_config

resource_metadata_dao = ResourceMetadataDAO()
sagemaker = boto3.client("sagemaker", config=retry_config)
# emr = boto3.client("emr", config=retry_config)
# s3 = boto3.client("s3", config=retry_config)
translate = boto3.client("translate", config=retry_config)

# TODO: Refactor the project lambda to use this for suspending/deleting resources


class ResourceAction(str, Enum):
    FILTER_EXPRESSION = "FilterExpression"
    FILTER_VALUES = "FilterValues"
    STOP_FUNCTION = "StopFunction"
    DELETE_FUNCTION = "DeleteFunction"


def stop_hpo_job(id=str):
    sagemaker.stop_hyper_parameter_tuning_job(HyperParameterTuningJobName=id)


def stop_batch_translate_job(id=str):
    translate.stop_text_translation_job(JobId=id)


resource_handling = {
    ResourceType.HPO_JOB: {
        ResourceAction.FILTER_EXPRESSION: "metadata.HyperParameterTuningJobStatus IN (:hpoStatus)",
        ResourceAction.FILTER_VALUES: {":hpoStatus": "InProgress"},
        ResourceAction.STOP_FUNCTION: stop_hpo_job,
    },
    ResourceType.BATCH_TRANSLATE_JOB: {
        ResourceAction.FILTER_EXPRESSION: "metadata.JobStatus IN (:jobStatus)",
        ResourceAction.FILTER_VALUES: {":jobStatus", "InProgress"},
        ResourceAction.STOP_FUNCTION: stop_batch_translate_job,
    },
}


def suspend_all_of_type(resource_type: ResourceType, project: str = None, user: str = None, fetch_all: bool = True):
    # Resource to suspend
    resources = resource_metadata_dao.get_all_of_type_with_filters(
        resource_type,
        project=project,
        user=user,
        fetch_all=fetch_all,
        filter_expression=resource_handling[resource_type][ResourceAction.FILTER_EXPRESSION],
        filter_values=resource_handling[resource_type][ResourceAction.FILTER_VALUES],
    )
    for record in resources.records:
        if user is None or record.user == user:
            resource_handling[resource_type][ResourceAction.STOP_FUNCTION](record.id)
