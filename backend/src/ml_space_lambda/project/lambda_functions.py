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
import re
from collections import Counter
from typing import List, Optional

import boto3
from cachetools.func import ttl_cache

from ml_space_lambda.data_access_objects.dataset import DatasetDAO
from ml_space_lambda.data_access_objects.project import ProjectDAO, ProjectModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO, ProjectUserModel
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.data_access_objects.user import UserDAO, UserModel
from ml_space_lambda.enums import DatasetType, Permission, ResourceType
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    list_clusters_for_project,
    retry_config,
    serialize_permissions,
    total_project_owners,
)
from ml_space_lambda.utils.exceptions import ResourceNotFound
from ml_space_lambda.utils.iam_manager import IAMManager
from ml_space_lambda.utils.mlspace_config import get_environment_variables

project_user_dao = ProjectUserDAO()
resource_metadata_dao = ResourceMetadataDAO()
project_dao = ProjectDAO()
dataset_dao = DatasetDAO()
user_dao = UserDAO()
iam_manager = IAMManager()

logger = logging.getLogger(__name__)

sagemaker = boto3.client("sagemaker", config=retry_config)
emr = boto3.client("emr", config=retry_config)
s3 = boto3.client("s3", config=retry_config)
translate = boto3.client("translate", config=retry_config)

project_name_regex = re.compile(r"[^a-zA-Z0-9]")
project_desc_regex = re.compile(r"/[^ -~]/")
project_deny_list = ["global", "project", "private", "global-read-only", "logs", "create"]


def _validate_input(input: str, max_length: int, field: str) -> None:
    if len(input) > max_length:
        logging.error(f"Project {field} with length {len(input)} is over the max length of {max_length}")
        raise Exception(f"Project {field} exceeded the maximum allowable length of {max_length}.")

    # Input validation: projectName must not have dashes
    invalid_char_found = project_name_regex.search(input) if field == "name" else project_desc_regex.search(input)

    if invalid_char_found:
        logging.error(f"Invalid characters in project {field}: {invalid_char_found}")
        raise Exception(f"Project {field} contains invalid character.")


def _add_project_user(project_name: str, username: str, permissions: Optional[List[Permission]] = None):
    env_variables = get_environment_variables()
    iam_role_arn = None
    if env_variables["MANAGE_IAM_ROLES"]:
        iam_role_arn = iam_manager.add_iam_role(project_name, username)

    if not user_dao.get(username):
        raise ValueError("Username specified is not associated with an active user.")
    try:
        project_user = ProjectUserModel(
            project_name=project_name,
            username=username,
            permissions=permissions,
            role=iam_role_arn,
        )
        project_user_dao.create(project_user)
    except Exception as e:
        if iam_role_arn:
            # Remove IAM role
            iam_manager.remove_project_user_roles([iam_role_arn])
        raise e


@ttl_cache(ttl=60)
def _get_resource_counts(project_name):
    resource_counts = {}
    for resource_type in ResourceType:
        # if resource_type == ResourceType.EMR_CLUSTER:
        #     clusters = list_clusters_for_project(emr=emr, prefix=project_name, fetch_all=True)
        #     cluster_status = [cluster["Status"]["State"] for cluster in clusters["records"]]

        #     status_counts = Counter(cluster_status)

        #     total_counts = {"Total": len(cluster_status)}
        #     total_counts = total_counts | dict(status_counts)  # Merges the dicts and preserves order
        #     resource_counts[resource_type] = total_counts
        #     continue

        resource_list = resource_metadata_dao.get_all_for_project_by_type(project_name, resource_type, fetch_all=True).records

        if not resource_list:
            resource_counts[resource_type] = {"Total": 0}
            continue

        # Get metadata of resource
        metadata = [resource.metadata for resource in resource_list]

        resource_status = []
        for data in metadata:
            # We have a different Status Key for each resource so we need to find it
            resource_status += [
                status.title() for key, status in data.items() if "status" in key.lower() and isinstance(status, str)
            ]

        # Count each of the Status
        status_counts = Counter(resource_status)

        # Add total
        total_counts = {"Total": len(resource_list)}
        total_counts = total_counts | dict(status_counts)  # Merges the dicts and preserves order
        resource_counts[resource_type] = total_counts

    return resource_counts


@api_wrapper
def get(event, context):
    project_name = event["pathParameters"]["projectName"]
    project = project_dao.get(project_name)
    if not project:
        raise ResourceNotFound(f"Specified project {project_name} does not exist.")
    user = UserModel.from_dict(json.loads(event["requestContext"]["authorizer"]["user"]))
    project_user = project_user_dao.get(project_name, user.username)
    if Permission.ADMIN not in user.permissions and not project_user:
        raise ValueError(f"User is not a member of project {project_name}.")

    return {
        "project": project.to_dict(),
        "permissions": serialize_permissions(project_user.permissions) if project_user else [],
        "resourceCounts": (
            _get_resource_counts(project_name) if event["queryStringParameters"]["includeResourceCounts"] == "true" else {}
        ),
    }


@api_wrapper
def create(event, context):
    try:
        project_created = False
        username = event["requestContext"]["authorizer"]["principalId"]
        event_body = json.loads(event["body"])
        project_name = event_body["name"]

        _validate_input(project_name, 24, "name")
        _validate_input(event_body["description"], 4000, "description")

        if project_name in project_deny_list:
            raise Exception(f"'{project_name}' is a reserved word. You cannot create a project with that name.")

        # Check if the project name already exists in the table
        existing_project = project_dao.get(project_name)

        if existing_project:
            raise Exception(
                "Project name already exists. This can happen even when the project has been suspended by the PMO."
            )

        # set project creator
        event_body.update({"createdBy": username})
        new_project = ProjectModel.from_dict(event_body)
        project_dao.create(new_project)
        project_created = True
        _add_project_user(project_name, username, [Permission.PROJECT_OWNER, Permission.COLLABORATOR])

        return f"Successfully created project '{project_name}'"
    except Exception as e:
        logging.error(f"Error creating project: {e}")
        # Clean up any resources which may have been created prior to the error
        if project_created:
            project_dao.delete(project_name)

        raise e


@api_wrapper
def project_users(event, context):
    project_name = event["pathParameters"]["projectName"]
    members = project_user_dao.get_users_for_project(project_name)

    return [member.to_dict() for member in members]


@api_wrapper
def add_users(event, context):
    project_name = event["pathParameters"]["projectName"]
    request = json.loads(event["body"])
    usernames = request["usernames"]
    for username in usernames:
        _add_project_user(project_name, username, [Permission.COLLABORATOR])

    return f"Successfully added {len(usernames)} user(s) to {project_name}"


@api_wrapper
def remove_user(event, context):
    project_name = event["pathParameters"]["projectName"]
    username = event["pathParameters"]["username"]

    env_variables = get_environment_variables()

    # first check if user is an owner on the project.
    project_member = project_user_dao.get(project_name, username)

    if not project_member:
        raise Exception(f"{username} is not a member of {project_name}")

    if Permission.PROJECT_OWNER not in project_member.permissions or total_project_owners(project_user_dao, project_name) > 1:
        # Terminate any running EMR Clusters the user owns that are associated with the project
        clusters = resource_metadata_dao.get_all_for_project_by_type(project_name, ResourceType.EMR_CLUSTER, fetch_all=True)
        cluster_ids = []
        for cluster in clusters.records:
            if cluster.user == username:
                cluster_ids.append(cluster.id)

        if cluster_ids:
            emr.set_termination_protection(JobFlowIds=cluster_ids, TerminationProtected=False)
            emr.terminate_job_flows(JobFlowIds=cluster_ids)

        # Stop any running notebooks the user owns that are associated with the project, we're
        # going to remove their custom role which is the execution role assigned to any
        # notebook instances the user created within the project. Once the roles are removed the
        # notebooks are essentially in a bricked state but the names are deterministic. If the
        # user is added back to the project the notebooks will work again. If a user has a pending
        # instance we're not going to block removing them but the instance will still end up
        # in an unusable state due to the role being deleted.
        notebooks = resource_metadata_dao.get_all_for_project_by_type(project_name, ResourceType.NOTEBOOK, fetch_all=True)
        for notebook in notebooks.records:
            if notebook.user == username and notebook.metadata["NotebookInstanceStatus"] == "InService":
                sagemaker.stop_notebook_instance(NotebookInstanceName=notebook.id)

        # Stop any ongoing batch translate jobs in this project that were started by this user
        translate_jobs = resource_metadata_dao.get_all_for_project_by_type(
            project_name, ResourceType.BATCH_TRANSLATE_JOB, fetch_all=True
        )
        for translation_job in translate_jobs.records:
            if translation_job.user == username:
                translate.stop_text_translation_job(JobId=translation_job.id)

        # Remove IAM role for project user
        if env_variables["MANAGE_IAM_ROLES"]:
            iam_manager.remove_project_user_roles([project_member.role])

        project_user_dao.delete(project_name, username)
        return f"Successfully removed {username} from {project_name}"

    raise Exception("You cannot delete the last owner of a project")


@api_wrapper
def list_all(event, context):
    user = UserModel.from_dict(json.loads(event["requestContext"]["authorizer"]["user"]))
    if Permission.ADMIN in user.permissions:
        projects = project_dao.get_all(include_suspended=True)
    else:
        project_names = [project.project for project in project_user_dao.get_projects_for_user(user.username)]
        projects = project_dao.get_all(project_names=project_names)
    return [project.to_dict() for project in projects]


# When suspending resources we don't page responses because we need to ensure we suspend everything.
def _suspend_sagemaker_resources(project_name):
    # We need to stop in progress instances and fail if any are pending
    # so we can't set a status filter like we do elsewhere.

    notebook_instances = resource_metadata_dao.get_all_for_project_by_type(project_name, ResourceType.NOTEBOOK, fetch_all=True)
    pending_notebooks = False
    for notebook in notebook_instances.records:
        # Possible status values:
        # 'Pending'|'InService'|'Stopping'|'Stopped'|'Failed'|'Deleting'|'Updating'
        if notebook.metadata["NotebookInstanceStatus"] == "Pending":
            pending_notebooks = True
        if notebook.metadata["NotebookInstanceStatus"] == "InService":
            sagemaker.stop_notebook_instance(NotebookInstanceName=notebook.id)
        if pending_notebooks:
            raise Exception(
                "We have stopped all the notebooks that were in service, please check that no notebooks are in Pending status before attempting again."
            )

    # Stop all training jobs associated with this project
    training_jobs = resource_metadata_dao.get_all_for_project_by_type(
        project_name,
        ResourceType.TRAINING_JOB,
        fetch_all=True,
        filter_expression="metadata.TrainingJobStatus IN (:trainingStatus)",
        filter_values={":trainingStatus": "InProgress"},
    )
    for training_job in training_jobs.records:
        sagemaker.stop_training_job(TrainingJobName=training_job.id)

    # Stop all hpo jobs associated with this project
    hpo_jobs = resource_metadata_dao.get_all_for_project_by_type(
        project_name,
        ResourceType.HPO_JOB,
        fetch_all=True,
        filter_expression="metadata.HyperParameterTuningJobStatus IN (:hpoStatus)",
        filter_values={":hpoStatus": "InProgress"},
    )
    for hpo_job in hpo_jobs.records:
        sagemaker.stop_hyper_parameter_tuning_job(HyperParameterTuningJobName=hpo_job.id)

    # Stop all transform jobs associated with this project
    transform_jobs = resource_metadata_dao.get_all_for_project_by_type(
        project_name,
        ResourceType.TRANSFORM_JOB,
        fetch_all=True,
        filter_expression="metadata.TransformJobStatus IN (:transformStatus)",
        filter_values={":transformStatus": "InProgress"},
    )

    for transform_job in transform_jobs.records:
        sagemaker.stop_transform_job(TransformJobName=transform_job.id)

    endpoints = resource_metadata_dao.get_all_for_project_by_type(project_name, ResourceType.ENDPOINT, fetch_all=True)
    for endpoint in endpoints.records:
        sagemaker.delete_endpoint(EndpointName=endpoint.id)

    return True  # Idicates operation failed along the way


@api_wrapper
def update(event, context):
    project_name = event["pathParameters"]["projectName"]
    event_body = json.loads(event["body"])

    existing_project = project_dao.get(project_name)
    if not existing_project:
        raise ValueError("Specified project does not exist")
    if "description" in event_body:
        _validate_input(event_body["description"], 4000, "description")
        existing_project.description = event_body["description"]
    if "suspended" in event_body:
        suspended = event_body["suspended"]
        if suspended and not existing_project.suspended:
            _suspend_sagemaker_resources(project_name)
            existing_project.suspended = True
        if not suspended and existing_project.suspended:
            existing_project.suspended = False
    if "metadata" in event_body:
        existing_project.metadata = event_body["metadata"]

    project_dao.update(project_name, existing_project)

    return f"Successfully updated {project_name}"


@api_wrapper
def delete(event, context):
    project_name = event["pathParameters"]["projectName"]

    # Verify project is suspended first
    existing_project = project_dao.get(project_name)
    if not existing_project:
        raise ValueError("Specified project does not exist")
    if not existing_project.suspended:
        raise ValueError("Specified project is not suspended. Please suspend the project and try again.")

    # When deleting sagemaker resources we don't page responses because we need to delete everthing
    # Delete Models
    models = resource_metadata_dao.get_all_for_project_by_type(project_name, ResourceType.MODEL, fetch_all=True)
    for model in models.records:
        sagemaker.delete_model(ModelName=model.id)

    # Delete Endpoints
    endpoints = resource_metadata_dao.get_all_for_project_by_type(project_name, ResourceType.ENDPOINT, fetch_all=True)
    for endpoint in endpoints.records:
        sagemaker.delete_endpoint(EndpointName=endpoint.id)

    # Delete Endpoint Configs
    endpoint_configs = resource_metadata_dao.get_all_for_project_by_type(
        project_name, ResourceType.ENDPOINT_CONFIG, fetch_all=True
    )
    for endpoint_config in endpoint_configs.records:
        sagemaker.delete_endpoint_config(EndpointConfigName=endpoint_config.id)

    # Delete Datesets
    project_datasets = dataset_dao.get_all_for_scope(DatasetType.PROJECT, project_name)

    env_variables = get_environment_variables()

    for dataset in project_datasets:
        # Get the files to be deleted
        dataset_files = s3.list_objects_v2(Bucket=env_variables["DATA_BUCKET"], Prefix=dataset.prefix)

        if "Contents" in dataset_files:
            for file in dataset_files["Contents"]:
                # Delete the s3 item
                s3.delete_object(Bucket=env_variables["DATA_BUCKET"], Key=file["Key"])

        # Delete the dataset
        dataset_dao.delete(dataset.scope, dataset.name)

    # Delete Notebooks
    notebook_resources = resource_metadata_dao.get_all_for_project_by_type(project_name, ResourceType.NOTEBOOK, fetch_all=True)
    has_pending = False
    for notebook in notebook_resources.records:
        status = notebook.metadata["NotebookInstanceStatus"]
        if status == "Stopped" or status == "Failed":
            sagemaker.delete_notebook_instance(NotebookInstanceName=notebook.id)
        else:
            has_pending = True

    if has_pending:
        raise ValueError(
            "All Notebooks need to be Stopped to delete a project, all other " "sagemaker resources have been deleted."
        )

    # Delete all EMR Clusters
    clusters = list_clusters_for_project(emr, project_name, fetch_all=True)
    if clusters["records"]:
        cluster_ids = [cluster["Id"] for cluster in clusters["records"]]
        emr.set_termination_protection(JobFlowIds=cluster_ids, TerminationProtected=False)
        emr.terminate_job_flows(JobFlowIds=cluster_ids)

    # Delete users associations and project itself
    project_users = project_user_dao.get_users_for_project(project_name)
    # Check the deployment type to confirm IAM Vendor usage
    if env_variables["MANAGE_IAM_ROLES"]:
        iam_manager.remove_project_user_roles([user.role for user in project_users], project=project_name)

    # Remove all project related entries from the user/project table
    for project_user in project_users:
        project_user_dao.delete(project_name, project_user.user)

    # Delete the project record last
    project_dao.delete(project_name)

    return f"Successfully deleted {project_name} and its associated resources."


@api_wrapper
def update_project_user(event, context):
    project_name = event["pathParameters"]["projectName"]
    username = event["pathParameters"]["username"]
    updates = json.loads(event["body"])

    project_user = project_user_dao.get(project_name, username)

    if not project_user:
        raise ResourceNotFound(f"User {username} is not a member of {project_name}")

    if Permission.PROJECT_OWNER in project_user.permissions and Permission.PROJECT_OWNER.value not in updates["permissions"]:
        if total_project_owners(project_user_dao, project_name) < 2:
            raise Exception(f"Cannot remove last Project Owner from {project_name}.")

    if sorted(updates["permissions"]) != sorted(serialize_permissions(project_user.permissions)):
        project_user.permissions = [Permission(entry) for entry in updates["permissions"]]
        project_user_dao.update(project_name, username, project_user)

    return "Successfuly updated project user record."
