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
import time
from typing import Any, Dict, List, Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import update as lambda_handler

mock_context = mock.Mock()

MOCK_PROJECT_NAME = "UnitTestProject"
now = time.time()


def _mock_event(
    suspened: Optional[bool] = True,
    description: Optional[str] = None,
    metadata: Dict[str, Any] = None,
) -> Dict[str, Any]:
    body: Dict[str, Any] = {"suspended": suspened}
    if description:
        body["description"] = description
    if metadata:
        body["metadata"] = metadata
    return {
        "requestContext": {"authorizer": {"principalId": "jdoe@example.com"}},
        "pathParameters": {"projectName": MOCK_PROJECT_NAME},
        "body": json.dumps(body),
    }


def mock_project(
    suspened: Optional[bool] = False,
    description: Optional[str] = None,
    metadata: Dict[str, Any] = None,
) -> ProjectModel:
    return ProjectModel(
        name=MOCK_PROJECT_NAME,
        description="Project for unit tests" if not description else description,
        suspended=suspened,
        created_by="jdoe@example.com",
        metadata={} if not metadata else metadata,
        created_at=now,
        last_updated_at=now,
    )


def _notebook_entry(name: str, state: Optional[str] = "InService") -> ResourceMetadataModel:
    return ResourceMetadataModel(
        name,
        ResourceType.NOTEBOOK,
        "jdoe@amazon.com",
        MOCK_PROJECT_NAME,
        {
            "NotebookInstanceArn": f"arn:aws:sagemaker:us-east-1:123456789:notebook-instance/{name}",
            "NotebookInstanceStatus": state,
            "InstanceType": "ml.t2.medium",
            "NotebookInstanceLifecycleConfigName": "mlspace-notebook-lifecycle-config",
        },
    )


def _training_job_entry(name: str) -> Dict[str, Any]:
    return ResourceMetadataModel(
        name,
        ResourceType.TRAINING_JOB,
        "jdoe@amazon.com",
        MOCK_PROJECT_NAME,
        {
            "TrainingJobArn": f"arn::fake::{name}",
            "TrainingJobStatus": "InProgress",
        },
    )


def _transform_job_entry(name: str) -> ResourceMetadataModel:
    return ResourceMetadataModel(
        name,
        ResourceType.TRANSFORM_JOB,
        "jdoe@amazon.com",
        MOCK_PROJECT_NAME,
        {
            "TransformJobArn": f"arn::fake::{name}",
            "TransformJobStatus": "InProgress",
        },
    )


def _hyper_parameter_job_entry(name: str) -> ResourceMetadataModel:
    return ResourceMetadataModel(
        name,
        ResourceType.HPO_JOB,
        "jdoe@amazon.com",
        MOCK_PROJECT_NAME,
        {
            "HyperParameterTuningJobArn": f"arn::fake::{name}",
            "HyperParameterTuningJobStatus": "InProgress",
            "Strategy": "Bayesian",
            "TrainingJobStatusCounters": {
                "Completed": 123,
                "InProgress": 123,
                "RetryableError": 123,
                "NonRetryableError": 123,
                "Stopped": 123,
            },
        },
    )


def _endpoint_entry(name: str, status: str) -> ResourceMetadataModel:
    return ResourceMetadataModel(
        name,
        ResourceType.ENDPOINT,
        "jdoe@amazon.com",
        MOCK_PROJECT_NAME,
        {
            "EndpointArn": f"arn::fake::{name}",
            "EndpointStatus": status,
        },
    )


def _get_all_by_project_side_effect(
    notebook_results: Optional[List[ResourceMetadataModel]] = None,
    endpoint_results: Optional[List[ResourceMetadataModel]] = None,
    training_job_results: Optional[List[ResourceMetadataModel]] = None,
    transform_job_results: Optional[List[ResourceMetadataModel]] = None,
    hpo_job_results: Optional[List[ResourceMetadataModel]] = None,
):
    def _side_effect(*args, **kwargs):
        if args[0] == MOCK_PROJECT_NAME and args[1] == ResourceType.NOTEBOOK:
            return PagedMetadataResults(notebook_results)
        if args[0] == MOCK_PROJECT_NAME and args[1] == ResourceType.ENDPOINT:
            return PagedMetadataResults(endpoint_results)
        if args[0] == MOCK_PROJECT_NAME and args[1] == ResourceType.TRAINING_JOB:
            return PagedMetadataResults(training_job_results)
        if args[0] == MOCK_PROJECT_NAME and args[1] == ResourceType.TRANSFORM_JOB:
            return PagedMetadataResults(transform_job_results)
        if args[0] == MOCK_PROJECT_NAME and args[1] == ResourceType.HPO_JOB:
            return PagedMetadataResults(hpo_job_results)
        return PagedMetadataResults()

    return _side_effect


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_update_project_description(mock_project_dao):
    expected_response = generate_html_response(200, f"Successfully updated {MOCK_PROJECT_NAME}")
    updated_desc = "This is a newly updated description"
    mock_project_dao.get.return_value = mock_project(False)

    assert lambda_handler(_mock_event(False, updated_desc), mock_context) == expected_response

    expected_project = mock_project().to_dict()
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    # The create arg is the ProjectModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_dao.update.assert_called_once()
    assert mock_project_dao.update.call_args.args[0] == MOCK_PROJECT_NAME
    actual = mock_project_dao.update.call_args.args[1].to_dict()
    assert actual["name"] == expected_project["name"]
    assert actual["description"] == updated_desc
    assert actual["suspended"] == expected_project["suspended"]
    assert actual["createdBy"] == expected_project["createdBy"]
    assert actual["createdAt"] <= actual["lastUpdatedAt"]
    assert actual["lastUpdatedAt"] >= expected_project["lastUpdatedAt"]


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_update_project_metadata(mock_project_dao):
    expected_response = generate_html_response(200, f"Successfully updated {MOCK_PROJECT_NAME}")
    updated_metadata = {"terminationConfiguration": {"defaultEndpointTTL": 3, "allowEndpointOwnerOverride": True}}
    mock_project_dao.get.return_value = mock_project(False)

    assert lambda_handler(_mock_event(False, metadata=updated_metadata), mock_context) == expected_response

    expected_project = mock_project().to_dict()
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    # The create arg is the ProjectModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_dao.update.assert_called_once()
    assert mock_project_dao.update.call_args.args[0] == MOCK_PROJECT_NAME
    actual = mock_project_dao.update.call_args.args[1].to_dict()
    assert actual["name"] == expected_project["name"]
    assert actual["description"] == expected_project["description"]
    assert json.dumps(actual["metadata"]) == json.dumps(updated_metadata)
    assert actual["suspended"] == expected_project["suspended"]
    assert actual["createdBy"] == expected_project["createdBy"]
    assert actual["createdAt"] <= actual["lastUpdatedAt"]
    assert actual["lastUpdatedAt"] >= expected_project["lastUpdatedAt"]


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_reinstate_project(mock_project_dao):
    expected_response = generate_html_response(200, f"Successfully updated {MOCK_PROJECT_NAME}")
    mock_project_dao.get.return_value = mock_project(True)

    assert lambda_handler(_mock_event(False), mock_context) == expected_response

    expected_project = mock_project().to_dict()
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    # The create arg is the ProjectModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_dao.update.assert_called_once()
    assert mock_project_dao.update.call_args.args[0] == MOCK_PROJECT_NAME
    actual = mock_project_dao.update.call_args.args[1].to_dict()
    assert actual["name"] == expected_project["name"]
    assert actual["metadata"] == expected_project["metadata"]
    assert actual["description"] == expected_project["description"]
    assert actual["suspended"] == expected_project["suspended"]
    assert actual["createdBy"] == expected_project["createdBy"]
    assert actual["createdAt"] <= actual["lastUpdatedAt"]
    assert actual["lastUpdatedAt"] >= expected_project["lastUpdatedAt"]


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_suspend_project_no_resources(mock_project_dao, mock_resource_metadata_dao):
    expected_response = generate_html_response(200, f"Successfully updated {MOCK_PROJECT_NAME}")
    mock_project_dao.get.return_value = mock_project()

    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults([])

    assert lambda_handler(_mock_event(), mock_context) == expected_response

    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [
            mock.call(
                MOCK_PROJECT_NAME,
                ResourceType.TRAINING_JOB,
                fetch_all=True,
                filter_expression="metadata.TrainingJobStatus IN (:trainingStatus)",
                filter_values={":trainingStatus": "InProgress"},
            ),
            mock.call(
                MOCK_PROJECT_NAME,
                ResourceType.TRANSFORM_JOB,
                fetch_all=True,
                filter_expression="metadata.TransformJobStatus IN (:transformStatus)",
                filter_values={":transformStatus": "InProgress"},
            ),
            mock.call(
                MOCK_PROJECT_NAME,
                ResourceType.HPO_JOB,
                fetch_all=True,
                filter_expression="metadata.HyperParameterTuningJobStatus IN (:hpoStatus)",
                filter_values={":hpoStatus": "InProgress"},
            ),
            mock.call(MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.ENDPOINT, fetch_all=True),
        ],
        True,
    )

    expected_project = mock_project(True).to_dict()
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    # The create arg is the ProjectModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_dao.update.assert_called_once()
    assert mock_project_dao.update.call_args.args[0] == MOCK_PROJECT_NAME
    assert mock_project_dao.update.call_args.args[1].to_dict() == expected_project


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_suspend_project_nonexistent(mock_project_dao):
    expected_response = generate_html_response(
        400,
        "Bad Request: Specified project does not exist",
    )
    mock_project_dao.get.return_value = None
    assert lambda_handler(_mock_event(), mock_context) == expected_response

    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_suspend_project_pending_notebook(mock_project_dao, mock_resource_metadata_dao):
    expected_response = generate_html_response(
        400,
        "Bad Request: We have stopped all the notebooks that were in service, please check that no notebooks are in Pending status before attempting again.",
    )
    mock_project_dao.get.return_value = mock_project()

    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = _get_all_by_project_side_effect(
        notebook_results=[
            ResourceMetadataModel(
                "test-notebook",
                ResourceType.NOTEBOOK,
                "jdoe@amazon.com",
                MOCK_PROJECT_NAME,
                {"NotebookInstanceStatus": "Pending"},
            )
        ]
    )

    assert lambda_handler(_mock_event(), mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_dao.update.assert_not_called()

    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_once()
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, fetch_all=True
    )


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_suspend_project_all_the_resources(mock_project_dao, mock_sagemaker_client, mock_resource_metadata_dao):
    expected_response = generate_html_response(200, f"Successfully updated {MOCK_PROJECT_NAME}")
    mock_project_dao.get.return_value = mock_project()

    # Mock multiple pages of notebooks
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = _get_all_by_project_side_effect(
        notebook_results=[
            _notebook_entry("notebook1"),
            _notebook_entry("notebook2", "Stopped"),
            _notebook_entry("notebook3"),
            _notebook_entry("notebook4"),
            _notebook_entry("notebook5", "Failed"),
            _notebook_entry("notebook5", "Deleting"),
        ],
        endpoint_results=[
            _endpoint_entry("endpoint", "InService"),
            _endpoint_entry("endpoint2", "Failed"),
            _endpoint_entry("endpoint3", "Creating"),
        ],
        training_job_results=[
            _training_job_entry("training-job"),
        ],
        transform_job_results=[
            _transform_job_entry("transform-job"),
        ],
        hpo_job_results=[
            _hyper_parameter_job_entry("hpo-job"),
        ],
    )

    assert lambda_handler(_mock_event(), mock_context) == expected_response

    # Assert notebook suspend calls
    mock_sagemaker_client.stop_notebook_instance.assert_has_calls(
        [
            mock.call(NotebookInstanceName="notebook1"),
            mock.call(NotebookInstanceName="notebook3"),
            mock.call(NotebookInstanceName="notebook4"),
        ]
    )
    # List and suspend training job calls
    mock_sagemaker_client.stop_training_job.assert_called_with(TrainingJobName="training-job")
    # List and suspend hpo job calls
    mock_sagemaker_client.stop_hyper_parameter_tuning_job.assert_called_with(HyperParameterTuningJobName="hpo-job")
    # List and suspend transform jobs
    mock_sagemaker_client.stop_transform_job.assert_called_with(TransformJobName="transform-job")
    # Assert endpoint suspend calls
    mock_sagemaker_client.delete_endpoint.assert_has_calls(
        [
            mock.call(EndpointName="endpoint"),
            mock.call(EndpointName="endpoint2"),
            mock.call(EndpointName="endpoint3"),
        ]
    )

    expected_project = mock_project(True).to_dict()
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    # The create arg is the ProjectModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_project_dao.update.assert_called_once()
    assert mock_project_dao.update.call_args.args[0] == MOCK_PROJECT_NAME
    assert mock_project_dao.update.call_args.args[1].to_dict() == expected_project


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_suspend_project_resource_failure(mock_project_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    mock_project_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(_mock_event(), mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_suspend_project_missing_param(mock_project_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_project_dao.get.assert_not_called()
    mock_project_dao.update.assert_not_called()
