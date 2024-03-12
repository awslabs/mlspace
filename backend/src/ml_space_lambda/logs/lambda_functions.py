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
from typing import Any, Dict

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import api_wrapper, retry_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables

logger = logging.getLogger(__name__)

cloudwatch = boto3.client("logs", config=retry_config)
s3 = boto3.client(
    "s3",
    config=Config(
        retries={
            "max_attempts": 3,
            "mode": "standard",
        },
        signature_version="s3v4",
    ),
)
env_variables = get_environment_variables()


@api_wrapper
def get(event, context):
    path_params = event["pathParameters"]
    query_params = event["queryStringParameters"] or {}
    log_group_name = ""
    log_stream_name_prefix = ""

    if event["resource"].startswith("/endpoint"):
        log_group_name = f"/aws/sagemaker/Endpoints/{path_params['endpointName']}"
        log_stream_name_prefix = query_params.get("variantName", "")
    elif event["resource"].startswith("/notebook"):
        log_group_name = "/aws/sagemaker/NotebookInstances"
        log_stream_name_prefix = path_params["notebookName"]
    elif event["resource"].startswith("/job"):
        log_group_name = f"/aws/sagemaker/{path_params['jobType']}"
        log_stream_name_prefix = path_params["jobName"]
    else:
        raise ValueError("Unsupported resource.")

    try:
        args: Dict[str, Any] = {
            "logGroupName": log_group_name,
        }

        if log_stream_name_prefix:
            args["logStreamNamePrefix"] = log_stream_name_prefix
        if "startTime" in query_params:
            args["startTime"] = int(query_params["startTime"])

        if "endTime" in query_params:
            args["endTime"] = int(query_params["endTime"])

        if "nextToken" in query_params:
            args["nextToken"] = query_params["nextToken"]

        response = cloudwatch.filter_log_events(**args)

        return {"events": response["events"], "nextToken": response.get("nextToken")}

    except ClientError as e:
        # if the log group doesn't exist, we should return an empty list of logs,
        # otherwise raise the exception
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            return {}
        else:
            raise e
