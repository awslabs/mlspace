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
import time
import urllib
from typing import Any, Dict, Optional, Tuple

import jwt
import urllib3

from ml_space_lambda.data_access_objects.dataset import DatasetDAO
from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetDAO
from ml_space_lambda.data_access_objects.group_user import GroupUserDAO
from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.data_access_objects.user import UserDAO, UserModel
from ml_space_lambda.enums import DatasetType, Permission, ResourceType
from ml_space_lambda.utils.app_config_utils import get_app_config
from ml_space_lambda.utils.common_functions import authorization_wrapper

logger = logging.getLogger(__name__)

project_user_dao = ProjectUserDAO()
project_dao = ProjectDAO()
user_dao = UserDAO()
dataset_dao = DatasetDAO()
resource_metadata_dao = ResourceMetadataDAO()
group_user_dao = GroupUserDAO()
group_dataset_dao = GroupDatasetDAO()

oidc_keys: Dict[str, str] = {}
# If using self signed certs on the OIDC endpoint we need to skip ssl verification
http = urllib3.PoolManager(
    num_pools=2,
    cert_reqs="CERT_NONE" if os.getenv("OIDC_VERIFY_SSL", "True").lower() == "false" else "CERT_REQUIRED",
)


@authorization_wrapper
def lambda_handler(event, context):
    response_context: Dict[str, Any] = {}
    policy_statement = {
        "Action": "execute-api:Invoke",
        "Effect": "Deny",
        "Resource": event["methodArn"],
    }

    requested_resource = event["resource"]
    path_params = event["pathParameters"]
    request_method = event["httpMethod"]

    logger.info(
        f"Determining access for Resource: {requested_resource} "
        f"- PathParams: {json.dumps(path_params) if path_params else 'N/A'} "
        f"- Method: {request_method}"
    )

    if requested_resource == "/app-config" and request_method == "GET":
        # Anyone can get the app config
        policy_statement["Effect"] = "Allow"
        return {
            "principalId": "Unknown",
            "policyDocument": {"Version": "2012-10-17", "Statement": [policy_statement]},
            "context": response_context,
        }

    client_token = None
    token_failure = False
    auth_header = None

    if "authorization" in event["headers"]:
        auth_header = event["headers"]["authorization"].split(" ")
    if "Authorization" in event["headers"]:
        auth_header = event["headers"]["Authorization"].split(" ")

    if auth_header and len(auth_header) == 2:
        client_token = auth_header[1]

    if not client_token:
        logging.info("Access Denied. No authentication token provided.")
        token_failure = True

    if client_token and not token_failure:
        # Decode token based on public key
        verify_token = os.getenv("OIDC_VERIFY_SIGNATURE", "true").lower()
        if verify_token != "false":
            try:
                # Grab public key id from token
                token_headers = jwt.get_unverified_header(client_token)
                [public_key, client_name] = _get_oidc_props(token_headers["kid"])
                token_info = jwt.decode(client_token, public_key, audience=client_name, algorithms=["RS256"])
            except Exception as e:
                logging.exception(e)
                logging.info("Access Denied. Encountered error validating supplied authentication token.")
                token_failure = True
        else:
            try:
                token_info = jwt.decode(client_token, options={"verify_signature": False})
            except Exception as e:
                logging.exception(e)
                logging.info("Access Denied. Encountered error decoding supplied authentication token.")
                token_failure = True

    if token_failure:
        return {
            "principalId": "Unknown",
            "policyDocument": {"Version": "2012-10-17", "Statement": [policy_statement]},
            "context": response_context,
        }

    username = urllib.parse.unquote(token_info["preferred_username"]).replace(",", "-").replace("=", "-").replace(" ", "-")

    # Only run through the auth logic if the token has not yet expired
    if token_info["exp"] > time.time():
        # Look up user record
        user = user_dao.get(username)

        if requested_resource == "/user" and request_method == "POST":
            logger.info("Attempting to create new user account...")
            # Anyone can create a user account
            policy_statement["Effect"] = "Allow"
        elif not user:
            logger.info(f"Access Denied. Unknown user: '{username}'")
        elif user.suspended:
            if (requested_resource == "/login" and request_method == "PUT") or (
                requested_resource == "/current-user" and request_method == "GET"
            ):
                logger.info(f"User: '{username}' is currently suspended. Only login/current-user is allowed.")
                policy_statement["Effect"] = "Allow"
            else:
                logger.info(f"Access Denied. User: '{username}' is currently suspended.")
        else:
            # Check route access restrictions
            response_context = {"user": json.dumps(user.to_dict())}

            # Create/Download/Delete/List Reports
            if (
                requested_resource.startswith("/report")
                and Permission.ADMIN in user.permissions
                and request_method in ["GET", "DELETE", "POST"]
            ):
                policy_statement["Effect"] = "Allow"
            # If the route has path params then we need to check project membership/resource ownership
            elif path_params:
                # Updating / deleting a user requires admin privileges or the user
                # making the request must be the user getting updated
                if (
                    requested_resource.startswith("/user/")
                    and "username" in path_params
                    and request_method in ["GET", "PUT", "DELETE"]
                ):
                    if Permission.ADMIN in user.permissions:
                        policy_statement["Effect"] = "Allow"
                    elif path_params["username"] == user.username and request_method == "PUT":
                        # Users can update their own account preferences
                        policy_statement["Effect"] = "Allow"
                    else:
                        logger.info(f"Access Denied. User: '{username}' does not have permission to modify users.")
                # Path params need to be checked individually
                elif "projectName" in path_params:
                    project_name = path_params["projectName"]
                    project_user = project_user_dao.get(project_name, username)
                    # User must belong to the project for any project specific resources
                    if project_user or Permission.ADMIN in user.permissions:
                        # User must be an owner or admin to add/remove users or update the project config
                        if (
                            (
                                request_method == "POST"
                                and (requested_resource.endswith("/users") or requested_resource.endswith("/app-config"))
                            )
                            or (request_method in ["PUT", "DELETE"] and len(path_params) == 2 and "username" in path_params)
                        ) and (
                            (project_user and Permission.PROJECT_OWNER not in project_user.permissions)
                            and Permission.ADMIN not in user.permissions
                        ):
                            logging.info(
                                f"Access Denied. User: '{username}' does not have project user management permissions."
                            )
                        # User must be a project owner to delete/update a project
                        elif (
                            len(path_params) == 1
                            and request_method in ["PUT", "DELETE"]
                            and (
                                (project_user and Permission.PROJECT_OWNER not in project_user.permissions)
                                and Permission.ADMIN not in user.permissions
                            )
                        ):
                            logging.info(f"Access Denied. User: '{username}' does not have project management permission.")
                        # Check if there is a second param here and we're updating users...
                        else:
                            policy_statement["Effect"] = "Allow"
                elif "clusterId" in path_params:
                    try:
                        if _handle_emr_request(request_method, path_params, user, response_context):
                            policy_statement["Effect"] = "Allow"
                    except Exception as e:
                        logging.exception(e)
                        logging.info("Access Denied. Encountered error while determining EMR access policy.")
                elif "notebookName" in path_params:
                    try:
                        if _handle_notebook_request(
                            requested_resource,
                            request_method,
                            path_params,
                            user,
                            response_context,
                        ):
                            policy_statement["Effect"] = "Allow"
                    except Exception as e:
                        logging.exception(e)
                        logging.info("Access Denied. Encountered error while determining notebook access policy.")
                elif "scope" in path_params:
                    if "datasetName" in path_params:
                        try:
                            if _handle_dataset_request(
                                request_method,
                                path_params,
                                user,
                            ):
                                policy_statement["Effect"] = "Allow"
                        except Exception as e:
                            logging.exception(e)
                            logging.info("Access Denied. Encountered error while determining dataset access policy.")
                elif "jobId" in path_params:
                    if Permission.ADMIN in user.permissions:
                        policy_statement["Effect"] = "Allow"
                    else:
                        job = resource_metadata_dao.get(path_params["jobId"], ResourceType.BATCH_TRANSLATE_JOB)
                        response_context["projectName"] = job.project
                        project_user = project_user_dao.get(job.project, user.username)
                        if project_user and Permission.PROJECT_OWNER in project_user.permissions:
                            policy_statement["Effect"] = "Allow"
                        else:
                            if job.user == user.username and project_user:
                                policy_statement["Effect"] = "Allow"
                            elif request_method == "POST":
                                logging.info(
                                    f"Access Denied. User: '{user.username}' does not have permission to stop this job."
                                )
                            elif request_method == "GET":
                                # if user is part of the project, they can view this translate job
                                if project_user:
                                    policy_statement["Effect"] = "Allow"
                elif "groupName" in path_params:
                    if Permission.ADMIN in user.permissions and request_method in ["POST", "PUT", "DELETE"]:
                        policy_statement["Effect"] = "Allow"
                    elif request_method == "GET":
                        policy_statement["Effect"] = "Allow"
                else:
                    # All other sagemaker resources have the same general handling, GET calls
                    # typically require ADMIN or project membership, PUT/POST/DELETE typically
                    # require ADMIN or ownership of the resource. Additional comments for
                    # decisions can be found in the _allow_project_resources_read method.
                    job_type = ""
                    if (
                        requested_resource.endswith("/logs")
                        and "/notebook" not in requested_resource
                        and "/endpoint" not in requested_resource
                    ):
                        job_type = path_params["jobType"]

                    try:
                        if _allow_project_resource_action(
                            user,
                            request_method,
                            path_params,
                            requested_resource,
                            response_context,
                            job_type,
                        ):
                            policy_statement["Effect"] = "Allow"
                    except Exception as e:
                        logging.exception(e)
                        logging.info("Access Denied. Encountered error while determining resource access policy.")
            elif requested_resource == "/app-config" and request_method == "POST" and Permission.ADMIN in user.permissions:
                # Operations for app-wide configuration can only be performed by admins
                policy_statement["Effect"] = "Allow"
            elif requested_resource == "/login" and request_method == "PUT":
                policy_statement["Effect"] = "Allow"
            elif (
                (requested_resource == "/config" and request_method == "GET") or requested_resource.startswith("/admin/")
            ) and Permission.ADMIN in user.permissions:
                policy_statement["Effect"] = "Allow"
            elif requested_resource == "/project" and request_method == "POST":
                if Permission.ADMIN in user.permissions:
                    policy_statement["Effect"] = "Allow"
                else:
                    # Get the latest app config
                    app_config = get_app_config()
                    # Check if project creation is admin only; if not, anyone can create a project
                    if not app_config.configuration.project_creation.admin_only:
                        policy_statement["Effect"] = "Allow"
            elif requested_resource == "/group" and request_method == "POST":
                if Permission.ADMIN in user.permissions:
                    policy_statement["Effect"] = "Allow"
            elif requested_resource in ["/dataset/presigned-url", "/dataset/create"]:
                # If this is a request for a dataset related presigned url or for
                # creating a new dataset, we need to determine the underlying dataset
                # and whether the user should have access to it
                if "x-mlspace-dataset-type" in event["headers"] and "x-mlspace-dataset-scope" in event["headers"]:
                    target_type = event["headers"]["x-mlspace-dataset-type"]
                    target_scope = event["headers"]["x-mlspace-dataset-scope"]
                    if target_type == DatasetType.GLOBAL:
                        policy_statement["Effect"] = "Allow"
                    elif target_type == DatasetType.PROJECT:
                        if Permission.ADMIN in user.permissions:
                            policy_statement["Effect"] = "Allow"
                        else:
                            project_user = project_user_dao.get(target_scope, username)
                            if project_user:
                                policy_statement["Effect"] = "Allow"
                    elif target_type == DatasetType.PRIVATE and username == target_scope:
                        policy_statement["Effect"] = "Allow"
                    elif target_type == DatasetType.GROUP:
                        if Permission.ADMIN in user.permissions:
                            policy_statement["Effect"] = "Allow"
                        else:
                            # target_scope is the dataset name for a group, so look up if this user
                            # is a member of a group that can upload files to this dataset
                            group_dataset = dataset_dao.get(DatasetType.GROUP, target_scope)
                            if group_dataset:
                                groups = group_user_dao.get_groups_for_user(username)
                                for group in groups:
                                    dataset = group_dataset_dao.get(group.group, target_scope)
                                    if dataset:
                                        policy_statement["Effect"] = "Allow"
                                        break
                            else:
                                # dataset doesn't exist yet so this is a create. Check if the user is
                                # in the group they're creating a dataset for
                                group_user = group_user_dao.get(target_scope, username)
                                if group_user:
                                    policy_statement["Effect"] = "Allow"
                else:
                    logger.info(
                        "Missing one or more required headers 'x-mlspace-dataset-type', "
                        " 'x-mlspace-dataset-scope' for request."
                    )
            elif (
                requested_resource in ["/metadata/find-public-amis"] or requested_resource.startswith("/translate/realtime")
            ) and request_method == "POST":
                policy_statement["Effect"] = "Allow"
            elif (
                requested_resource
                in [
                    "/notebook",
                    "/endpoint",
                    "/model",
                    "/endpoint-config",
                    "/emr",
                    "/batch-translate",
                ]
                or requested_resource.startswith("/job/")
            ) and request_method == "POST":
                # If a user is attempting to create a job, notebook, endpoint,
                # endpoint-config, or model we need to inspect the request to
                # determining what project they're
                # creating the job within the scope of
                if "x-mlspace-project" in event["headers"]:
                    project_name = event["headers"]["x-mlspace-project"]
                    project_user = project_user_dao.get(project_name, username)
                    if project_user:
                        policy_statement["Effect"] = "Allow"
                else:
                    logger.info("Missing required header 'x-mlspace-project' for request.")
            elif (
                requested_resource
                in [
                    "/notebook",
                    "/dataset",
                    "/current-user",
                    "/user",
                    "/model/images",
                    "/metadata/compute-types",
                    "/metadata/notebook-options",
                    "/metadata/subnets",
                    "/translate/list-languages",
                    "/project",
                    "/group",
                    "/emr",
                    "/emr/applications",
                    "/emr/release",
                    "/translate/custom-terminologies",
                ]
            ) and request_method == "GET":
                # None of these paths require specific permissions, most will be scoped
                # to the current user or don't care about the user at al (metadata related)
                policy_statement["Effect"] = "Allow"
            else:
                logger.info("Unhandled route. Access denied by default.")
    else:
        logger.info(f"Access Denied. Token is expired for user: '{username}'.")

    return {
        "principalId": username,
        "policyDocument": {"Version": "2012-10-17", "Statement": [policy_statement]},
        "context": response_context,
    }


def _handle_dataset_request(request_method, path_params, user):
    # Grab dataset based on scope and name. If the method is DELETE then the user
    # needs to own the data source. If the dataset is scoped to a project
    # ensure the user has access to the project. If it's global allow the user
    # access. If it's a private dataset then the username has to match the dataset
    # owner.
    dataset_scope = path_params["scope"]
    dataset_name = path_params["datasetName"]
    dataset = dataset_dao.get(dataset_scope, dataset_name)
    if dataset:
        # Owners can do whatever - this check also handles private datasets
        if dataset.created_by == user.username:
            return True
        else:
            # All admins can perform any action on any Group
            if dataset.type == DatasetType.GROUP:
                if Permission.ADMIN in user.permissions:
                    return True
                group_user = group_user_dao.get(dataset_scope, user.username)
                # Non-admins can only view group datasets
                if group_user and request_method not in ["PUT", "DELETE"]:
                    return True
            # If it's a global or project dataset and they aren't the owner
            # they can't update or delete the dataset or any files
            elif request_method in ["PUT", "DELETE"]:
                logger.info(f"Access Denied. User: '{user.username}' does not own the specified dataset.")
            elif dataset.type == DatasetType.GLOBAL:
                # If it's not a delete or update but it's a global dataset
                # then all users should have access
                return True
            elif dataset.type == DatasetType.PROJECT:
                # It's a project dataset so the user needs access to the project
                project_user = project_user_dao.get(dataset_scope, user.username)
                if project_user:
                    return True

    logger.info("Access Denied. The specified dataset does not exist or the user does not have access.")
    return False


def _handle_emr_request(
    request_method: str,
    path_params: Dict[str, str],
    user: UserModel,
    response_context: Dict[str, Any],
) -> bool:
    cluster_id = path_params["clusterId"]

    owner = None
    project_name = None
    cluster = resource_metadata_dao.get(cluster_id, ResourceType.EMR_CLUSTER)

    if cluster:
        project_name = cluster.project
        owner = cluster.user

    if project_name:
        response_context["projectName"] = project_name
        if Permission.ADMIN in user.permissions:
            return True
        else:
            project_user = project_user_dao.get(project_name, user.username)
            if project_user:
                if request_method != "GET" and not (
                    owner == user.username or Permission.PROJECT_OWNER in project_user.permissions
                ):
                    logger.info(
                        "Access Denied. Only the owner of the cluster or the owner of the associated project may take the requested action."
                    )
                    return False
                return True
            else:
                logger.info(
                    f"Access Denied. User: '{user.username}' does not belong to the project to "
                    "which the EMR Cluster is associated or does not have the ability to take the "
                    "requested action."
                )
                return False
    logger.info("Unable to determining EMR Cluster access rights.")
    return False


def _handle_notebook_request(
    requested_resource: str,
    request_method: str,
    path_params: Dict[str, str],
    user: UserModel,
    response_context: Dict[str, Any],
) -> bool:
    # They need to be an Admin, Project Owner, or the creator in order to delete/stop/update
    # only an owner can start/launch the instances. In order to determine their permissions
    # for the project we need to figure out which project the notebook is associated with...
    # previously this was done using a route param but there was nothing stopping someone
    # from specifying a project in the path that they had ownership on and a notebook name that
    # belonged to a totally different project so instead we grab the notebook first.
    notebook_instance_name = path_params["notebookName"]

    notebook_metadata = resource_metadata_dao.get(notebook_instance_name, ResourceType.NOTEBOOK)
    if notebook_metadata:
        is_launch_or_start_request = requested_resource.endswith("/url") or requested_resource.endswith("/start")
        response_context["projectName"] = notebook_metadata.project
        # Starting and launching a notebook relies on the project not being suspended and the
        # requesting user being an owner of the notebook
        if is_launch_or_start_request:
            project = project_dao.get(notebook_metadata.project)
            msg = "Access Denied. The user does not have the permissions required to take the requested action."
            if not project or project.suspended:
                msg = "Access Denied. The project associated with the notebook has been suspended."
            elif notebook_metadata.user != user.username:
                msg = "Access Denied. Only the owner of the requested notebook may start or launch the notebook."
            if project and not project.suspended and notebook_metadata.user == user.username:
                # Users must still be associated with the project that the notebook is associated
                # with in order to take action on the resource
                project_user = project_user_dao.get(notebook_metadata.project, user.username)
                if project_user:
                    return True
                msg = "Access Denied. The notebook owner is no longer a member of the associated project."

            logger.info(msg)
        elif Permission.ADMIN in user.permissions:
            return True
        else:
            project_user = project_user_dao.get(notebook_metadata.project, user.username)
            msg = (
                f"Access Denied. User: '{user.username}' does not belong to the project to "
                "which the notebook is associated or does not have the ability to take the "
                "requested action."
            )
            if project_user:
                if Permission.PROJECT_OWNER in project_user.permissions:
                    return True

                project = project_dao.get(notebook_metadata.project)

                if not project or project.suspended:
                    msg = "Access Denied. The project associated with the notebook has been suspended."
                elif request_method == "GET" or notebook_metadata.user == user.username:
                    return True
                else:
                    msg = "Access Denied. Only the owner of the notebook or the owner of the associated project may take the requested action."

            logger.info(msg)
    return False


def _allow_project_resource_action(
    user: UserModel,
    method: str,
    path_params: Dict[str, str],
    requested_resource: str,
    response_context: Dict[str, Any],
    job_type: str = "",
) -> bool:
    resource_name = None
    resource_type = None
    resource_metadata = None
    project_name = None
    owner = None

    if requested_resource.endswith("/logs") and method != "GET":
        return False

    if "endpointName" in path_params:
        resource_metadata = resource_metadata_dao.get(path_params["endpointName"], ResourceType.ENDPOINT)
    if "endpointConfigName" in path_params:
        resource_metadata = resource_metadata_dao.get(path_params["endpointConfigName"], ResourceType.ENDPOINT_CONFIG)
    if "modelName" in path_params:
        resource_metadata = resource_metadata_dao.get(path_params["modelName"], ResourceType.MODEL)
    if "jobName" in path_params:
        # The only POST actions for jobs are stopping them. In order to stop a job you have to be an
        # admin, owner, or an owner of the project associated with the job. Performing a GET to
        # describe a job requires the user belong to the associated project. There are no PUT
        # actions for jobs.
        if Permission.ADMIN in user.permissions:
            return True
        resource_name = path_params["jobName"]
        if requested_resource.startswith("/job/transform") or job_type == "TransformJobs":
            resource_metadata = resource_metadata_dao.get(resource_name, ResourceType.TRANSFORM_JOB)
        elif requested_resource.startswith("/job/training") or job_type == "TrainingJobs":
            resource_metadata = resource_metadata_dao.get(resource_name, ResourceType.TRAINING_JOB)
        elif requested_resource.startswith("/job/hpo"):
            resource_metadata = resource_metadata_dao.get(resource_name, ResourceType.HPO_JOB)
        elif requested_resource.startswith("/job/labeling") or job_type == "LabelingJobs":
            resource_metadata = resource_metadata_dao.get(resource_name, ResourceType.LABELING_JOB)

    project_name = resource_metadata.project
    owner = resource_metadata.user
    response_context["projectName"] = project_name

    # Admins are allowed to take any action against existing non-notebook SageMaker resource.
    # They are not allowed to create new resources though unless they are a member of the project
    # so POST actions are excluded in this particular check.
    # Notebook permissions are handled in _handle_notebook_request.
    if Permission.ADMIN in user.permissions and method != "POST":
        return True

    project_user = project_user_dao.get(project_name, user.username)
    if method != "GET":
        # Any delete or update actions require the user to be a project owner or the owner
        # of the resource being acted upon
        if project_user and (owner == user.username or Permission.PROJECT_OWNER in project_user.permissions):
            return True
        logger.info(f"Access Denied. User: '{user.username}' does not own the requested {resource_type}.")
    elif project_user:
        return True

    logger.info(
        f"Access Denied. User: '{user.username}' does not belong to the project to which the {resource_type} is associated."
    )

    return False


def _get_oidc_props(key_id: str) -> Tuple[Optional[str], Optional[str]]:
    oidc_client_name = os.getenv("OIDC_CLIENT_NAME")

    global oidc_keys
    if key_id not in oidc_keys:
        oidc_endpoint = os.getenv("OIDC_URL")
        if not oidc_client_name or not oidc_endpoint:
            logging.error(
                "Unable to retrieve OIDC configuration. Please ensure the environment " "variables are properly configured"
            )
            raise ValueError("Missing OIDC environment variables.")
        # Grab cert endpoint from well known config
        response = http.request("GET", f"{oidc_endpoint}/.well-known/openid-configuration")
        well_known_config = json.loads(response.data.decode("utf-8"))
        if "jwks_uri" not in well_known_config:
            logging.error("Unable to retrieve OIDC configuration. JWKS_URI not found in well known config.")
            raise ValueError("Missing JWKS_URI.")
        # Grab certs from jwks_uri endpoint
        jwks_response = http.request("GET", f"{well_known_config['jwks_uri']}")
        key_data = json.loads(jwks_response.data.decode("utf-8"))
        for key in key_data["keys"]:
            oidc_keys[key["kid"]] = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))

    if key_id not in oidc_keys:
        logging.info(f"Unable to finding matching OIDC public key for id '{key_id}'.")
        raise ValueError("Missing OIDC configuration parameters.")

    return (oidc_keys[key_id], oidc_client_name)
