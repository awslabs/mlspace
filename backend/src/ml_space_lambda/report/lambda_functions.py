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

import csv
import json
import logging
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

import boto3
from botocore.config import Config

from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataDAO
from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerDAO, ResourceSchedulerModel
from ml_space_lambda.data_access_objects.user import UserDAO, UserModel
from ml_space_lambda.enums import Permission, ResourceType
from ml_space_lambda.utils.common_functions import api_wrapper, retry_config
from ml_space_lambda.utils.mlspace_config import get_environment_variables

project_dao = ProjectDAO()
resource_scheduler_dao = ResourceSchedulerDAO()
resource_metadata_dao = ResourceMetadataDAO()
user_dao = UserDAO()

sagemaker = boto3.client("sagemaker", config=retry_config)
logger = logging.getLogger(__name__)

emr = boto3.client("emr", config=retry_config)
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


def _format_date(date: Optional[datetime] = None):
    if not date:
        return "N/A"
    return date.strftime("%Y-%m-%d %H:%M:%S.%f+00:00")


def _get_notebooks(
    resource_get_func: Callable[..., PagedMetadataResults],
    args: Dict[str, any],
    termination_records: Optional[List[ResourceSchedulerModel]] = None,
) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.NOTEBOOK
    response = resource_get_func(**args)
    notebooks = []
    for result in response.records:
        notebooks.append(
            {
                "Resource": "Notebook",
                "Name": result.id,
                "Project": result.project,
                "Status": result.metadata.get("NotebookInstanceStatus", ""),
                "Created": result.metadata.get("CreationTime", ""),
                "Modified": result.metadata.get("LastModifiedTime", ""),
                "Type": result.metadata.get("InstanceType", ""),
                "Owner": result.user,
                "Auto-termination": _get_terminiation_datetime(result.id, ResourceType.NOTEBOOK, termination_records),
            }
        )

    return notebooks


def _get_hpo_jobs(resource_get_func: Callable[..., PagedMetadataResults], args: Dict[str, any]) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.HPO_JOB
    response = resource_get_func(**args)
    hpo_jobs = []
    for result in response.records:
        counts = result.metadata.get("TrainingJobStatusCounters", {})
        hpo_jobs.append(
            {
                "Name": result.id,
                "Project": result.project,
                "Status": result.metadata.get("HyperParameterTuningJobStatus", ""),
                "Created": result.metadata.get("CreationTime", ""),
                "Modified": result.metadata.get("LastModifiedTime", ""),
                "Total Training jobs": counts.get("Completed", 0)
                + counts.get("InProgress", 0)
                + counts.get("RetryableError", 0)
                + counts.get("NonRetryableError", 0)
                + counts.get("Stopped", 0),
                "Owner": result.user,
            }
        )

    return hpo_jobs


def _get_models(resource_get_func: Callable[..., PagedMetadataResults], args: Dict[str, any]) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.MODEL
    response = resource_get_func(**args)
    models = []
    for result in response.records:
        models.append(
            {
                "Name": result.id,
                "Project": result.project,
                "Created": result.metadata.get("CreationTime", ""),
                "Owner": result.user,
            }
        )

    return models


def _get_endpoint_configs(
    resource_get_func: Callable[..., PagedMetadataResults], args: Dict[str, any]
) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.ENDPOINT_CONFIG
    response = resource_get_func(**args)
    endpoint_configs = []
    for result in response.records:
        endpoint_configs.append(
            {
                "Name": result.id,
                "Project": result.project,
                "Created": result.metadata.get("CreationTime", ""),
                "Owner": result.user,
            }
        )

    return endpoint_configs


def _get_endpoints(
    resource_get_func: Callable[..., PagedMetadataResults],
    args: Dict[str, any],
    termination_records: Optional[List[ResourceSchedulerModel]] = None,
) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.ENDPOINT
    response = resource_get_func(**args)
    endpoints = []
    for result in response.records:
        endpoints.append(
            {
                "Name": result.id,
                "Project": result.project,
                "Status": result.metadata.get("EndpointStatus", ""),
                "Created": result.metadata.get("CreationTime", ""),
                "Modified": result.metadata.get("LastModifiedTime", ""),
                "Owner": result.user,
                "Auto-termination": _get_terminiation_datetime(result.id, ResourceType.ENDPOINT, termination_records),
            }
        )
    return endpoints


def _get_transform_jobs(resource_get_func: Callable[..., PagedMetadataResults], args: Dict[str, any]) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.TRANSFORM_JOB
    response = resource_get_func(**args)
    transform_jobs = []
    for result in response.records:
        transform_jobs.append(
            {
                "Name": result.id,
                "Project": result.project,
                "Status": result.metadata.get("TransformJobStatus", ""),
                "Created": result.metadata.get("CreationTime", ""),
                "Modified": result.metadata.get("LastModifiedTime", ""),
                "Owner": result.user,
            }
        )

    return transform_jobs


def _get_training_jobs(resource_get_func: Callable[..., PagedMetadataResults], args: Dict[str, any]) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.TRAINING_JOB
    response = resource_get_func(**args)

    training_jobs = []
    for result in response.records:
        training_jobs.append(
            {
                "Name": result.id,
                "Project": result.project,
                "Status": result.metadata.get("TrainingJobStatus", ""),
                "Created": result.metadata.get("CreationTime", ""),
                "Modified": result.metadata.get("LastModifiedTime", ""),
                "Owner": result.user,
            }
        )

    return training_jobs


def _get_emr_clusters(
    resource_get_func: Callable[..., PagedMetadataResults],
    args: Dict[str, any],
    termination_records: Optional[List[ResourceSchedulerModel]] = None,
) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.EMR_CLUSTER
    response = resource_get_func(**args)
    clusters = []
    for result in response.records:
        clusters.append(
            {
                "Name": result.metadata.get("Name", ""),
                "Project": result.project,
                "Status": result.metadata.get("Status", ""),
                "Created": result.metadata.get("CreationTime", ""),
                "Release": result.metadata.get("ReleaseVersion", ""),
                "Owner": result.user,
                "Auto-termination": _get_terminiation_datetime(result.id, ResourceType.EMR_CLUSTER, termination_records),
            }
        )
    return clusters


def _get_batch_translate_jobs(
    resource_get_func: Callable[..., PagedMetadataResults], args: Dict[str, any]
) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.BATCH_TRANSLATE_JOB
    response = resource_get_func(**args)

    batch_translations = []
    for result in response.records:
        batch_translations.append(
            {
                "Name": result.metadata.get("JobName", ""),
                "Project": result.project,
                "Status": result.metadata.get("JobStatus", ""),
                "Created": result.metadata.get("SubmittedTime", ""),
                "Owner": result.user,
                "Source Language Code": result.metadata.get("SourceLanguageCode", ""),
                "Target Language Codes": result.metadata.get("TargetLanguageCodes", []),
            }
        )

    return batch_translations


def _get_ground_truth_labeling_jobs(
    resource_get_func: Callable[..., PagedMetadataResults], args: Dict[str, any]
) -> List[Dict[str, Any]]:
    args["type"] = ResourceType.LABELING_JOB
    response = resource_get_func(**args)

    labeling_jobs = []
    for result in response.records:
        labeling_jobs.append(
            {
                "Name": result.id,
                "Project": result.project,
                "Status": result.metadata.get("LabelingJobStatus", ""),
                "Created": result.metadata.get("CreationTime", ""),
                "Owner": result.user,
                "TaskType": result.metadata.get("TaskType", ""),
            }
        )

    return labeling_jobs


def _get_project_resources(
    proj_name: str,
    termination_records: List[ResourceSchedulerModel],
    requested_resources: List[str],
) -> Dict[str, List[Dict[str, Any]]]:
    project = {}
    resource_get_func = resource_metadata_dao.get_all_for_project_by_type
    base_args = {"project": proj_name, "fetch_all": True}
    # All resources are retrieved unpaged as we need the report to contain all resources for the
    # project
    if "Notebooks" in requested_resources:
        project["Notebooks"] = _get_notebooks(
            resource_get_func,
            base_args,
            [record for record in termination_records if record.resource_type == ResourceType.NOTEBOOK],
        )
    if "HPO Jobs" in requested_resources:
        project["HPO Jobs"] = _get_hpo_jobs(resource_get_func, base_args)
    if "Models" in requested_resources:
        project["Models"] = _get_models(resource_get_func, base_args)
    if "Endpoint Configs" in requested_resources:
        project["Endpoint Configs"] = _get_endpoint_configs(resource_get_func, base_args)
    if "Endpoints" in requested_resources:
        project["Endpoints"] = _get_endpoints(
            resource_get_func,
            base_args,
            [record for record in termination_records if record.resource_type == ResourceType.ENDPOINT],
        )
    if "Transform Jobs" in requested_resources:
        project["Transform Jobs"] = _get_transform_jobs(resource_get_func, base_args)
    if "Training Jobs" in requested_resources:
        project["Training Jobs"] = _get_training_jobs(resource_get_func, base_args)
    if "EMR Clusters" in requested_resources:
        project["EMR Clusters"] = _get_emr_clusters(
            resource_get_func,
            base_args,
            [record for record in termination_records if record.resource_type == ResourceType.EMR_CLUSTER],
        )
    if "Batch Translation Jobs" in requested_resources:
        project["Batch Translation Jobs"] = _get_batch_translate_jobs(resource_get_func, base_args)
    if "GroundTruth Labeling Jobs" in requested_resources:
        project["GroundTruth Labeling Jobs"] = _get_ground_truth_labeling_jobs(
            resource_get_func,
            base_args,
        )

    return project


def _get_user_resources(
    username: str,
    requested_resources: List[str],
) -> Dict[str, List[Dict[str, Any]]]:
    result = {}
    resource_get_func = resource_metadata_dao.get_all_for_user_by_type
    base_args = {"user": username, "fetch_all": True}
    # All resources are retrieved unpaged as we need the report to contain all resources for the
    # project
    if "Notebooks" in requested_resources:
        result["Notebooks"] = _get_notebooks(resource_get_func, base_args)
    if "HPO Jobs" in requested_resources:
        result["HPO Jobs"] = _get_hpo_jobs(resource_get_func, base_args)
    if "Models" in requested_resources:
        result["Models"] = _get_models(resource_get_func, base_args)
    if "Endpoint Configs" in requested_resources:
        result["Endpoint Configs"] = _get_endpoint_configs(resource_get_func, base_args)
    if "Endpoints" in requested_resources:
        result["Endpoints"] = _get_endpoints(resource_get_func, base_args)
    if "Transform Jobs" in requested_resources:
        result["Transform Jobs"] = _get_transform_jobs(resource_get_func, base_args)
    if "Training Jobs" in requested_resources:
        result["Training Jobs"] = _get_training_jobs(resource_get_func, base_args)
    if "EMR Clusters" in requested_resources:
        result["EMR Clusters"] = _get_emr_clusters(resource_get_func, base_args)
    if "Batch Translation Jobs" in requested_resources:
        result["Batch Translation Jobs"] = _get_batch_translate_jobs(resource_get_func, base_args)
    if "GroundTruth Labeling Jobs" in requested_resources:
        result["GroundTruth Labeling Jobs"] = _get_ground_truth_labeling_jobs(
            resource_get_func,
            base_args,
        )
    return result


def _get_terminiation_datetime(
    resource_id: str,
    resource_type: ResourceType,
    records: Optional[List[ResourceSchedulerModel]] = None,
) -> str:
    if records is not None:
        return _format_date(
            next(
                (datetime.fromtimestamp(r.termination_time) for r in records if r.resource_id == resource_id),
                None,
            )
        )
    resource_record = resource_scheduler_dao.get(resource_id=resource_id, resource_type=resource_type)
    if resource_record:
        return _format_date(datetime.fromtimestamp(resource_record.termination_time))
    else:
        return "N/A"


def create_personnel_report(personnel: List[UserModel]):
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    file_name = f"mlspace-report-personnel-{timestamp}"

    env_variables = get_environment_variables()

    with open("/tmp/{}.csv".format(file_name), mode="w") as file:
        file_writer = csv.writer(file, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)
        file_writer.writerow(["Common Name", "DN", "Email", "Is Admin"])
        for person in personnel:
            file_writer.writerow(
                [
                    person.display_name,
                    person.username,
                    person.email,
                    "Yes" if (Permission.ADMIN in person.permissions) else "No",
                ]
            )
    key = "mlspace-report/{}.csv".format(file_name)
    s3.upload_file(Filename=f"/tmp/{file_name}.csv", Bucket=env_variables["DATA_BUCKET"], Key=key)

    return "s3://" + env_variables["DATA_BUCKET"] + "/" + key


def _create_report(report_key: str, content):
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    file_name = f"mlspace-report-{timestamp}"

    env_variables = get_environment_variables()

    with open(f"/tmp/{file_name}.csv", mode="w") as file:
        file_writer = csv.writer(file, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)
        file_writer.writerow(
            [
                report_key,
                "Resource Type",
                "Project" if report_key == "User" else "Owner",
                "Resource Name",
                "Status",
                "Created",
                "Modified",
                "Auto-termination/Auto-stop Time",
                "Instance Type",
                "Total Training Jobs",
                "Cluster Release",
                "Source Language Code",
                "Target Language Codes",
                "Task Type",
            ]
        )
        for report_record in content:
            for record_id, resources in report_record.items():
                for resource_type, resource_list in resources.items():
                    for details in resource_list:
                        project_or_owner = details["Project"] if report_key == "User" else details["Owner"]
                        if resource_type == "Notebooks":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "Notebook",
                                    project_or_owner,
                                    details["Name"],
                                    details["Status"],
                                    details["Created"],
                                    details["Modified"],
                                    details["Auto-termination"],
                                    details["Type"],
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                ]
                            )
                        if resource_type == "HPO Jobs":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "HPO Job",
                                    project_or_owner,
                                    details["Name"],
                                    details["Status"],
                                    details["Created"],
                                    details["Modified"],
                                    "",
                                    details["Total Training jobs"],
                                    "",
                                    "",
                                    "",
                                    "",
                                ]
                            )
                        if resource_type == "Models":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "Model",
                                    project_or_owner,
                                    details["Name"],
                                    "",
                                    details["Created"],
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                ]
                            )
                        if resource_type == "Endpoint Configs":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "Endpoint Config",
                                    project_or_owner,
                                    details["Name"],
                                    "",
                                    details["Created"],
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                ]
                            )
                        if resource_type == "Endpoints":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "Endpoint",
                                    project_or_owner,
                                    details["Name"],
                                    details["Status"],
                                    details["Created"],
                                    details["Modified"],
                                    details["Auto-termination"],
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                ]
                            )
                        if resource_type == "Transform Jobs":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "Transform Job",
                                    project_or_owner,
                                    details["Name"],
                                    details["Status"],
                                    details["Created"],
                                    details["Modified"],
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                ]
                            )
                        if resource_type == "Training Jobs":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "Training Job",
                                    project_or_owner,
                                    details["Name"],
                                    details["Status"],
                                    details["Created"],
                                    details["Modified"],
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                ]
                            )
                        if resource_type == "EMR Clusters":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "EMR Cluster",
                                    project_or_owner,
                                    details["Name"],
                                    details["Status"],
                                    details["Created"],
                                    "",
                                    details["Auto-termination"],
                                    "",
                                    "",
                                    details["Release"],
                                    "",
                                    "",
                                    "",
                                ]
                            )
                        if resource_type == "Batch Translation Jobs":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "Batch Translation Job",
                                    project_or_owner,
                                    details["Name"],
                                    details["Status"],
                                    details["Created"],
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    details["Source Language Code"],
                                    ",".join(details["Target Language Codes"]),
                                    "",
                                ]
                            )
                        if resource_type == "GroundTruth Labeling Jobs":
                            file_writer.writerow(
                                [
                                    record_id,
                                    "GroundTruth Labeling Job",
                                    project_or_owner,
                                    details["Name"],
                                    details["Status"],
                                    details["Created"],
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    "",
                                    details["TaskType"],
                                ]
                            )

    key = f"mlspace-report/{file_name}.csv"
    s3.upload_file(Filename=f"/tmp/{file_name}.csv", Bucket=env_variables["DATA_BUCKET"], Key=key)

    return "s3://" + env_variables["DATA_BUCKET"] + "/" + key


# create-report
@api_wrapper
def create(event, context):
    entity = json.loads(event["body"])
    requested_resources = entity["requestedResources"]
    report_scope = entity["scope"] if "scope" in entity else "system"
    report_targets = entity["targets"] if "targets" in entity else []
    report_content = []
    response = {}
    report_key = "Project"

    if "Personnel" in requested_resources:
        # Take out personnel to generate projects report
        requested_resources.remove("Personnel")
        personnel = user_dao.get_all(include_suspended=True)

        personnel_report_location = create_personnel_report(personnel)
        response["personnelReport"] = personnel_report_location

    if requested_resources:
        if report_scope != "user":
            list_of_projects = project_dao.get_all(
                include_suspended=True,
                project_names=report_targets if report_scope == "project" else None,
            )
            for project in list_of_projects:
                project_resource_termination_records = resource_scheduler_dao.get_all_project_resources(project.name)
                report_content.append(
                    {
                        project.name: _get_project_resources(
                            project.name, project_resource_termination_records, requested_resources
                        )
                    }
                )
        else:
            # Loop through and grab resources for each user
            report_key = "User"
            for username in report_targets:
                report_content.append({username: _get_user_resources(username, requested_resources)})

        report_location = _create_report(report_key, report_content)
        response["resourceReport"] = report_location
    return response


@api_wrapper
def list(event, context):
    reports = []
    env_variables = get_environment_variables()

    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=env_variables["DATA_BUCKET"], Prefix="mlspace-report")

    for page in pages:
        if "Contents" in page:
            for object in page["Contents"]:
                reports.append(
                    {
                        "Name": object["Key"][object["Key"].find("/") + 1 :],
                        "LastModified": (object["LastModified"].strftime("%Y-%m-%d %H:%M:%S") + " GMT"),
                    }
                )
    return sorted(reports, key=lambda x: x["LastModified"], reverse=True)


@api_wrapper
def download(event, context):
    report_name = event["pathParameters"]["reportName"]
    env_variables = get_environment_variables()

    return s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": env_variables["DATA_BUCKET"], "Key": f"mlspace-report/{report_name}"},
        ExpiresIn=120,
    )


@api_wrapper
def delete(event, context):
    report = event["pathParameters"]["reportName"]
    env_variables = get_environment_variables()

    s3.delete_object(Bucket=env_variables["DATA_BUCKET"], Key=f"mlspace-report/{report}")

    return f"Successfully deleted {report}"
