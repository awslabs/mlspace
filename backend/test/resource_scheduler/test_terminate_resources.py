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
from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.resource_scheduler.lambda_functions import terminate_resources

MOCK_PROJECT_NAME = "UnitTestProject"

mock_event = {
    "requestContext": {"authorizer": {"principalId": "some_username"}},
    "body": json.dumps(
        {
            "resourceId": "resource-id",
            "resourceType": "resource-type",
            "terminationTime": 1669931346,
            "project": MOCK_PROJECT_NAME,
        }
    ),
}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.emr")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
def test_terminate_resources_emr(mock_resource_scheduler_dao, mock_emr):
    cluster_id = "j-37DVLOLOIVI8H"
    emr_model = ResourceSchedulerModel(
        resource_id=cluster_id,
        resource_type=ResourceType.EMR_CLUSTER,
        termination_time=1,
        project=MOCK_PROJECT_NAME,
    )

    # return a list with a ResourceSchedulerModel containing an EMR Cluster ID
    mock_resource_scheduler_dao.get_resources_past_termination_time.return_value = [emr_model]
    terminate_resources(mock_event, mock_context)

    mock_emr.set_termination_protection.assert_called_with(
        JobFlowIds=[cluster_id], TerminationProtected=False
    )
    mock_emr.terminate_job_flows.assert_called_with(JobFlowIds=[cluster_id])
    mock_resource_scheduler_dao.delete.assert_called_with(
        resource_id=emr_model.resource_id, resource_type=emr_model.resource_type
    )


@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
def test_terminate_resources_endpoint(mock_resource_scheduler_dao, mock_sagemaker):
    endpoint_name = "my-endpoint"
    endpoint_model = ResourceSchedulerModel(
        resource_id=endpoint_name,
        resource_type=ResourceType.ENDPOINT,
        termination_time=1,
        project=MOCK_PROJECT_NAME,
    )

    # return a list with a ResourceSchedulerModel containing a sagemaker endpoint name
    mock_resource_scheduler_dao.get_resources_past_termination_time.return_value = [endpoint_model]
    terminate_resources(mock_event, mock_context)

    mock_sagemaker.delete_endpoint.assert_called_with(EndpointName=endpoint_name)
    mock_resource_scheduler_dao.delete.assert_called_with(
        resource_id=endpoint_model.resource_id, resource_type=endpoint_model.resource_type
    )


@mock.patch("ml_space_lambda.utils.common_functions.time")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
def test_terminate_resources_notebook(mock_resource_scheduler_dao, mock_sagemaker, mock_time):
    notebook_name = "my-notebook-instance"
    notebook_model = ResourceSchedulerModel(
        resource_id=notebook_name,
        resource_type=ResourceType.NOTEBOOK,
        termination_time=time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
        project=MOCK_PROJECT_NAME,
    )
    mock_stop_time = time.mktime((2023, 1, 2, 17, 0, 0, 0, 1, 0))
    mock_time.mktime.return_value = mock_stop_time
    mock_time.time.return_value = time.mktime((2023, 1, 2, 0, 0, 0, 0, 1, 0))
    # return a list with a ResourceSchedulerModel containing a sagemaker notebook name
    mock_resource_scheduler_dao.get_resources_past_termination_time.return_value = [notebook_model]
    terminate_resources(mock_event, mock_context)

    mock_sagemaker.stop_notebook_instance.assert_called_with(NotebookInstanceName=notebook_name)

    mock_resource_scheduler_dao.update_termination_time.assert_called_with(
        resource_id=notebook_model.resource_id,
        resource_type=notebook_model.resource_type,
        new_termination_time=mock_stop_time,
        project=MOCK_PROJECT_NAME,
    )


@mock.patch("ml_space_lambda.utils.common_functions.time")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
def test_terminate_resources_stopped_notebook(
    mock_resource_scheduler_dao, mock_sagemaker, mock_time
):
    notebook_name = "my-notebook-instance"
    notebook_model = ResourceSchedulerModel(
        resource_id=notebook_name,
        resource_type=ResourceType.NOTEBOOK,
        termination_time=time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
        project=MOCK_PROJECT_NAME,
    )
    # mock client error when trying to stop the instance
    error_msg = {
        "Error": {
            "Code": "ValidationException",
            "Message": "An error occurred (ValidationException) when calling the StopNotebookInstance operation: Status (Stopped) not in ([InService]). Unable to transition to (Stopping) for Notebook Instance (arn:aws:sagemaker:us-east-1:123456789000:notebook-instance/TestNotebook).",
        },
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_sagemaker.stop_notebook_instance.side_effect = ClientError(
        error_msg, "StopNotebookInstance"
    )

    mock_stop_time = time.mktime((2023, 1, 2, 17, 0, 0, 0, 1, 0))
    mock_time.mktime.return_value = mock_stop_time
    mock_time.time.return_value = time.mktime((2023, 1, 2, 0, 0, 0, 0, 1, 0))
    # return a list with a ResourceSchedulerModel containing a sagemaker notebook name
    mock_resource_scheduler_dao.get_resources_past_termination_time.return_value = [notebook_model]

    terminate_resources(mock_event, mock_context)

    mock_sagemaker.stop_notebook_instance.assert_called_with(NotebookInstanceName=notebook_name)
    mock_resource_scheduler_dao.update_termination_time.assert_called_with(
        resource_id=notebook_model.resource_id,
        resource_type=notebook_model.resource_type,
        new_termination_time=mock_stop_time,
        project=MOCK_PROJECT_NAME,
    )
    mock_resource_scheduler_dao.delete.assert_not_called()


@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.get_notebook_stop_time")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
def test_terminate_resources_deleted_notebook(
    mock_resource_scheduler_dao, mock_sagemaker, mock_get_notebook_stop_time
):
    notebook_name = "my-notebook-instance"
    notebook_model = ResourceSchedulerModel(
        resource_id=notebook_name,
        resource_type=ResourceType.NOTEBOOK,
        termination_time=time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
        project=MOCK_PROJECT_NAME,
    )
    # mock client error when trying to stop the instance
    error_msg = {
        "Error": {
            "Code": "ValidationException",
            "Message": "An error occurred (ValidationException) when calling the StopNotebookInstance operation: Notebook Instance arn:aws:sagemaker:us-east-1:679683741526:notebook-instance/not-a-real-notebook does not exist",
        },
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_sagemaker.stop_notebook_instance.side_effect = ClientError(
        error_msg, "StopNotebookInstance"
    )
    # return a list with a ResourceSchedulerModel containing a sagemaker notebook name
    mock_resource_scheduler_dao.get_resources_past_termination_time.return_value = [notebook_model]

    terminate_resources(mock_event, mock_context)

    mock_sagemaker.stop_notebook_instance.assert_called_with(NotebookInstanceName=notebook_name)
    mock_get_notebook_stop_time.assert_not_called()
    mock_resource_scheduler_dao.update_termination_time.assert_not_called()
    mock_resource_scheduler_dao.delete.assert_called_with(
        resource_id=notebook_name, resource_type=ResourceType.NOTEBOOK
    )


@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
def test_terminate_resources_unknown(mock_resource_scheduler_dao):
    invalid_resource_type = "unknown"
    unknown_model = ResourceSchedulerModel(
        resource_id="some-resource",
        resource_type=invalid_resource_type,
        termination_time=1,
        project=MOCK_PROJECT_NAME,
    )

    # return a list with a ResourceSchedulerModel containing an unknown resource type
    mock_resource_scheduler_dao.get_resources_past_termination_time.return_value = [unknown_model]

    with pytest.raises(Exception) as e_info:
        terminate_resources(mock_event, mock_context)

    assert str(e_info.value) == f"Unrecognized resource type: {invalid_resource_type}"


@mock.patch("ml_space_lambda.utils.common_functions.time")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.emr")
@mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
def test_terminate_resources_mostly_errors(
    mock_resource_scheduler_dao, mock_emr, mock_sagemaker, mock_time
):
    cluster_id = "j-37DVLOLOIVI8H"
    emr_model = ResourceSchedulerModel(
        resource_id=cluster_id,
        resource_type=ResourceType.EMR_CLUSTER,
        termination_time=1,
        project=MOCK_PROJECT_NAME,
    )
    endpoint_name = "my-endpoint"
    endpoint_model = ResourceSchedulerModel(
        resource_id=endpoint_name,
        resource_type=ResourceType.ENDPOINT,
        termination_time=1,
        project=MOCK_PROJECT_NAME,
    )
    bad_notebook_name = "failed-notebook-instance"
    bad_notebook_model = ResourceSchedulerModel(
        resource_id=bad_notebook_name,
        resource_type=ResourceType.NOTEBOOK,
        termination_time=time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
        project=MOCK_PROJECT_NAME,
    )
    good_notebook_name = "my-notebook-instance"
    good_notebook_model = ResourceSchedulerModel(
        resource_id=good_notebook_name,
        resource_type=ResourceType.NOTEBOOK,
        termination_time=time.mktime((2023, 1, 1, 17, 0, 0, 6, 1, 0)),
        project=MOCK_PROJECT_NAME,
    )

    mock_stop_time = time.mktime((2023, 1, 2, 17, 0, 0, 0, 1, 0))
    mock_time.mktime.return_value = mock_stop_time
    mock_time.time.return_value = time.mktime((2023, 1, 2, 0, 0, 0, 0, 1, 0))

    # return a list with a ResourceSchedulerModel containing an EMR Cluster ID
    mock_resource_scheduler_dao.get_resources_past_termination_time.return_value = [
        emr_model,
        endpoint_model,
        bad_notebook_model,
        good_notebook_model,
    ]

    # Mock errors for all the things except the last notebook
    mock_emr.set_termination_protection.side_effect = ClientError(
        {
            "Error": {
                "Code": "ValidationException",
                "Message": "An error occurred (ValidationException) when calling the SetTerminationProtection operation: Cluster does not exist",
            },
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "SetTerminationProtection",
    )
    mock_sagemaker.delete_endpoint.side_effect = ClientError(
        {
            "Error": {
                "Code": "ValidationException",
                "Message": "An error occurred (ValidationException) when calling the DeleteEndpoint operation: Endpoint does not exist",
            },
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "DeleteEndpoint",
    )
    mock_sagemaker.stop_notebook_instance.side_effect = [
        ClientError(
            {
                "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
                "ResponseMetadata": {"HTTPStatusCode": 400},
            },
            "StopNotebookInstance",
        ),
        {},
    ]

    terminate_resources(mock_event, mock_context)

    # Ensure service calls were made as expected to stop/terminate resources
    mock_emr.set_termination_protection.assert_called_with(
        JobFlowIds=[cluster_id], TerminationProtected=False
    )
    mock_emr.terminate_job_flows.assert_not_called()
    mock_sagemaker.delete_endpoint.assert_called_with(EndpointName=endpoint_name)
    mock_sagemaker.stop_notebook_instance.assert_has_calls(
        [
            mock.call(NotebookInstanceName=bad_notebook_name),
            mock.call(NotebookInstanceName=good_notebook_name),
        ]
    )
    # Should have called delete for EMR Cluster and Endpoint resource termination ddb entries
    mock_resource_scheduler_dao.delete.assert_has_calls(
        [
            mock.call(resource_id=emr_model.resource_id, resource_type=emr_model.resource_type),
            mock.call(
                resource_id=endpoint_model.resource_id, resource_type=endpoint_model.resource_type
            ),
        ]
    )

    # Both notebooks should have terination time updated
    mock_resource_scheduler_dao.update_termination_time.assert_has_calls(
        [
            mock.call(
                resource_id=bad_notebook_model.resource_id,
                resource_type=bad_notebook_model.resource_type,
                new_termination_time=mock_stop_time,
                project=MOCK_PROJECT_NAME,
            ),
            mock.call(
                resource_id=good_notebook_model.resource_id,
                resource_type=good_notebook_model.resource_type,
                new_termination_time=mock_stop_time,
                project=MOCK_PROJECT_NAME,
            ),
        ]
    )
