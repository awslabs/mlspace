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
from unittest import mock

from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.migration.lambda_functions import sync_metadata as lambda_handler

mock_context = mock.Mock()


def test_sync_no_resource_types():
    expected_response = generate_html_response(
        200, {"success": True, "message": "No resource types were specified."}
    )
    response = lambda_handler({"body": json.dumps({})}, mock_context)
    assert response == expected_response


mock_project_name = "test-project-1"
mock_secondary_project = "test-project-2"
mock_user_name = "jdoe@amazon.com"
mock_secondary_user = "asmith@amazon.com"
mock_tags_respones = [
    [
        {
            "Key": "user",
            "Value": mock_user_name,
        },
        {
            "Key": "project",
            "Value": mock_project_name,
        },
        {
            "Key": "system",
            "Value": "MLSpace",
        },
    ],
    [
        {
            "Key": "user",
            "Value": mock_secondary_user,
        },
        {
            "Key": "project",
            "Value": mock_project_name,
        },
        {
            "Key": "system",
            "Value": "MLSpace",
        },
    ],
    [
        {
            "Key": "user",
            "Value": mock_secondary_user,
        },
        {
            "Key": "org",
            "Value": "irrelevant tag",
        },
        {
            "Key": "project",
            "Value": mock_secondary_project,
        },
        {
            "Key": "system",
            "Value": "MLSpace",
        },
    ],
    [
        {
            "Key": "org",
            "Value": "irrelevant tag",
        },
    ],
]


@mock.patch("ml_space_lambda.migration.lambda_functions.get_tags_for_resource")
@mock.patch("ml_space_lambda.migration.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.migration.lambda_functions.sagemaker")
def test_sync_notebook_metadata(mock_sagemaker, mock_resource_metadata_dao, mock_get_tags):
    expected_response = generate_html_response(
        200,
        {
            "success": True,
            "message": "Successfully created resource metadata records for the selected resource types.",
        },
    )
    notebook1_metadata = {
        "NotebookInstanceArn": "arn:aws:sagemaker:us-east-1:123456789:notebook-instance/test-notebook-1",
        "CreationTime": "2023-08-09 15:03:52.277000+00:00",
        "LastModifiedTime": "2023-08-10 18:04:56.557000+00:00",
        "InstanceType": "c5.large",
        "NotebookInstanceLifecycleConfigName": "mlspace-test-config",
        "NotebookInstanceStatus": "InService",
    }
    notebook2_metadata = {
        "NotebookInstanceArn": "arn:aws:sagemaker:us-east-1:123456789:notebook-instance/test-notebook-2",
        "CreationTime": "2023-08-11 09:33:05.109000+00:00",
        "LastModifiedTime": "2023-08-12 05:54:10.097000+00:00",
        "InstanceType": "m5.large",
        "NotebookInstanceLifecycleConfigName": "mlspace-test-config",
        "NotebookInstanceStatus": "Stopped",
    }
    notebook3_metadata = {
        "NotebookInstanceArn": "arn:aws:sagemaker:us-east-1:123456789:notebook-instance/test-notebook-3",
        "CreationTime": "2023-08-13 17:12:31.865000+00:00",
        "LastModifiedTime": "2023-08-13 17:12:31.865000+00:00",
        "InstanceType": "m5.large",
        "NotebookInstanceLifecycleConfigName": "mlspace-test-config",
        "NotebookInstanceStatus": "Pending",
    }
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [
        {
            "NotebookInstances": [
                {
                    "NotebookInstanceName": "test-notebook-1",
                    "NotebookInstanceArn": notebook1_metadata["NotebookInstanceArn"],
                    "NotebookInstanceStatus": notebook1_metadata["NotebookInstanceStatus"],
                    "InstanceType": notebook1_metadata["InstanceType"],
                    "CreationTime": notebook1_metadata["CreationTime"],
                    "LastModifiedTime": notebook1_metadata["LastModifiedTime"],
                    "NotebookInstanceLifecycleConfigName": notebook1_metadata[
                        "NotebookInstanceLifecycleConfigName"
                    ],
                },
                {
                    "NotebookInstanceName": "test-notebook-2",
                    "NotebookInstanceArn": notebook2_metadata["NotebookInstanceArn"],
                    "NotebookInstanceStatus": notebook2_metadata["NotebookInstanceStatus"],
                    "InstanceType": notebook2_metadata["InstanceType"],
                    "CreationTime": notebook2_metadata["CreationTime"],
                    "LastModifiedTime": notebook2_metadata["LastModifiedTime"],
                    "NotebookInstanceLifecycleConfigName": notebook2_metadata[
                        "NotebookInstanceLifecycleConfigName"
                    ],
                },
                {
                    "NotebookInstanceName": "test-notebook-3",
                    "NotebookInstanceArn": notebook3_metadata["NotebookInstanceArn"],
                    "NotebookInstanceStatus": notebook3_metadata["NotebookInstanceStatus"],
                    "InstanceType": notebook3_metadata["InstanceType"],
                    "CreationTime": notebook3_metadata["CreationTime"],
                    "LastModifiedTime": notebook3_metadata["LastModifiedTime"],
                    "NotebookInstanceLifecycleConfigName": notebook3_metadata[
                        "NotebookInstanceLifecycleConfigName"
                    ],
                },
                {
                    "NotebookInstanceName": "test-notebook-4",
                    "NotebookInstanceArn": "fakeNotebookArn",
                    "NotebookInstanceStatus": "Pending",
                    "InstanceType": "m5.large",
                    "CreationTime": "2023-08-19 07:03:12.109000+00:00",
                    "NotebookInstanceLifecycleConfigName": "fakeConfig",
                },
            ]
        },
    ]
    mock_sagemaker.get_paginator.return_value = mock_paginator
    mock_get_tags.side_effect = mock_tags_respones
    mock_resource_metadata_dao.upsert_record.side_effect = [
        None,
        None,
        ValueError("Totally fake error"),
    ]
    response = lambda_handler({"body": json.dumps({"resourceTypes": ["Notebooks"]})}, mock_context)
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called_with("list_notebook_instances")
    mock_get_tags.assert_has_calls(
        [
            mock.call(mock_sagemaker, notebook1_metadata["NotebookInstanceArn"]),
            mock.call(mock_sagemaker, notebook2_metadata["NotebookInstanceArn"]),
            mock.call(mock_sagemaker, notebook3_metadata["NotebookInstanceArn"]),
        ]
    )
    mock_resource_metadata_dao.upsert_record.assert_has_calls(
        [
            mock.call(
                "test-notebook-1",
                ResourceType.NOTEBOOK,
                mock_user_name,
                mock_project_name,
                notebook1_metadata,
            ),
            mock.call(
                "test-notebook-2",
                ResourceType.NOTEBOOK,
                mock_secondary_user,
                mock_project_name,
                notebook2_metadata,
            ),
            mock.call(
                "test-notebook-3",
                ResourceType.NOTEBOOK,
                mock_secondary_user,
                mock_secondary_project,
                notebook3_metadata,
            ),
        ]
    )


@mock.patch("ml_space_lambda.migration.lambda_functions.get_tags_for_resource")
@mock.patch("ml_space_lambda.migration.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.migration.lambda_functions.sagemaker")
def test_sync_endpoint_metadata(mock_sagemaker, mock_resource_metadata_dao, mock_get_tags):
    expected_response = generate_html_response(
        200,
        {
            "success": True,
            "message": "Successfully created resource metadata records for the selected resource types.",
        },
    )
    endpoint1_metadata = {
        "EndpointArn": "arn:aws:sagemaker:us-east-1:123456789:endpoint/test-endpoint-1",
        "CreationTime": "2023-08-09 15:03:52.277000+00:00",
        "LastModifiedTime": "2023-08-09 16:03:52.277000+00:00",
        "EndpointStatus": "Creating",
    }
    endpoint2_metadata = {
        "EndpointArn": "arn:aws:sagemaker:us-east-1:123456789:endpoint/test-endpoint-2",
        "CreationTime": "2023-08-11 09:33:05.109000+00:00",
        "LastModifiedTime": "2023-08-11 11:03:52.277000+00:00",
        "EndpointStatus": "Updating",
    }
    endpoint3_metadata = {
        "EndpointArn": "arn:aws:sagemaker:us-east-1:123456789:endpoint/test-endpoint-3",
        "CreationTime": "2023-08-13 17:12:31.865000+00:00",
        "LastModifiedTime": "2023-08-13 22:03:52.277000+00:00",
        "EndpointStatus": "InService",
    }
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [
        {
            "Endpoints": [
                {
                    "EndpointName": "test-endpoint-1",
                    "EndpointArn": endpoint1_metadata["EndpointArn"],
                    "EndpointStatus": endpoint1_metadata["EndpointStatus"],
                    "CreationTime": endpoint1_metadata["CreationTime"],
                    "LastModifiedTime": endpoint1_metadata["LastModifiedTime"],
                },
                {
                    "EndpointName": "test-endpoint-2",
                    "EndpointArn": endpoint2_metadata["EndpointArn"],
                    "EndpointStatus": endpoint2_metadata["EndpointStatus"],
                    "CreationTime": endpoint2_metadata["CreationTime"],
                    "LastModifiedTime": endpoint2_metadata["LastModifiedTime"],
                },
                {
                    "EndpointName": "test-endpoint-3",
                    "EndpointArn": endpoint3_metadata["EndpointArn"],
                    "EndpointStatus": endpoint3_metadata["EndpointStatus"],
                    "CreationTime": endpoint3_metadata["CreationTime"],
                    "LastModifiedTime": endpoint3_metadata["LastModifiedTime"],
                },
                {
                    "EndpointName": "test-endpoint-4",
                    "EndpointArn": "fakeEndpointArn",
                    "EndpointStatus": "InService",
                    "CreationTime": "2023-08-16 12:53:41.354000+00:00",
                    "LastModifiedTime": "2023-08-16 12:53:41.354000+00:00",
                },
            ]
        },
    ]
    mock_sagemaker.get_paginator.return_value = mock_paginator
    mock_get_tags.side_effect = mock_tags_respones
    mock_resource_metadata_dao.upsert_record.side_effect = [
        None,
        None,
        ValueError("Totally fake error"),
    ]
    response = lambda_handler({"body": json.dumps({"resourceTypes": ["Endpoints"]})}, mock_context)
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called_with("list_endpoints")
    mock_get_tags.assert_has_calls(
        [
            mock.call(mock_sagemaker, endpoint1_metadata["EndpointArn"]),
            mock.call(mock_sagemaker, endpoint2_metadata["EndpointArn"]),
            mock.call(mock_sagemaker, endpoint3_metadata["EndpointArn"]),
        ]
    )
    mock_resource_metadata_dao.upsert_record.assert_has_calls(
        [
            mock.call(
                "test-endpoint-1",
                ResourceType.ENDPOINT,
                mock_user_name,
                mock_project_name,
                endpoint1_metadata,
            ),
            mock.call(
                "test-endpoint-2",
                ResourceType.ENDPOINT,
                mock_secondary_user,
                mock_project_name,
                endpoint2_metadata,
            ),
            mock.call(
                "test-endpoint-3",
                ResourceType.ENDPOINT,
                mock_secondary_user,
                mock_secondary_project,
                endpoint3_metadata,
            ),
        ]
    )


@mock.patch("ml_space_lambda.migration.lambda_functions.get_tags_for_resource")
@mock.patch("ml_space_lambda.migration.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.migration.lambda_functions.sagemaker")
def test_sync_model_metadata(mock_sagemaker, mock_resource_metadata_dao, mock_get_tags):
    expected_response = generate_html_response(
        200,
        {
            "success": True,
            "message": "Successfully created resource metadata records for the selected resource types.",
        },
    )
    model1_metadata = {
        "ModelArn": "arn:aws:sagemaker:us-east-1:123456789:model/test-model-1",
        "CreationTime": "2023-08-09 15:03:52.277000+00:00",
    }
    model2_metadata = {
        "ModelArn": "arn:aws:sagemaker:us-east-1:123456789:model/test-model-2",
        "CreationTime": "2023-08-11 09:33:05.109000+00:00",
    }
    model3_metadata = {
        "ModelArn": "arn:aws:sagemaker:us-east-1:123456789:model/test-model-3",
        "CreationTime": "2023-08-13 17:12:31.865000+00:00",
    }
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [
        {
            "Models": [
                {
                    "ModelName": "test-model-1",
                    "ModelArn": model1_metadata["ModelArn"],
                    "CreationTime": model1_metadata["CreationTime"],
                },
                {
                    "ModelName": "test-model-2",
                    "ModelArn": model2_metadata["ModelArn"],
                    "CreationTime": model2_metadata["CreationTime"],
                },
                {
                    "ModelName": "test-model-3",
                    "ModelArn": model3_metadata["ModelArn"],
                    "CreationTime": model3_metadata["CreationTime"],
                },
                {
                    "ModelName": "test-model-4",
                    "ModelArn": "fakeModelArn",
                    "CreationTime": "2023-08-16 12:53:41.354000+00:00",
                },
            ]
        },
    ]
    mock_sagemaker.get_paginator.return_value = mock_paginator
    mock_get_tags.side_effect = mock_tags_respones
    mock_resource_metadata_dao.upsert_record.side_effect = [
        None,
        None,
        ValueError("Totally fake error"),
    ]
    response = lambda_handler({"body": json.dumps({"resourceTypes": ["Models"]})}, mock_context)
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called_with("list_models")
    mock_get_tags.assert_has_calls(
        [
            mock.call(mock_sagemaker, model1_metadata["ModelArn"]),
            mock.call(mock_sagemaker, model2_metadata["ModelArn"]),
            mock.call(mock_sagemaker, model3_metadata["ModelArn"]),
        ]
    )
    mock_resource_metadata_dao.upsert_record.assert_has_calls(
        [
            mock.call(
                "test-model-1",
                ResourceType.MODEL,
                mock_user_name,
                mock_project_name,
                model1_metadata,
            ),
            mock.call(
                "test-model-2",
                ResourceType.MODEL,
                mock_secondary_user,
                mock_project_name,
                model2_metadata,
            ),
            mock.call(
                "test-model-3",
                ResourceType.MODEL,
                mock_secondary_user,
                mock_secondary_project,
                model3_metadata,
            ),
        ]
    )


@mock.patch("ml_space_lambda.migration.lambda_functions.get_tags_for_resource")
@mock.patch("ml_space_lambda.migration.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.migration.lambda_functions.sagemaker")
def test_sync_training_jobs(mock_sagemaker, mock_resource_metadata_dao, mock_get_tags):
    expected_response = generate_html_response(
        200,
        {
            "success": True,
            "message": "Successfully created resource metadata records for the selected resource types.",
        },
    )
    job1_metadata = {
        "CreationTime": "2023-08-09 15:03:52.277000+00:00",
        "TrainingJobArn": "arn:aws:sagemaker:us-east-1:123456789:training-job/test-job-1",
        "TrainingJobStatus": "Failed",
        "LastModifiedTime": "2023-08-09 15:03:52.277000+00:00",
        "TrainingStartTime": "2023-08-09 15:03:52.277000+00:00",
        "TrainingEndTime": "2023-08-09 15:05:12.087000+00:00",
        "FailureReason": "Something bad happened.",
    }
    job2_metadata = {
        "CreationTime": "2023-08-11 09:33:05.109000+00:00",
        "TrainingJobArn": "arn:aws:sagemaker:us-east-1:123456789:training-job/test-job-2",
        "TrainingJobStatus": "InProgress",
        "LastModifiedTime": "2023-08-12 15:03:52.277000+00:00",
        "TrainingStartTime": "2023-08-09 15:03:52.277000+00:00",
        "TrainingEndTime": None,
        "FailureReason": None,
    }
    job3_metadata = {
        "CreationTime": "2023-08-13 17:12:31.865000+00:00",
        "TrainingJobArn": "arn:aws:sagemaker:us-east-1:123456789:training-job/test-job-3",
        "TrainingJobStatus": "Completed",
        "LastModifiedTime": "2023-08-13 19:03:52.277000+00:00",
        "TrainingStartTime": "2023-08-09 17:14:31.865000+00:00",
        "TrainingEndTime": "2023-08-09 20:22:04.113000+00:00",
        "FailureReason": None,
    }
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [
        {
            "TrainingJobSummaries": [
                {
                    "TrainingJobName": "test-job-1",
                    "TrainingJobArn": job1_metadata["TrainingJobArn"],
                },
                {
                    "TrainingJobName": "test-job-2",
                    "TrainingJobArn": job2_metadata["TrainingJobArn"],
                },
                {
                    "TrainingJobName": "test-job-3",
                    "TrainingJobArn": job3_metadata["TrainingJobArn"],
                },
            ]
        },
    ]
    mock_sagemaker.get_paginator.return_value = mock_paginator
    mock_get_tags.side_effect = mock_tags_respones
    mock_sagemaker.describe_training_job.side_effect = [
        {
            "TrainingJobName": "test-job-1",
            "TrainingJobArn": job1_metadata["TrainingJobArn"],
            "CreationTime": job1_metadata["CreationTime"],
            "LastModifiedTime": job1_metadata["LastModifiedTime"],
            "TrainingJobStatus": job1_metadata["TrainingJobStatus"],
            "TrainingStartTime": job1_metadata["TrainingStartTime"],
            "TrainingEndTime": job1_metadata["TrainingEndTime"],
            "FailureReason": job1_metadata["FailureReason"],
        },
        {
            "TrainingJobName": "test-job-2",
            "TrainingJobArn": job2_metadata["TrainingJobArn"],
            "CreationTime": job2_metadata["CreationTime"],
            "LastModifiedTime": job2_metadata["LastModifiedTime"],
            "TrainingJobStatus": job2_metadata["TrainingJobStatus"],
            "TrainingStartTime": job2_metadata["TrainingStartTime"],
            "TrainingEndTime": job2_metadata["TrainingEndTime"],
            "FailureReason": job2_metadata["FailureReason"],
        },
        {
            "TrainingJobName": "test-job-3",
            "TrainingJobArn": job3_metadata["TrainingJobArn"],
            "CreationTime": job3_metadata["CreationTime"],
            "LastModifiedTime": job3_metadata["LastModifiedTime"],
            "TrainingJobStatus": job3_metadata["TrainingJobStatus"],
            "TrainingStartTime": job3_metadata["TrainingStartTime"],
            "TrainingEndTime": job3_metadata["TrainingEndTime"],
            "FailureReason": job3_metadata["FailureReason"],
        },
    ]
    mock_resource_metadata_dao.upsert_record.side_effect = [
        None,
        None,
        ValueError("Totally fake error"),
    ]
    response = lambda_handler(
        {"body": json.dumps({"resourceTypes": ["TrainingJobs"]})}, mock_context
    )
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called_with("list_training_jobs")
    mock_get_tags.assert_has_calls(
        [
            mock.call(mock_sagemaker, job1_metadata["TrainingJobArn"]),
            mock.call(mock_sagemaker, job2_metadata["TrainingJobArn"]),
            mock.call(mock_sagemaker, job3_metadata["TrainingJobArn"]),
        ]
    )
    mock_sagemaker.describe_training_job.assert_has_calls(
        [
            mock.call(TrainingJobName="test-job-1"),
            mock.call(TrainingJobName="test-job-2"),
            mock.call(TrainingJobName="test-job-3"),
        ]
    )
    mock_resource_metadata_dao.upsert_record.assert_has_calls(
        [
            mock.call(
                "test-job-1",
                ResourceType.TRAINING_JOB,
                mock_user_name,
                mock_project_name,
                job1_metadata,
            ),
            mock.call(
                "test-job-2",
                ResourceType.TRAINING_JOB,
                mock_secondary_user,
                mock_project_name,
                job2_metadata,
            ),
            mock.call(
                "test-job-3",
                ResourceType.TRAINING_JOB,
                mock_secondary_user,
                mock_secondary_project,
                job3_metadata,
            ),
        ]
    )


@mock.patch("ml_space_lambda.migration.lambda_functions.get_tags_for_resource")
@mock.patch("ml_space_lambda.migration.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.migration.lambda_functions.sagemaker")
def test_sync_transform_metadata(mock_sagemaker, mock_resource_metadata_dao, mock_get_tags):
    expected_response = generate_html_response(
        200,
        {
            "success": True,
            "message": "Successfully created resource metadata records for the selected resource types.",
        },
    )
    job1_metadata = {
        "CreationTime": "2023-08-09 15:03:52.277000+00:00",
        "TransformJobArn": "arn:aws:sagemaker:us-east-1:123456789:transform-job/test-job-1",
        "TransformJobStatus": "Failed",
        "LastModifiedTime": "2023-08-09 15:03:52.277000+00:00",
        "TransformStartTime": None,
        "TransformEndTime": "2023-08-09 15:05:12.087000+00:00",
        "FailureReason": "Something bad happened.",
    }
    job2_metadata = {
        "CreationTime": "2023-08-11 09:33:05.109000+00:00",
        "TransformJobArn": "arn:aws:sagemaker:us-east-1:123456789:transform-job/test-job-2",
        "TransformJobStatus": "InProgress",
        "LastModifiedTime": "2023-08-12 15:03:52.277000+00:00",
        "TransformStartTime": None,
        "TransformEndTime": None,
        "FailureReason": None,
    }
    job3_metadata = {
        "CreationTime": "2023-08-13 17:12:31.865000+00:00",
        "TransformJobArn": "arn:aws:sagemaker:us-east-1:123456789:transform-job/test-job-3",
        "TransformJobStatus": "Completed",
        "LastModifiedTime": "2023-08-13 19:03:52.277000+00:00",
        "TransformStartTime": None,
        "TransformEndTime": "2023-08-09 20:22:04.113000+00:00",
        "FailureReason": None,
    }
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [
        {
            "TransformJobSummaries": [
                {
                    "TransformJobName": "test-job-1",
                    "TransformJobArn": job1_metadata["TransformJobArn"],
                    "CreationTime": job1_metadata["CreationTime"],
                    "TransformJobStatus": job1_metadata["TransformJobStatus"],
                    "LastModifiedTime": job1_metadata["LastModifiedTime"],
                    "TransformEndTime": job1_metadata["TransformEndTime"],
                    "FailureReason": job1_metadata["FailureReason"],
                },
                {
                    "TransformJobName": "test-job-2",
                    "TransformJobArn": job2_metadata["TransformJobArn"],
                    "CreationTime": job2_metadata["CreationTime"],
                    "TransformJobStatus": job2_metadata["TransformJobStatus"],
                    "LastModifiedTime": job2_metadata["LastModifiedTime"],
                    "TransformEndTime": job2_metadata["TransformEndTime"],
                    "FailureReason": job2_metadata["FailureReason"],
                },
                {
                    "TransformJobName": "test-job-3",
                    "TransformJobArn": job3_metadata["TransformJobArn"],
                    "CreationTime": job3_metadata["CreationTime"],
                    "TransformJobStatus": job3_metadata["TransformJobStatus"],
                    "LastModifiedTime": job3_metadata["LastModifiedTime"],
                    "TransformEndTime": job3_metadata["TransformEndTime"],
                    "FailureReason": job3_metadata["FailureReason"],
                },
            ]
        },
    ]
    mock_sagemaker.get_paginator.return_value = mock_paginator
    mock_get_tags.side_effect = mock_tags_respones
    mock_resource_metadata_dao.upsert_record.side_effect = [
        None,
        None,
        ValueError("Totally fake error"),
    ]
    response = lambda_handler(
        {"body": json.dumps({"resourceTypes": ["TransformJobs"]})}, mock_context
    )
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called_with("list_transform_jobs")
    mock_get_tags.assert_has_calls(
        [
            mock.call(mock_sagemaker, job1_metadata["TransformJobArn"]),
            mock.call(mock_sagemaker, job2_metadata["TransformJobArn"]),
            mock.call(mock_sagemaker, job3_metadata["TransformJobArn"]),
        ]
    )
    mock_resource_metadata_dao.upsert_record.assert_has_calls(
        [
            mock.call(
                "test-job-1",
                ResourceType.TRANSFORM_JOB,
                mock_user_name,
                mock_project_name,
                job1_metadata,
            ),
            mock.call(
                "test-job-2",
                ResourceType.TRANSFORM_JOB,
                mock_secondary_user,
                mock_project_name,
                job2_metadata,
            ),
            mock.call(
                "test-job-3",
                ResourceType.TRANSFORM_JOB,
                mock_secondary_user,
                mock_secondary_project,
                job3_metadata,
            ),
        ]
    )


@mock.patch("ml_space_lambda.migration.lambda_functions.get_tags_for_resource")
@mock.patch("ml_space_lambda.migration.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.migration.lambda_functions.sagemaker")
def test_sync_endpoint_config_metadata(mock_sagemaker, mock_resource_metadata_dao, mock_get_tags):
    expected_response = generate_html_response(
        200,
        {
            "success": True,
            "message": "Successfully created resource metadata records for the selected resource types.",
        },
    )
    config1_metadata = {
        "EndpointConfigArn": "arn:aws:sagemaker:us-east-1:123456789:endpoint-config/test-config-1",
        "CreationTime": "2023-08-09 15:03:52.277000+00:00",
    }
    config2_metadata = {
        "EndpointConfigArn": "arn:aws:sagemaker:us-east-1:123456789:endpoint-config/test-config-2",
        "CreationTime": "2023-08-11 09:33:05.109000+00:00",
    }
    config3_metadata = {
        "EndpointConfigArn": "arn:aws:sagemaker:us-east-1:123456789:endpoint-config/test-config-3",
        "CreationTime": "2023-08-13 17:12:31.865000+00:00",
    }
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [
        {
            "EndpointConfigs": [
                {
                    "EndpointConfigName": "test-config-1",
                    "EndpointConfigArn": config1_metadata["EndpointConfigArn"],
                    "CreationTime": config1_metadata["CreationTime"],
                },
                {
                    "EndpointConfigName": "test-config-2",
                    "EndpointConfigArn": config2_metadata["EndpointConfigArn"],
                    "CreationTime": config2_metadata["CreationTime"],
                },
                {
                    "EndpointConfigName": "test-config-3",
                    "EndpointConfigArn": config3_metadata["EndpointConfigArn"],
                    "CreationTime": config3_metadata["CreationTime"],
                },
            ]
        },
    ]
    mock_sagemaker.get_paginator.return_value = mock_paginator
    mock_get_tags.side_effect = mock_tags_respones
    mock_resource_metadata_dao.upsert_record.side_effect = [
        None,
        None,
        ValueError("Totally fake error"),
    ]
    response = lambda_handler(
        {"body": json.dumps({"resourceTypes": ["EndpointConfigs"]})}, mock_context
    )
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called_with("list_endpoint_configs")
    mock_get_tags.assert_has_calls(
        [
            mock.call(mock_sagemaker, config1_metadata["EndpointConfigArn"]),
            mock.call(mock_sagemaker, config2_metadata["EndpointConfigArn"]),
            mock.call(mock_sagemaker, config3_metadata["EndpointConfigArn"]),
        ]
    )
    mock_resource_metadata_dao.upsert_record.assert_has_calls(
        [
            mock.call(
                "test-config-1",
                ResourceType.ENDPOINT_CONFIG,
                mock_user_name,
                mock_project_name,
                config1_metadata,
            ),
            mock.call(
                "test-config-2",
                ResourceType.ENDPOINT_CONFIG,
                mock_secondary_user,
                mock_project_name,
                config2_metadata,
            ),
            mock.call(
                "test-config-3",
                ResourceType.ENDPOINT_CONFIG,
                mock_secondary_user,
                mock_secondary_project,
                config3_metadata,
            ),
        ]
    )


@mock.patch("ml_space_lambda.migration.lambda_functions.get_tags_for_resource")
@mock.patch("ml_space_lambda.migration.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.migration.lambda_functions.sagemaker")
def test_sync_hpo_jobs(mock_sagemaker, mock_resource_metadata_dao, mock_get_tags):
    expected_response = generate_html_response(
        200,
        {
            "success": True,
            "message": "Successfully created resource metadata records for the selected resource types.",
        },
    )
    job1_metadata = {
        "CreationTime": "2023-08-09 15:03:52.277000+00:00",
        "FailureReason": "Something bad happened.",
        "HyperParameterTuningEndTime": "2023-08-09 15:05:12.087000+00:00",
        "HyperParameterTuningJobArn": "arn:aws:sagemaker:us-east-1:123456789:training-job/Test-Job-1",
        "HyperParameterTuningJobStatus": "Failed",
        "LastModifiedTime": "2023-08-09 15:03:52.277000+00:00",
        "Strategy": "Bayesian",
        "TrainingJobStatusCounters": {
            "Completed": 2,
            "InProgress": 0,
            "RetryableError": 0,
            "NonRetryableError": 1,
            "Stopped": 0,
        },
    }
    job2_metadata = {
        "CreationTime": "2023-08-11 09:33:05.109000+00:00",
        "FailureReason": None,
        "HyperParameterTuningEndTime": None,
        "HyperParameterTuningJobArn": "arn:aws:sagemaker:us-east-1:123456789:training-job/test-job-2",
        "HyperParameterTuningJobStatus": "InProgress",
        "LastModifiedTime": "2023-08-12 15:03:52.277000+00:00",
        "Strategy": "Bayesian",
        "TrainingJobStatusCounters": {
            "Completed": 3,
            "InProgress": 3,
            "RetryableError": 0,
            "NonRetryableError": 0,
            "Stopped": 0,
        },
    }
    job3_metadata = {
        "CreationTime": "2023-08-13 17:12:31.865000+00:00",
        "FailureReason": None,
        "HyperParameterTuningEndTime": "2023-08-09 20:22:04.113000+00:00",
        "HyperParameterTuningJobArn": "arn:aws:sagemaker:us-east-1:123456789:training-job/test-job-3",
        "HyperParameterTuningJobStatus": "Completed",
        "LastModifiedTime": "2023-08-13 19:03:52.277000+00:00",
        "Strategy": "Bayesian",
        "TrainingJobStatusCounters": {
            "Completed": 6,
            "InProgress": 0,
            "RetryableError": 0,
            "NonRetryableError": 0,
            "Stopped": 1,
        },
    }
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [
        {
            "HyperParameterTuningJobSummaries": [
                {
                    **job1_metadata,
                    "HyperParameterTuningJobArn": job1_metadata[
                        "HyperParameterTuningJobArn"
                    ].lower(),
                    "HyperParameterTuningJobName": "Test-Job-1",
                },
                {
                    **job2_metadata,
                    "HyperParameterTuningJobArn": job2_metadata[
                        "HyperParameterTuningJobArn"
                    ].lower(),
                    "HyperParameterTuningJobName": "test-job-2",
                },
                {
                    **job3_metadata,
                    "HyperParameterTuningJobArn": job3_metadata[
                        "HyperParameterTuningJobArn"
                    ].lower(),
                    "HyperParameterTuningJobName": "test-job-3",
                },
            ]
        },
    ]
    mock_sagemaker.get_paginator.return_value = mock_paginator
    mock_get_tags.side_effect = mock_tags_respones
    mock_sagemaker.describe_hyper_parameter_tuning_job.side_effect = [
        {
            "HyperParameterTuningJobName": "Test-Job-1",
            "HyperParameterTuningJobArn": job1_metadata["HyperParameterTuningJobArn"],
        },
        {
            "HyperParameterTuningJobName": "test-job-2",
            "HyperParameterTuningJobArn": job2_metadata["HyperParameterTuningJobArn"],
        },
        {
            "HyperParameterTuningJobName": "test-job-3",
            "HyperParameterTuningJobArn": job3_metadata["HyperParameterTuningJobArn"],
        },
    ]
    mock_resource_metadata_dao.upsert_record.side_effect = [
        None,
        None,
        ValueError("Totally fake error"),
    ]
    response = lambda_handler({"body": json.dumps({"resourceTypes": ["HPOJobs"]})}, mock_context)
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called_with("list_hyper_parameter_tuning_jobs")
    mock_get_tags.assert_has_calls(
        [
            mock.call(mock_sagemaker, job1_metadata["HyperParameterTuningJobArn"]),
            mock.call(mock_sagemaker, job2_metadata["HyperParameterTuningJobArn"]),
            mock.call(mock_sagemaker, job3_metadata["HyperParameterTuningJobArn"]),
        ]
    )
    mock_resource_metadata_dao.upsert_record.assert_has_calls(
        [
            mock.call(
                "Test-Job-1",
                ResourceType.HPO_JOB,
                mock_user_name,
                mock_project_name,
                job1_metadata,
            ),
            mock.call(
                "test-job-2",
                ResourceType.HPO_JOB,
                mock_secondary_user,
                mock_project_name,
                job2_metadata,
            ),
            mock.call(
                "test-job-3",
                ResourceType.HPO_JOB,
                mock_secondary_user,
                mock_secondary_project,
                job3_metadata,
            ),
        ]
    )
    mock_sagemaker.describe_hyper_parameter_tuning_job.assert_has_calls(
        [
            mock.call(HyperParameterTuningJobName="Test-Job-1"),
            mock.call(HyperParameterTuningJobName="test-job-2"),
            mock.call(HyperParameterTuningJobName="test-job-3"),
        ]
    )
