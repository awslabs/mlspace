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

# Testing for the create_report Lambda function.
import json
import time
from datetime import datetime
from typing import List, Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "PROJECT_TABLE": "mlspace-project",
    "USER_TABLE": "mlspace-user",
}
mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.report.lambda_functions import create

project_name = "example_project"
empty_project_name = "empty-project"
mock_creation_date = "2023-10-04 13:46:22.554000+00:00"
mock_modified_date = "2023-10-04 13:46:57.478000+00:00"
mock_second_username = "jdoe@amazon.com"

MOCK_PROJECTS = [
    ProjectModel(
        name=empty_project_name,
        description="mostly an empty project, just 1 notebook",
        suspended=False,
        created_by=mock_second_username,
    ),
    ProjectModel(
        name=project_name,
        description="example description 1",
        suspended=False,
        created_by="polly@example.com",
    ),
]

MOCK_USERS = [
    UserModel(
        username="TestUser1",
        email="test1@amazon.com",
        display_name="Test User1",
        suspended=True,
    ),
    UserModel(
        username="TestUser2",
        email="test2@amazon.com",
        display_name="Test User2",
        suspended=False,
    ),
    UserModel(
        username="TestUser3",
        email="test3@amazon.com",
        display_name="Test User3",
        suspended=False,
    ),
]


MOCK_OWNER = UserModel(
    username="MockOwner",
    email="mockowner@amazon.com",
    display_name="Mock Owner",
    suspended=False,
)

created_date_str = "2023-10-04 13:46:22.554000+00:00"
modified_date_str = "2023-10-04 13:46:57.478000+00:00"

list_of_notebooks = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "instance1",
            ResourceType.NOTEBOOK,
            MOCK_OWNER.username,
            project_name,
            {
                "NotebookInstanceStatus": "Running",
                "CreationTime": created_date_str,
                "LastModifiedTime": modified_date_str,
                "InstanceType": "ml.g5.48xlarge",
            },
        ),
        ResourceMetadataModel(
            "instance2",
            ResourceType.NOTEBOOK,
            MOCK_OWNER.username,
            project_name,
            {
                "NotebookInstanceStatus": "Pending",
                "CreationTime": created_date_str,
                "LastModifiedTime": modified_date_str,
                "InstanceType": "ml.g5.48xlarge",
            },
        ),
    ]
)

list_of_hpo_jobs = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "hpo_job1",
            ResourceType.HPO_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "HyperParameterTuningJobStatus": "InProgress",
                "CreationTime": created_date_str,
                "LastModifiedTime": modified_date_str,
                "TrainingJobStatusCounters": {
                    "InProgress": 1,
                    "Completed": 0,
                },
            },
        ),
        ResourceMetadataModel(
            "hpo_job2",
            ResourceType.HPO_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "HyperParameterTuningJobStatus": "Stopped",
                "CreationTime": created_date_str,
                "LastModifiedTime": modified_date_str,
                "TrainingJobStatusCounters": {
                    "Completed": 0,
                    "InProgress": 0,
                    "NonRetryableError": 0,
                    "RetryableError": 0,
                    "Stopped": 1,
                },
            },
        ),
    ]
)

list_of_models = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "model1",
            ResourceType.MODEL,
            MOCK_OWNER.username,
            project_name,
            {"CreationTime": created_date_str},
        ),
        ResourceMetadataModel(
            "model2",
            ResourceType.MODEL,
            MOCK_OWNER.username,
            project_name,
            {"CreationTime": created_date_str},
        ),
    ]
)

list_of_endpoint_configs = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "endpoint_config1",
            ResourceType.ENDPOINT_CONFIG,
            MOCK_OWNER.username,
            project_name,
            {"CreationTime": created_date_str},
        ),
        ResourceMetadataModel(
            "endpoint_config2",
            ResourceType.ENDPOINT_CONFIG,
            MOCK_OWNER.username,
            project_name,
            {"CreationTime": created_date_str},
        ),
    ]
)

list_of_endpoints = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "endpoint1",
            ResourceType.ENDPOINT,
            MOCK_OWNER.username,
            project_name,
            {
                "CreationTime": created_date_str,
                "EndpointStatus": "InProgress",
                "LastModifiedTime": modified_date_str,
            },
        ),
        ResourceMetadataModel(
            "endpoint2",
            ResourceType.ENDPOINT,
            MOCK_OWNER.username,
            project_name,
            {
                "CreationTime": created_date_str,
                "EndpointStatus": "Stopped",
                "LastModifiedTime": modified_date_str,
            },
        ),
    ]
)

list_of_transform_jobs = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "transformjob1",
            ResourceType.TRANSFORM_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "CreationTime": created_date_str,
                "TransformJobStatus": "InProgress",
                "LastModifiedTime": modified_date_str,
            },
        ),
        ResourceMetadataModel(
            "transformjob2",
            ResourceType.TRANSFORM_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "CreationTime": created_date_str,
                "TransformJobStatus": "Stopped",
                "LastModifiedTime": modified_date_str,
            },
        ),
    ]
)

list_of_training_jobs = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "trainingjob1",
            ResourceType.TRAINING_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "CreationTime": created_date_str,
                "TrainingJobStatus": "InProgress",
                "LastModifiedTime": modified_date_str,
            },
        ),
        ResourceMetadataModel(
            "trainingjob2",
            ResourceType.TRAINING_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "CreationTime": created_date_str,
                "TrainingJobStatus": "Stopped",
                "LastModifiedTime": modified_date_str,
            },
        ),
    ]
)

list_emr_cluster_response = {
    "records": [
        {
            "Id": "cluster1",
            "Name": f"{project_name}-cluster1",
            "Status": {
                "State": "WAITING",
                "Timeline": {"CreationTime": datetime(2023, 10, 4, 13, 46, 22, 554000)},
            },
            "ReleaseLabel": "6.6",
            "ClusterArn": "mockArn",
        },
        {
            "Id": "Cluster3",
            "Name": f"{project_name}-cluster3",
            "Status": {
                "State": "RUNNING",
                "Timeline": {"CreationTime": datetime(2023, 10, 4, 13, 46, 22, 554000)},
            },
            "ReleaseLabel": "6.2",
            "ClusterArn": "mockArn3",
        },
    ]
}

list_of_batch_translate_jobs = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "batchTranslateJob1",
            ResourceType.BATCH_TRANSLATE_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "JobName": f"{project_name}-translate-job1",
                "JobStatus": "SUBMITTED",
                "SubmittedTime": created_date_str,
                "SourceLanguageCode": "en",
                "TargetLanguageCodes": ["fr", "es"],
            },
        ),
        ResourceMetadataModel(
            "batchTranslateJob2",
            ResourceType.BATCH_TRANSLATE_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "JobName": f"{project_name}-translate-job2",
                "JobStatus": "COMPLETED",
                "SubmittedTime": created_date_str,
                "SourceLanguageCode": "es",
                "TargetLanguageCodes": ["fr", "en"],
            },
        ),
    ]
)

list_of_labeling_jobs = PagedMetadataResults(
    [
        ResourceMetadataModel(
            "labeling-job1",
            ResourceType.LABELING_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "CreationTime": created_date_str,
                "LabelingJobStatus": "Completed",
                "TaskType": "Bounding Box",
            },
        ),
        ResourceMetadataModel(
            "labeling-job2",
            ResourceType.LABELING_JOB,
            MOCK_OWNER.username,
            project_name,
            {
                "CreationTime": created_date_str,
                "LabelingJobStatus": "Failed",
                "TaskType": "Image Classification",
            },
        ),
    ]
)

LIST_TAGS_RESPONSE = [
    {
        "Tags": [
            {"Key": "user", "Value": MOCK_OWNER.username},
            {"Key": "system", "Value": "MLspace"},
        ]
    },
    {
        "Tags": [
            {"Key": "user", "Value": MOCK_OWNER.username},
            {"Key": "system", "Value": "MLspace"},
        ]
    },
]


def mock_get_project_resources(*args, **kwargs) -> PagedMetadataResults:
    if kwargs["project"] == project_name:
        if kwargs["type"] == ResourceType.NOTEBOOK:
            return list_of_notebooks
        if kwargs["type"] == ResourceType.HPO_JOB:
            return list_of_hpo_jobs
        if kwargs["type"] == ResourceType.MODEL:
            return list_of_models
        if kwargs["type"] == ResourceType.ENDPOINT_CONFIG:
            return list_of_endpoint_configs
        if kwargs["type"] == ResourceType.ENDPOINT:
            return list_of_endpoints
        if kwargs["type"] == ResourceType.TRANSFORM_JOB:
            return list_of_transform_jobs
        if kwargs["type"] == ResourceType.TRAINING_JOB:
            return list_of_training_jobs
        if kwargs["type"] == ResourceType.BATCH_TRANSLATE_JOB:
            return list_of_batch_translate_jobs
        if kwargs["type"] == ResourceType.LABELING_JOB:
            return list_of_labeling_jobs
    elif kwargs["project"] == empty_project_name:
        if kwargs["type"] == ResourceType.NOTEBOOK:
            return PagedMetadataResults(
                [
                    ResourceMetadataModel(
                        "ExampleNotebook",
                        ResourceType.NOTEBOOK,
                        mock_second_username,
                        empty_project_name,
                        {
                            "NotebookInstanceStatus": "Running",
                            "CreationTime": created_date_str,
                            "LastModifiedTime": modified_date_str,
                            "InstanceType": "ml.m5.large",
                        },
                    )
                ]
            )
    return PagedMetadataResults()


def mock_get_user_resources(*args, **kwargs) -> PagedMetadataResults:
    if kwargs["user"] == MOCK_OWNER.username:
        if kwargs["type"] == ResourceType.NOTEBOOK:
            return list_of_notebooks
        if kwargs["type"] == ResourceType.ENDPOINT:
            return list_of_endpoints
    elif kwargs["user"] == mock_second_username:
        if kwargs["type"] == ResourceType.NOTEBOOK:
            return PagedMetadataResults(
                [
                    ResourceMetadataModel(
                        "ExampleNotebook",
                        ResourceType.NOTEBOOK,
                        mock_second_username,
                        empty_project_name,
                        {
                            "NotebookInstanceStatus": "Running",
                            "CreationTime": created_date_str,
                            "LastModifiedTime": modified_date_str,
                            "InstanceType": "ml.m5.large",
                        },
                    )
                ]
            )
    return PagedMetadataResults()


def mock_get_all_project_resource_schedules(*args, **kwargs) -> List[ResourceSchedulerModel]:
    if args[0] == project_name:
        return [
            ResourceSchedulerModel(
                "instance1",
                ResourceType.NOTEBOOK,
                time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
                project_name,
            ),
            ResourceSchedulerModel(
                "endpoint1",
                ResourceType.ENDPOINT,
                time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
                project_name,
            ),
            ResourceSchedulerModel(
                "cluster1",
                ResourceType.EMR_CLUSTER,
                time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
                project_name,
            ),
        ]
    return []


def mock_resource_scheduler_get(*args, **kwargs) -> Optional[ResourceSchedulerModel]:
    if kwargs["resource_id"] == "instance1":
        return ResourceSchedulerModel(
            "instance1",
            ResourceType.NOTEBOOK,
            time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
            project_name,
        )
    elif kwargs["resource_id"] == "endpoint1":
        return ResourceSchedulerModel(
            "endpoint1",
            ResourceType.ENDPOINT,
            time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
            project_name,
        )

    return None


def _mock_primary_owner_writes(is_user_report: bool, owner: str, project: str):
    id_val = owner if is_user_report == "user" else project
    other_val = project if is_user_report == "user" else owner
    return [
        mock.call().write(
            f"{id_val},Notebook,{other_val},instance1,Running,{created_date_str},"
            f"{modified_date_str},2023-01-01 17:00:00.000000+00:00,ml.g5.48xlarge,,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},Notebook,{other_val},instance2,Pending,"
            f"{created_date_str},{modified_date_str},N/A,ml.g5.48xlarge,,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},HPO Job,{other_val},hpo_job1,InProgress," f"{created_date_str},{modified_date_str},,1,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},HPO Job,{other_val},hpo_job2,Stopped," f"{created_date_str},{modified_date_str},,1,,,,\r\n"
        ),
        mock.call().write(f"{id_val},Model,{other_val},model1,,{created_date_str},,,,,,,\r\n"),
        mock.call().write(f"{id_val},Model,{other_val},model2,,{created_date_str},,,,,,,\r\n"),
        mock.call().write(f"{id_val},Endpoint Config,{other_val},endpoint_config1,," f"{created_date_str},,,,,,,\r\n"),
        mock.call().write(f"{id_val},Endpoint Config,{other_val},endpoint_config2,," f"{created_date_str},,,,,,,\r\n"),
        mock.call().write(
            f"{id_val},Endpoint,{other_val},endpoint1,InProgress,"
            f"{created_date_str},{modified_date_str},2023-01-01 17:00:00.000000+00:00,,,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},Endpoint,{other_val},endpoint2,Stopped," f"{created_date_str},{modified_date_str},N/A,,,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},Transform Job,{other_val},transformjob1,InProgress," f"{created_date_str},{modified_date_str},,,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},Transform Job,{other_val},transformjob2,Stopped," f"{created_date_str},{modified_date_str},,,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},Training Job,{other_val},trainingjob1,InProgress," f"{created_date_str},{modified_date_str},,,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},Training Job,{other_val},trainingjob2,Stopped," f"{created_date_str},{modified_date_str},,,,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},EMR Cluster,{other_val},example_project-"
            f"cluster1,WAITING,{created_date_str},,2023-01-01 17:00:00.000000+00:00,,,6.6,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},EMR Cluster,{other_val},example_project-" f"cluster3,RUNNING,{created_date_str},,N/A,,,6.2,,,\r\n"
        ),
        mock.call().write(
            f"{id_val},Batch Translation Job,{other_val},{project_name}-translate-job1,SUBMITTED,"
            f'{created_date_str},,,,,,en,"fr,es",\r\n'
        ),
        mock.call().write(
            f"{id_val},Batch Translation Job,{other_val},{project_name}-translate-job2,COMPLETED,"
            f'{created_date_str},,,,,,es,"fr,en",\r\n'
        ),
        mock.call().write(
            f"{id_val},GroundTruth Labeling Job,{other_val},labeling-job1,Completed,"
            f"{created_date_str},,,,,,,,Bounding Box\r\n"
        ),
        mock.call().write(
            f"{id_val},GroundTruth Labeling Job,{other_val},labeling-job2,Failed,"
            f"{created_date_str},,,,,,,,Image Classification\r\n"
        ),
    ]


@mock.patch("builtins.open", new_callable=mock.mock_open)
@mock.patch("ml_space_lambda.report.lambda_functions.emr")
@mock.patch("ml_space_lambda.report.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.s3")
@mock.patch("ml_space_lambda.report.lambda_functions.datetime")
def test_create_system_report_success(
    mock_datetime,
    mock_s3,
    mock_project_dao,
    mock_resource_metadata_dao,
    mock_resource_scheduler_dao,
    mock_sagemaker,
    mock_emr,
    mock_file,
):
    mock_datetime.now.return_value = datetime.fromisoformat("2022-10-11T23:05:50")
    mock_datetime.fromtimestamp.side_effect = datetime.fromtimestamp
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = mock_get_project_resources
    mock_resource_scheduler_dao.get_all_project_resources.side_effect = mock_get_all_project_resource_schedules
    mock_project_dao.get_all.return_value = MOCK_PROJECTS

    mock_event = {
        "body": json.dumps(
            {
                "scope": "system",
                "requestedResources": [
                    "Notebooks",
                ],
            }
        )
    }
    expected_response = generate_html_response(
        200,
        {
            "resourceReport": "s3://mlspace-data-bucket/mlspace-report/" "mlspace-report-20221011-230550.csv",
        },
    )

    assert create(mock_event, mock_context) == expected_response

    mock_project_dao.get_all.assert_called_with(include_suspended=True, project_names=None)

    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [
            mock.call(project=empty_project_name, fetch_all=True, type=ResourceType.NOTEBOOK),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.NOTEBOOK),
        ],
        True,
    )

    mock_emr.get_paginator.assert_not_called()
    mock_sagemaker.list_tags.assert_not_called()
    mock_resource_scheduler_dao.get_all_project_resources.assert_has_calls(
        [
            mock.call(empty_project_name),
            mock.call(project_name),
        ]
    )
    mock_s3.upload_file.assert_called_with(
        Filename="/tmp/mlspace-report-20221011-230550.csv",
        Bucket="mlspace-data-bucket",
        Key="mlspace-report/mlspace-report-20221011-230550.csv",
    )

    mock_file.assert_has_calls(
        [
            mock.call("/tmp/mlspace-report-20221011-230550.csv", mode="w"),
            mock.call().__enter__(),
            mock.call().write(
                "Project,Resource Type,Owner,Resource Name,Status,Created,Modified,"
                "Auto-termination/Auto-stop Time,Instance Type,Total Training Jobs,Cluster Release,Source Language Code,Target Language Codes,Task Type\r\n"
            ),
            mock.call().write(
                f"{empty_project_name},Notebook,{mock_second_username},ExampleNotebook,Running,"
                f"{created_date_str},{modified_date_str},N/A,ml.m5.large,,,,,\r\n"
            ),
            mock.call().write(
                f"{project_name},Notebook,{MOCK_OWNER.username},instance1,Running,{created_date_str},"
                f"{modified_date_str},2023-01-01 17:00:00.000000+00:00,ml.g5.48xlarge,,,,,\r\n"
            ),
            mock.call().write(
                f"{project_name},Notebook,{MOCK_OWNER.username},instance2,Pending,"
                f"{created_date_str},{modified_date_str},N/A,ml.g5.48xlarge,,,,,\r\n"
            ),
            mock.call().__exit__(None, None, None),
        ]
    )


@mock.patch("builtins.open", new_callable=mock.mock_open)
@mock.patch("ml_space_lambda.report.lambda_functions.list_clusters_for_project")
@mock.patch("ml_space_lambda.report.lambda_functions.emr")
@mock.patch("ml_space_lambda.report.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.s3")
@mock.patch("ml_space_lambda.report.lambda_functions.datetime")
def test_create_project_report_success(
    mock_datetime,
    mock_s3,
    mock_project_dao,
    mock_resource_metadata_dao,
    mock_resource_scheduler_dao,
    mock_sagemaker,
    mock_emr,
    mock_list_clusters,
    mock_file,
):
    mock_datetime.now.return_value = datetime.fromisoformat("2022-10-11T23:05:50")
    mock_datetime.fromtimestamp.side_effect = datetime.fromtimestamp
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = mock_get_project_resources
    mock_resource_scheduler_dao.get_all_project_resources.side_effect = mock_get_all_project_resource_schedules
    mock_project_dao.get_all.return_value = [MOCK_PROJECTS[1]]
    mock_sagemaker.list_tags.side_effect = LIST_TAGS_RESPONSE
    mock_list_clusters.return_value = list_emr_cluster_response

    mock_event = {
        "body": json.dumps(
            {
                "scope": "project",
                "targets": [project_name],
                "requestedResources": [
                    "Notebooks",
                    "HPO Jobs",
                    "Models",
                    "Endpoint Configs",
                    "Endpoints",
                    "Transform Jobs",
                    "Training Jobs",
                    "EMR Clusters",
                    "Batch Translation Jobs",
                    "GroundTruth Labeling Jobs",
                ],
            }
        )
    }
    expected_response = generate_html_response(
        200,
        {
            "resourceReport": "s3://mlspace-data-bucket/mlspace-report/" "mlspace-report-20221011-230550.csv",
        },
    )

    assert create(mock_event, mock_context) == expected_response

    mock_project_dao.get_all.assert_called_with(include_suspended=True, project_names=[project_name])

    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [
            mock.call(project=project_name, fetch_all=True, type=ResourceType.ENDPOINT),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.ENDPOINT_CONFIG),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.HPO_JOB),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.MODEL),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.NOTEBOOK),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.TRAINING_JOB),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.TRANSFORM_JOB),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.BATCH_TRANSLATE_JOB),
            mock.call(project=project_name, fetch_all=True, type=ResourceType.LABELING_JOB),
        ],
        True,
    )

    mock_resource_scheduler_dao.get_all_project_resources.assert_called_with(project_name)

    mock_list_clusters.assert_called_with(mock_emr, prefix=project_name, fetch_all=True)

    mock_s3.upload_file.assert_called_with(
        Filename="/tmp/mlspace-report-20221011-230550.csv",
        Bucket="mlspace-data-bucket",
        Key="mlspace-report/mlspace-report-20221011-230550.csv",
    )

    mock_file.assert_has_calls(
        [
            mock.call("/tmp/mlspace-report-20221011-230550.csv", mode="w"),
            mock.call().__enter__(),
            mock.call().write(
                "Project,Resource Type,Owner,Resource Name,Status,Created,Modified,"
                "Auto-termination/Auto-stop Time,Instance Type,Total Training Jobs,Cluster Release,Source Language Code,Target Language Codes,Task Type\r\n"
            ),
            *_mock_primary_owner_writes(False, MOCK_OWNER.username, project_name),
            mock.call().__exit__(None, None, None),
        ]
    )


@mock.patch("builtins.open", new_callable=mock.mock_open)
@mock.patch("ml_space_lambda.report.lambda_functions.list_clusters_for_project")
@mock.patch("ml_space_lambda.report.lambda_functions.emr")
@mock.patch("ml_space_lambda.report.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.s3")
@mock.patch("ml_space_lambda.report.lambda_functions.datetime")
def test_create_user_report_success(
    mock_datetime,
    mock_s3,
    mock_project_dao,
    mock_resource_metadata_dao,
    mock_resource_scheduler_dao,
    mock_sagemaker,
    mock_emr,
    mock_list_clusters,
    mock_file,
):
    mock_datetime.now.return_value = datetime.fromisoformat("2022-10-11T23:05:50")
    mock_datetime.fromtimestamp.side_effect = datetime.fromtimestamp
    mock_resource_metadata_dao.get_all_for_user_by_type.side_effect = mock_get_user_resources
    mock_resource_scheduler_dao.get.side_effect = mock_resource_scheduler_get
    mock_list_clusters.return_value = list_emr_cluster_response
    # User report needs to filter clusters by tags so we're going to end up pull all clusters 2x
    # and then need to validate ownership of those clusters 2x
    mock_sagemaker.list_tags.side_effect = [*LIST_TAGS_RESPONSE, *LIST_TAGS_RESPONSE]

    mock_event = {
        "body": json.dumps(
            {
                "scope": "user",
                "targets": [MOCK_OWNER.username, mock_second_username],
                "requestedResources": [
                    "Notebooks",
                    "HPO Jobs",
                    "Models",
                    "Endpoints",
                    "Transform Jobs",
                    "Training Jobs",
                    "EMR Clusters",
                    "Batch Translation Jobs",
                    "GroundTruth Labeling Jobs",
                ],
            }
        )
    }
    expected_response = generate_html_response(
        200,
        {
            "resourceReport": "s3://mlspace-data-bucket/mlspace-report/" "mlspace-report-20221011-230550.csv",
        },
    )

    assert create(mock_event, mock_context) == expected_response

    mock_resource_metadata_dao.get_all_for_user_by_type.assert_has_calls(
        [
            mock.call(user=MOCK_OWNER.username, fetch_all=True, type=ResourceType.ENDPOINT),
            mock.call(user=MOCK_OWNER.username, fetch_all=True, type=ResourceType.HPO_JOB),
            mock.call(user=MOCK_OWNER.username, fetch_all=True, type=ResourceType.MODEL),
            mock.call(user=MOCK_OWNER.username, fetch_all=True, type=ResourceType.NOTEBOOK),
            mock.call(user=MOCK_OWNER.username, fetch_all=True, type=ResourceType.TRAINING_JOB),
            mock.call(user=MOCK_OWNER.username, fetch_all=True, type=ResourceType.TRANSFORM_JOB),
            mock.call(user=MOCK_OWNER.username, fetch_all=True, type=ResourceType.BATCH_TRANSLATE_JOB),
            mock.call(user=MOCK_OWNER.username, fetch_all=True, type=ResourceType.LABELING_JOB),
            mock.call(user=mock_second_username, fetch_all=True, type=ResourceType.ENDPOINT),
            mock.call(user=mock_second_username, fetch_all=True, type=ResourceType.HPO_JOB),
            mock.call(user=mock_second_username, fetch_all=True, type=ResourceType.MODEL),
            mock.call(user=mock_second_username, fetch_all=True, type=ResourceType.NOTEBOOK),
            mock.call(user=mock_second_username, fetch_all=True, type=ResourceType.TRAINING_JOB),
            mock.call(user=mock_second_username, fetch_all=True, type=ResourceType.TRANSFORM_JOB),
            mock.call(user=mock_second_username, fetch_all=True, type=ResourceType.BATCH_TRANSLATE_JOB),
            mock.call(user=mock_second_username, fetch_all=True, type=ResourceType.LABELING_JOB),
        ],
        True,
    )

    mock_project_dao.get_all.assert_not_called()
    mock_list_clusters.assert_has_calls(
        [
            mock.call(mock_emr, prefix=None, fetch_all=True),
            mock.call(mock_emr, prefix=None, fetch_all=True),
        ]
    )

    mock_resource_scheduler_dao.get_all_project_resources.assert_not_called()
    mock_resource_scheduler_dao.get.assert_has_calls(
        [
            mock.call(resource_id="instance1", resource_type=ResourceType.NOTEBOOK),
            mock.call(resource_id="instance2", resource_type=ResourceType.NOTEBOOK),
            mock.call(resource_id="ExampleNotebook", resource_type=ResourceType.NOTEBOOK),
            mock.call(resource_id="endpoint1", resource_type=ResourceType.ENDPOINT),
            mock.call(resource_id="endpoint2", resource_type=ResourceType.ENDPOINT),
        ],
        True,
    )
    mock_s3.upload_file.assert_called_with(
        Filename="/tmp/mlspace-report-20221011-230550.csv",
        Bucket="mlspace-data-bucket",
        Key="mlspace-report/mlspace-report-20221011-230550.csv",
    )

    mock_file.assert_has_calls(
        [
            mock.call("/tmp/mlspace-report-20221011-230550.csv", mode="w"),
            mock.call().__enter__(),
            mock.call().write(
                "User,Resource Type,Project,Resource Name,Status,Created,Modified,"
                "Auto-termination/Auto-stop Time,Instance Type,Total Training Jobs,Cluster Release,Source Language Code,Target Language Codes,Task Type\r\n"
            ),
            mock.call().write(
                f"{MOCK_OWNER.username},Notebook,{project_name},instance1,Running,{created_date_str},{modified_date_str},2023-01-01 17:00:00.000000+00:00,ml.g5.48xlarge,,,,,\r\n"
            ),
            mock.call().write(
                f"{MOCK_OWNER.username},Notebook,{project_name},instance2,Pending,{created_date_str},{modified_date_str},N/A,ml.g5.48xlarge,,,,,\r\n"
            ),
            mock.call().write(
                f"{MOCK_OWNER.username},Endpoint,{project_name},endpoint1,InProgress,{created_date_str},{modified_date_str},2023-01-01 17:00:00.000000+00:00,,,,,,\r\n"
            ),
            mock.call().write(
                f"{MOCK_OWNER.username},Endpoint,{project_name},endpoint2,Stopped,{created_date_str},{modified_date_str},N/A,,,,,,\r\n"
            ),
            mock.call().write(
                f"{MOCK_OWNER.username},EMR Cluster,{project_name},example_project-cluster1,WAITING,{created_date_str},,N/A,,,6.6,,,\r\n"
            ),
            mock.call().write(
                f"{MOCK_OWNER.username},EMR Cluster,{project_name},example_project-cluster3,RUNNING,{created_date_str},,N/A,,,6.2,,,\r\n"
            ),
            mock.call().write(
                f"{mock_second_username},Notebook,{empty_project_name},ExampleNotebook,Running,"
                f"{created_date_str},{modified_date_str},N/A,ml.m5.large,,,,,\r\n"
            ),
            mock.call().__exit__(None, None, None),
        ]
    )


@mock.patch("builtins.open", new_callable=mock.mock_open)
@mock.patch("ml_space_lambda.report.lambda_functions.list_clusters_for_project")
@mock.patch("ml_space_lambda.report.lambda_functions.emr")
@mock.patch("ml_space_lambda.report.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.s3")
@mock.patch("ml_space_lambda.report.lambda_functions.datetime")
def test_create_user_report_empty(
    mock_datetime,
    mock_s3,
    mock_project_dao,
    mock_resource_metadata_dao,
    mock_resource_scheduler_dao,
    mock_sagemaker,
    mock_emr,
    mock_list_clusters,
    mock_file,
):
    mock_datetime.now.return_value = datetime.fromisoformat("2022-10-11T23:05:50")
    mock_datetime.fromtimestamp.side_effect = datetime.fromtimestamp
    mock_resource_metadata_dao.get_all_for_user_by_type.side_effect = mock_get_user_resources

    mock_event = {
        "body": json.dumps(
            {
                "scope": "user",
                "targets": [mock_second_username],
                "requestedResources": [
                    "Endpoint Configs",
                ],
            }
        )
    }
    expected_response = generate_html_response(
        200,
        {
            "resourceReport": "s3://mlspace-data-bucket/mlspace-report/" "mlspace-report-20221011-230550.csv",
        },
    )

    assert create(mock_event, mock_context) == expected_response

    assert mock_resource_metadata_dao.get_all_for_user_by_type.call_count == 1
    mock_resource_metadata_dao.get_all_for_user_by_type.assert_called_with(
        user=mock_second_username, fetch_all=True, type=ResourceType.ENDPOINT_CONFIG
    )

    mock_project_dao.get_all.assert_not_called()
    mock_list_clusters.assert_not_called()
    mock_sagemaker.list_tags.assert_not_called()
    mock_emr.get_paginator.assert_not_called()

    mock_resource_scheduler_dao.get_all_project_resources.assert_not_called()
    mock_resource_scheduler_dao.get.assert_not_called()
    mock_s3.upload_file.assert_called_with(
        Filename="/tmp/mlspace-report-20221011-230550.csv",
        Bucket="mlspace-data-bucket",
        Key="mlspace-report/mlspace-report-20221011-230550.csv",
    )

    mock_file.assert_has_calls(
        [
            mock.call("/tmp/mlspace-report-20221011-230550.csv", mode="w"),
            mock.call().__enter__(),
            mock.call().write(
                "User,Resource Type,Project,Resource Name,Status,Created,Modified,"
                "Auto-termination/Auto-stop Time,Instance Type,Total Training Jobs,Cluster Release,Source Language Code,Target Language Codes,Task Type\r\n"
            ),
            mock.call().__exit__(None, None, None),
        ]
    )


@mock.patch("ml_space_lambda.report.lambda_functions.resource_scheduler_dao")
@mock.patch("builtins.open", new_callable=mock.mock_open)
@mock.patch("ml_space_lambda.report.lambda_functions.user_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.datetime")
@mock.patch("ml_space_lambda.report.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.s3")
def test_create_personnel_report_success(
    mock_s3,
    mock_resource_metadata_dao,
    mock_datetime,
    mock_project_dao,
    mock_user_dao,
    mock_file,
    mock_scheduler,
):
    mock_project_dao.get_all.return_value = MOCK_PROJECTS
    mock_user_dao.get_all.return_value = MOCK_USERS

    # test calling with one resource since we've tested each resource individually
    mock_event = {"body": json.dumps({"requestedResources": ["Personnel", "Endpoints"]})}
    mock_datetime.now.return_value = datetime.fromisoformat("2022-10-11T23:05:50")

    expected_response = generate_html_response(
        200,
        {
            "personnelReport": "s3://mlspace-data-bucket/mlspace-report/" "mlspace-report-personnel-20221011-230550.csv",
            "resourceReport": "s3://mlspace-data-bucket/mlspace-report/" "mlspace-report-20221011-230550.csv",
        },
    )

    mock_scheduler.get_all_project_resources.return_value = []
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults()

    assert create(mock_event, mock_context) == expected_response

    mock_file.assert_has_calls(
        [
            mock.call("/tmp/mlspace-report-personnel-20221011-230550.csv", mode="w"),
            mock.call().__enter__(),
            mock.call().write("Common Name,DN,Email,Is Admin\r\n"),
            mock.call().write("Test User1,TestUser1,test1@amazon.com,No\r\n"),
            mock.call().write("Test User2,TestUser2,test2@amazon.com,No\r\n"),
            mock.call().write("Test User3,TestUser3,test3@amazon.com,No\r\n"),
            mock.call().__exit__(None, None, None),
            mock.call("/tmp/mlspace-report-20221011-230550.csv", mode="w"),
            mock.call().__enter__(),
            mock.call().write(
                "Project,Resource Type,Owner,Resource Name,Status,Created,Modified,"
                "Auto-termination/Auto-stop Time,Instance Type,Total Training Jobs,Cluster Release,Source Language Code,Target Language Codes,Task Type\r\n"
            ),
            mock.call().__exit__(None, None, None),
        ]
    )

    mock_s3.upload_file.assert_has_calls(
        [
            mock.call(
                Filename="/tmp/mlspace-report-personnel-20221011-230550.csv",
                Bucket="mlspace-data-bucket",
                Key="mlspace-report/mlspace-report-personnel-20221011-230550.csv",
            ),
            mock.call(
                Filename="/tmp/mlspace-report-20221011-230550.csv",
                Bucket="mlspace-data-bucket",
                Key="mlspace-report/mlspace-report-20221011-230550.csv",
            ),
        ]
    )
    mock_project_dao.get_all.assert_called_with(include_suspended=True, project_names=None)
    mock_user_dao.get_all.assert_called_with(include_suspended=True)
    mock_scheduler.get_all_project_resources.assert_has_calls(
        [
            mock.call(MOCK_PROJECTS[0].name),
            mock.call(MOCK_PROJECTS[1].name),
        ],
        True,
    )
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [
            mock.call(project=MOCK_PROJECTS[0].name, fetch_all=True, type=ResourceType.ENDPOINT),
            mock.call(project=MOCK_PROJECTS[1].name, fetch_all=True, type=ResourceType.ENDPOINT),
        ]
    )


@mock.patch("ml_space_lambda.report.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.user_dao")
@mock.patch("ml_space_lambda.report.lambda_functions.datetime")
@mock.patch("ml_space_lambda.report.lambda_functions.s3")
def test_create_report_s3_error(mock_s3, mock_datetime, mock_user_dao, mock_project_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the UploadFile operation: " "Dummy error message.",
    )
    mock_event = {"body": json.dumps({"requestedResources": ["Personnel"]})}

    mock_user_dao.get_all.return_value = MOCK_USERS
    mock_datetime.now.return_value = datetime.fromisoformat("2022-10-11T23:05:50")

    mock_s3.upload_file.side_effect = ClientError(error_msg, "UploadFile")

    assert create(mock_event, mock_context) == expected_response

    mock_s3.upload_file.assert_called_with(
        Filename="/tmp/mlspace-report-personnel-20221011-230550.csv",
        Bucket="mlspace-data-bucket",
        Key="mlspace-report/mlspace-report-personnel-20221011-230550.csv",
    )
    mock_project_dao.get_all.assert_not_called()


def test_create_report_no_resources():
    mock_event = {"body": json.dumps({"requestedResources": []})}
    assert create(mock_event, mock_context) == generate_html_response(200, {})
