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
import time
import urllib

import boto3
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerDAO
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    event_wrapper,
    get_notebook_stop_time,
    retry_config,
)

resource_scheduler_dao = ResourceSchedulerDAO()

emr = boto3.client("emr", config=retry_config)
sagemaker = boto3.client("sagemaker", config=retry_config)


@event_wrapper
def terminate_resources(event, context):
    # Get all resources with a termination time < current time
    resources_past_termination_time = resource_scheduler_dao.get_resources_past_termination_time(
        int(time.time())
    )

    for resource in resources_past_termination_time:
        resource_id = resource.resource_id
        resource_type = resource.resource_type
        if ResourceType.EMR_CLUSTER == resource_type:
            try:
                emr.set_termination_protection(JobFlowIds=[resource_id], TerminationProtected=False)
                emr.terminate_job_flows(JobFlowIds=[resource_id])
            except Exception as e:
                logging.exception(e)
            resource_scheduler_dao.delete(resource_id=resource_id, resource_type=resource_type)
        elif ResourceType.ENDPOINT == resource_type:
            try:
                sagemaker.delete_endpoint(EndpointName=resource_id)
            except Exception as e:
                logging.exception(e)
            resource_scheduler_dao.delete(resource_id=resource_id, resource_type=resource_type)
        elif ResourceType.NOTEBOOK == resource_type:
            try:
                sagemaker.stop_notebook_instance(NotebookInstanceName=resource_id)
            except ClientError as e:
                # It's possible the notebook has already been stopped or deleted. We don't want to
                # bail on the sweeper in either of those cases but we do want to update the
                # termination time if the notebook still exists
                if e.response["Error"]["Code"] == "ValidationException":
                    if e.response["Error"]["Message"].endswith("does not exist"):
                        resource_scheduler_dao.delete(
                            resource_id=resource_id, resource_type=resource_type
                        )
                        continue
                else:
                    logging.exception(e)
            # Grab the current termination hours and minutes and apply those to our new future stop
            stop_time = time.strftime("%H:%M", time.gmtime(resource.termination_time))
            resource_scheduler_dao.update_termination_time(
                resource_id=resource_id,
                resource_type=resource_type,
                new_termination_time=get_notebook_stop_time(stop_time),
                project=resource.project,
            )
        else:
            raise Exception(f"Unrecognized resource type: {resource_type}")


@api_wrapper
def set_resource_termination(event, context):
    event_body = json.loads(event["body"])
    project_name = event["requestContext"]["authorizer"]["projectName"]
    termination_time = event_body["terminationTime"] if "terminationTime" in event_body else None

    if event["pathParameters"] and "clusterId" in event["pathParameters"]:
        resource_id = event["pathParameters"]["clusterId"]
        resource_type = ResourceType.EMR_CLUSTER
    elif event["pathParameters"] and "notebookName" in event["pathParameters"]:
        resource_id = urllib.parse.unquote(event["pathParameters"]["notebookName"])
        resource_type = ResourceType.NOTEBOOK
        if termination_time:
            # Strip out just the time and then use our helper so we don't end up trying to set a
            # stop time that's in the past
            termination_time = get_notebook_stop_time(
                time.strftime("%H:%M", time.gmtime(event_body["terminationTime"]))
            )
    elif event["pathParameters"] and "endpointName" in event["pathParameters"]:
        resource_id = urllib.parse.unquote(event["pathParameters"]["endpointName"])
        resource_type = ResourceType.ENDPOINT
    else:
        raise RuntimeError("Unable to determine which resource termination time to update.")

    # if terminationTime is provided, update it. If it's not, delete the row from the table
    if termination_time:
        resource_scheduler_dao.update_termination_time(
            resource_id=resource_id,
            resource_type=resource_type,
            project=project_name,
            new_termination_time=termination_time,
        )
    else:
        resource_scheduler_dao.delete(resource_id=resource_id, resource_type=resource_type)
