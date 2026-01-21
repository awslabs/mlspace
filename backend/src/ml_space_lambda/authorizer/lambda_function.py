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
import urllib.parse
from typing import Any, Dict, Optional

from ml_space_lambda.auth.session.manager import SessionManager
from ml_space_lambda.auth.session.validator import SessionValidator
from ml_space_lambda.auth.utils.cookies import get_cookie_value
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
from ml_space_lambda.utils.project_utils import is_member_of_project, is_owner_of_project

logger = logging.getLogger(__name__)

project_user_dao = ProjectUserDAO()
project_dao = ProjectDAO()
user_dao = UserDAO()
dataset_dao = DatasetDAO()
resource_metadata_dao = ResourceMetadataDAO()
group_user_dao = GroupUserDAO()
group_dataset_dao = GroupDatasetDAO()

# Session manager for validating session cookies
_session_manager: Optional[SessionManager] = None


def _get_session_manager() -> SessionManager:
    """
    Get or create session manager instance.

    Returns:
        SessionManager instance

    Raises:
        Exception: If session manager cannot be created
    """
    global _session_manager

    if _session_manager is None:
        # Get configuration from environment variables
        session_table_name = os.environ.get("AUTH_SESSION_TABLE_NAME")
        token_encryption_key_secret_name = os.environ.get("AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME")

        if not session_table_name:
            raise Exception("AUTH_SESSION_TABLE_NAME environment variable is required")

        if not token_encryption_key_secret_name:
            raise Exception("AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME environment variable is required")

        # Create token encryption instance
        try:
            # Always expect versioned format - use VersionedKeyManager
            from ml_space_lambda.auth.session.key_manager import VersionedKeyManager, VersionedTokenEncryption

            key_manager = VersionedKeyManager(secret_arn=token_encryption_key_secret_name, key_type="token")
            token_encryption = VersionedTokenEncryption(key_manager)

        except Exception as e:
            logger.error(f"Failed to create token encryption: {e}")
            raise Exception(f"Failed to initialize token encryption: {e}")

        # Create session manager
        try:
            _session_manager = SessionManager(table_name=session_table_name, encryption=token_encryption)
        except Exception as e:
            logger.error(f"Failed to create session manager: {e}")
            raise Exception(f"Failed to initialize session manager: {e}")

    return _session_manager


def _validate_session_cookie(event: Dict[str, Any]) -> Optional[Dict]:
    """
    Validate session cookie from request headers.

    Args:
        event: Lambda event containing request headers

    Returns:
        Session data if valid, None otherwise
    """
    try:
        # Extract session cookie from headers
        cookie_header = None
        if "cookie" in event.get("headers", {}):
            cookie_header = event["headers"]["cookie"]
        elif "Cookie" in event.get("headers", {}):
            cookie_header = event["headers"]["Cookie"]

        if not cookie_header:
            logger.info("No cookie header found in request")
            return None

        # Extract session ID from cookie
        session_id = get_cookie_value(cookie_header, "mlspace_session")
        if not session_id:
            logger.info("No mlspace_session cookie found")
            return None

        # Validate session ID format
        if not session_id.startswith("session:"):
            logger.info(f"Invalid session ID format: {session_id}")
            return None

        # Get session manager and validate session
        session_manager = _get_session_manager()
        session_data = session_manager.get_session(session_id)

        if not session_data:
            logger.info(f"Session not found or expired: {session_id}")
            return None

        # Validate session structure
        is_valid, error_message = SessionValidator.validate_session_data(session_data)
        if not is_valid:
            logger.info(f"Invalid session data: {error_message}")
            return None

        logger.info(f"Session validated successfully for user: {session_data['data']['user']['id']}")
        return session_data

    except Exception as e:
        logger.error(f"Error validating session cookie: {e}")
        return None


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

    # Validate session cookie
    session_data = _validate_session_cookie(event)

    if not session_data:
        logger.info("Access Denied. No valid session found.")
        return {
            "principalId": "Unknown",
            "policyDocument": {"Version": "2012-10-17", "Statement": [policy_statement]},
            "context": response_context,
        }

    # Extract user information from session
    user_data = session_data["data"]["user"]
    username = user_data["id"]

    # Normalize username for AWS IAM principal ID compatibility
    # Replace special characters that aren't allowed in principal IDs
    username = urllib.parse.unquote(username).replace(",", "-").replace("=", "-").replace(" ", "-")

    # Look up user record from database to get permissions and suspension status
    user = user_dao.get(username)

    if not user:
        # User doesn't exist in database - this shouldn't happen in normal flow
        # but we'll create a minimal user object for authorization
        logger.warning(f"User {username} found in session but not in database")
        user = UserModel(
            username=username,
            email=user_data["email"],
            display_name=user_data["displayName"],
            permissions=[],  # No permissions if not in database
            suspended=False,  # Session existence implies user is not suspended
        )

    IS_ADMIN = Permission.ADMIN in user.permissions if user else False

    if requested_resource.startswith("/auth"):
        logger.info("Accessing auth API...")
        # Anyone can create a user account
        policy_statement["Effect"] = "Allow"
    # users are now created as part of the login process
    # elif requested_resource == "/user" and request_method == "POST":
    #     logger.info("Attempting to create new user account...")
    #     # Anyone can create a user account
    #     policy_statement["Effect"] = "Allow"
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
        if requested_resource.startswith("/report") and IS_ADMIN and request_method in ["GET", "DELETE", "POST"]:
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
                if IS_ADMIN:
                    policy_statement["Effect"] = "Allow"
                elif path_params["username"] == user.username and request_method == "PUT":
                    # Users can update their own account preferences
                    policy_statement["Effect"] = "Allow"
                else:
                    logger.info(f"Access Denied. User: '{username}' does not have permission to modify users.")
            # Path params need to be checked individually
            elif "projectName" in path_params:
                project_name = path_params["projectName"]
                # User must belong to the project for any project specific resources
                if IS_ADMIN or is_member_of_project(user.username, project_name):
                    IS_OWNER = is_owner_of_project(user.username, project_name)
                    project_user = project_user_dao.get(project_name, username)
                    # User must be an owner or admin to add/remove users or update the project config
                    if (
                        (
                            request_method == "POST"
                            and (
                                requested_resource.endswith("/users")
                                or requested_resource.endswith("/groups")
                                or requested_resource.endswith("/app-config")
                            )
                        )
                        or (
                            request_method in ["PUT", "DELETE"]
                            and len(path_params) == 2
                            and ("username" in path_params or "groupName" in path_params)
                        )
                    ) and (project_user and not IS_OWNER and not IS_ADMIN):
                        logging.info(f"Access Denied. User: '{username}' does not have project user management permissions.")
                    # User must be a project owner to delete/update a project
                    elif (
                        len(path_params) == 1
                        and request_method in ["PUT", "DELETE"]
                        and (project_user and not IS_OWNER and not IS_ADMIN)
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
                if IS_ADMIN:
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
                            logging.info(f"Access Denied. User: '{user.username}' does not have permission to stop this job.")
                        elif request_method == "GET":
                            # if user is part of the project, they can view this translate job
                            if project_user:
                                policy_statement["Effect"] = "Allow"
            elif "groupName" in path_params:
                is_group_member = _is_group_member(path_params["groupName"], username)
                if IS_ADMIN:
                    policy_statement["Effect"] = "Allow"
                elif request_method == "GET" and is_group_member:
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
        elif requested_resource == "/app-config" and request_method == "POST" and IS_ADMIN:
            # Operations for app-wide configuration can only be performed by admins
            policy_statement["Effect"] = "Allow"
        elif requested_resource == "/login" and request_method == "PUT":
            policy_statement["Effect"] = "Allow"
        elif (
            (requested_resource == "/config" and request_method == "GET") or requested_resource.startswith("/admin/")
        ) and IS_ADMIN:
            policy_statement["Effect"] = "Allow"
        elif requested_resource == "/project" and request_method == "POST":
            if IS_ADMIN:
                policy_statement["Effect"] = "Allow"
            else:
                # Get the latest app config
                app_config = get_app_config()
                # Check if project creation is admin only; if not, anyone can create a project
                if not app_config.configuration.project_creation.admin_only:
                    policy_statement["Effect"] = "Allow"
        elif requested_resource == "/group" and request_method == "POST":
            if IS_ADMIN:
                policy_statement["Effect"] = "Allow"
        elif requested_resource in ["/dataset/presigned-url", "/dataset/create"]:
            # If this is a request for a dataset related presigned url or for
            # creating a new dataset, we need to determine the underlying dataset
            # and whether the user should have access to it
            if "x-mlspace-dataset-type" in event["headers"] and "x-mlspace-dataset-scope" in event["headers"]:
                target_type = event["headers"]["x-mlspace-dataset-type"]
                target_scope = event["headers"]["x-mlspace-dataset-scope"]
                if IS_ADMIN:
                    policy_statement["Effect"] = "Allow"
                elif target_type == DatasetType.GLOBAL:
                    policy_statement["Effect"] = "Allow"
                elif target_type == DatasetType.PROJECT:
                    project_user = project_user_dao.get(target_scope, username)
                    if project_user:
                        policy_statement["Effect"] = "Allow"
                    else:
                        project_user = project_user_dao.get(target_scope, username)
                        if project_user:
                            policy_statement["Effect"] = "Allow"
                elif target_type == DatasetType.PRIVATE and username == target_scope:
                    policy_statement["Effect"] = "Allow"
                elif target_type == DatasetType.GROUP:
                    user_groups = group_user_dao.get_groups_for_user(username)
                    user_group_names = set()
                    for user_group in user_groups:
                        user_group_names.add(user_group.group)

                    if requested_resource == "/dataset/create":
                        groups = target_scope.split(",")
                        # check that this user is a member of every group they're adding to the group dataset
                        is_valid_group_list = True
                        for group_names in user_group_names:
                            if group_names not in groups:
                                is_valid_group_list = False
                        if is_valid_group_list:
                            policy_statement["Effect"] = "Allow"
                    elif requested_resource == "/dataset/presigned-url":
                        groups = group_dataset_dao.get_groups_for_dataset(target_scope)
                        for group in groups:
                            # validate the user is a member of at least one group associated with this dataset
                            if group.group in user_group_names:
                                policy_statement["Effect"] = "Allow"
                                break

            else:
                logger.info(
                    "Missing one or more required headers 'x-mlspace-dataset-type', " " 'x-mlspace-dataset-scope' for request."
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
        # Owners and Admins can do whatever - this check also handles private datasets
        if dataset.created_by == user.username or Permission.ADMIN in user.permissions:
            return True
        else:
            # All admins can perform any action on any Group
            if (
                dataset.type == DatasetType.GROUP or dataset.type == DatasetType.GLOBAL or request_method == "GET"
            ) and Permission.ADMIN in user.permissions:
                return True
            elif dataset.type == DatasetType.GROUP:
                # If user isn't the creator of the dataset or an admin they can never PUT or DELETE
                if request_method in ["PUT", "DELETE"]:
                    return False
                groups = group_user_dao.get_groups_for_user(user.username)
                # Check if any groups this user is a member of contain this group dataset
                for group in groups:
                    group_dataset = group_dataset_dao.get(group.group, dataset_name)
                    if group_dataset:
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


def _is_group_member(group_name: str, username: str) -> bool:
    group = group_user_dao.get(group_name, username)
    if group:
        return True
    return False
