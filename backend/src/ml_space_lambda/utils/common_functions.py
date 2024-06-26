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

import copy
import functools
import json
import logging
import time
from contextvars import ContextVar
from typing import Any, Dict, List, Optional

from botocore.config import Config

from ml_space_lambda.enums import Permission, ResourceType

retry_config = Config(
    retries={
        "max_attempts": 3,
        "mode": "standard",
    },
)
ctx_context = ContextVar("lamdbacontext")
logger = logging.getLogger(__name__)
logging_configured = False


class LambdaContextFilter(logging.Filter):
    def filter(self, record):
        try:
            context = ctx_context.get()
            record.requestid = context.aws_request_id
            record.functionname = context.function_name
        except Exception:
            record.requestid = "RID-MISSING"
            record.functionname = "FN-MISSING"
        return True


def setup_root_logging():
    global logging_configured

    if not logging_configured:
        logging_level = logging.INFO
        format_string = "%(asctime)s %(name)s [%(requestid)s] [%(levelname)s] %(message)s"

        root_logger = logging.getLogger()
        # Remove default handlers
        if root_logger.handlers:
            for handler in root_logger.handlers:
                root_logger.removeHandler(handler)

        root_logger = logging.getLogger()
        root_logger.setLevel(logging_level)
        handler = logging.StreamHandler()
        handler.setLevel(logging_level)
        formatter = logging.Formatter(format_string)
        handler.setFormatter(formatter)
        handler.addFilter(LambdaContextFilter())
        root_logger.addHandler(handler)
        logging_configured = True


setup_root_logging()


def _sanitize_event(event: Dict[str, Dict[str, Any]]):
    # First normalize keys for our object
    sanitized = copy.deepcopy(event)
    if "headers" in event:
        for key in event["headers"]:
            if key != key.lower():
                sanitized["headers"][key.lower()] = event["headers"][key]
                del sanitized["headers"][key]
    if "multiValueHeaders" in sanitized:
        for key in event["multiValueHeaders"]:
            if key != key.lower():
                sanitized["multiValueHeaders"][key.lower()] = event["multiValueHeaders"][key]
                del sanitized["multiValueHeaders"][key]

    if "headers" in sanitized and "authorization" in sanitized["headers"]:
        sanitized["headers"]["authorization"] = "<REDACTED>"
    if "multiValueHeaders" in sanitized and "authorization" in sanitized["headers"]:
        sanitized["multiValueHeaders"]["authorization"] = ["<REDACTED>"]
    return json.dumps(sanitized)


def api_wrapper(f):
    @functools.wraps(f)
    def wrapper(event, context):
        ctx_context.set(context)
        code_func_name = f.__name__
        lambda_func_name = context.function_name
        logger.info(f"Lambda {lambda_func_name}({code_func_name}) invoked with {_sanitize_event(event)}")
        try:
            result = f(event, context)
            return generate_html_response(200, result)
        except Exception as e:
            return generate_exception_response(e)

    return wrapper


def event_wrapper(f):
    @functools.wraps(f)
    def wrapper(event, context):
        ctx_context.set(context)
        code_func_name = f.__name__
        lambda_func_name = context.function_name
        logger.info(f"Lambda {lambda_func_name}({code_func_name}) invoked with {_sanitize_event(event)}")
        return f(event, context)

    return wrapper


def authorization_wrapper(f):
    @functools.wraps(f)
    def wrapper(event, context):
        ctx_context.set(context)
        return f(event, context)

    return wrapper


def get_tags_for_resource(sagemaker, arn: str):
    tags = []
    response = sagemaker.list_tags(ResourceArn=arn)
    tags = [tag for tag in response["Tags"]]

    while "NextToken" in response:
        response = sagemaker.list_tags(ResourceArn=arn)
        for tag in response["Tags"]:
            tags.append(tag)
    return tags


def list_custom_terminologies_for_project(
    client,
    fetch_all: bool = False,
    paging_options: Optional[Dict[str, str]] = None,
):
    list_of_terminologies = []
    kwargs: Dict[str, Any] = {}
    result: Dict[str, Any] = {
        "records": [],
    }

    if paging_options:
        if "nextToken" in paging_options:
            kwargs["NextToken"] = paging_options["nextToken"]
        if "pageSize" in paging_options:
            kwargs["MaxResults"] = paging_options["pageSize"]

    if fetch_all:
        paginator = client.get_paginator("list_terminologies")
        pages = paginator.paginate(**kwargs)

        for page in pages:
            if "TerminologyPropertiesList" in page:
                for terminology in page["TerminologyPropertiesList"]:
                    list_of_terminologies.append(terminology)
    else:
        response = client.list_terminologies(**kwargs)
        for term in response["TerminologyPropertiesList"]:
            list_of_terminologies.append(term)
        if "NextToken" in response:
            result["nextToken"] = response["NextToken"]

    result["records"] = list_of_terminologies
    return result


def generate_html_response(status_code, response_body):
    return {
        "statusCode": status_code,
        "body": json.dumps(response_body, default=str),
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache",
            "Pragma": "no-cache",
            "Strict-Transport-Security": "max-age:47304000; includeSubDomains",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
        },
    }


def generate_exception_response(e, status_code=400):
    error_msg = str(e)
    if hasattr(e, "response"):  # i.e. validate the exception was from an API call
        metadata = e.response.get("ResponseMetadata")
        if metadata:
            status_code = metadata.get("HTTPStatusCode", 400)

        """
        Codes (required) - What codes to alert on 
        MatchStrings (optional) - What strings to look for in addition to the code. If no match strings are provided, then just the code is used
        FriendlyMessage (required) - Message replacment for the existing error 
        """
        ERROR_DICT = [
            {
                "Codes": ["ResourceInUse", "ValidationException"],
                "MatchStrings": ["Cannot create a duplicate", "already existing", "already exists"],
                "FriendlyMessage": "The resource name you provided already exists. Please choose a different name.",
            },
            {
                "Codes": ["ResourceLimitExceeded"],
                "FriendlyMessage": "You have reached the maximum allowed usage for this resource. Please contact your MLSpace administrator to increase the allowed usage limits.",
            },
            {
                "Codes": ["AccessDeniedException"],
                "FriendlyMessage": "An administrator or owner has restricted access to this resource or this account has hit its service limit for this resource. If you need access or to increase the limits, please contact a system administrator or owner of the resource for assistance.",
            },
        ]

        for errorType in ERROR_DICT:
            if e.response["Error"]["Code"] in errorType["Codes"] and (
                "MatchStrings" not in errorType or any(error in error_msg for error in errorType["MatchStrings"])
            ):
                e = f"{errorType['FriendlyMessage']} Full message: {error_msg}"
                break

        logger.exception(e)
    elif hasattr(e, "http_status_code"):
        status_code = e.http_status_code
        logger.exception(e)
    else:
        if error_msg in ["'requestContext'", "'pathParameters'", "'body'"]:
            e = f"Missing event parameter: {error_msg}"
        else:
            e = f"Bad Request: {error_msg}"
        logger.error(e)
    return generate_html_response(status_code, e)


def generate_tags(user_name: str, project_name: str, system_tag: str, additional_tags: list = None) -> list:
    tags = [
        {"Key": "user", "Value": user_name},
        {"Key": "project", "Value": project_name},
        {"Key": "system", "Value": system_tag},
    ]

    if additional_tags:
        tags.extend(additional_tags)

    return tags


def has_tags(tags: list, user_name: str = None, project_name: str = None, system_tag: str = None) -> bool:
    """
    Checks if the common tags (as created by generate_tags exist in the list of tags.

    Optionally you can provide specific values required for the tags instead of just looking
    for their existence.
    """
    has_user = False
    has_project = False
    has_system = False

    for tag in tags:
        if tag["Key"] == "user":
            if user_name is None or tag["Value"] == user_name:
                has_user = True

        if tag["Key"] == "project":
            if project_name is None or tag["Value"] == project_name:
                has_project = True

        if tag["Key"] == "system":
            if system_tag is None or tag["Value"] == system_tag:
                has_system = True

    return has_user & has_project & has_system


def serialize_permissions(permissions: Optional[List[Permission]]) -> List[str]:
    if permissions:
        return [entry.value for entry in permissions]
    else:
        return []


def total_project_owners(project_user_dao, project_name):
    project_users = project_user_dao.get_users_for_project(project_name)
    owner_count = 0

    for user in project_users:
        if Permission.PROJECT_OWNER in user.permissions:
            owner_count += 1

    return owner_count


def get_notebook_stop_time(stop_time: str) -> int:
    # The default notebook stop time for a project is in HH:MM we need to set the current stop
    # time to the next occurrence of that time. That may mean it stops today ie the default is 17:00
    # and it's currently 09:00 or it may mean we need to set it for tomorrow ie it's currently 19:00
    # but the default is 17:00
    try:
        stop_timestamp = int(
            time.mktime(time.strptime(time.strftime(f"%d %b %Y {stop_time}", time.gmtime()), "%d %b %Y %H:%M"))
        )
        if stop_timestamp <= time.time():
            # Shift the time to the right one day
            stop_timestamp = stop_timestamp + (24 * 60 * 60)
    # If an invalid time was provided log the exception and return a None time
    except ValueError as e:
        logger.exception(e)
        return None

    return stop_timestamp


def query_resource_metadata(resource_metadata_dao, event, resource_type: ResourceType):
    project_name = event["pathParameters"]["projectName"]

    kwargs: Dict[str, Any] = {"limit": 100, "next_token": None}

    if "queryStringParameters" in event and event["queryStringParameters"]:
        if "nextToken" in event["queryStringParameters"]:
            kwargs["next_token"] = event["queryStringParameters"]["nextToken"]
        if "pageSize" in event["queryStringParameters"]:
            kwargs["limit"] = int(event["queryStringParameters"]["pageSize"])
        if "resourceStatus" in event["queryStringParameters"]:
            states = [event["queryStringParameters"]["resourceStatus"]]
            expressions = []
            filter_values = {}
            for i in range(len(states)):
                expression_key = f":s{i}"
                expressions.append(expression_key)
                filter_values[expression_key] = states[i]

            if resource_type == ResourceType.EMR_CLUSTER:
                kwargs["filter_expression"] = f"metadata.#s IN ({', '.join(expressions)})"
                kwargs["filter_values"] = filter_values
                kwargs["expression_names"] = {"#s": "Status"}
            elif resource_type == ResourceType.TRAINING_JOB:
                kwargs["filter_expression"] = f"metadata.TrainingJobStatus IN ({', '.join(expressions)})"
                kwargs["filter_values"] = filter_values

    response = {"records": []}
    job_metadata = resource_metadata_dao.get_all_for_project_by_type(project_name, resource_type, **kwargs)
    if job_metadata.next_token:
        response["nextToken"] = job_metadata.next_token
    response["records"] = [record.to_dict() for record in job_metadata.records]
    return response
