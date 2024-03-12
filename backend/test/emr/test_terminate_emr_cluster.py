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

# Testing for the terminate_emr_cluster Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.emr.lambda_functions import delete

mock_cluster_id = "example_cluster_id"
mock_event = {"pathParameters": {"clusterId": mock_cluster_id}}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.emr.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_terminate_emr_cluster_success(mock_emr, mock_scheduler_dao):
    mock_emr.terminate_emr_cluster.return_value = {}

    expected_response = generate_html_response(200, "Successfully terminated " + mock_cluster_id)

    assert delete(mock_event, mock_context) == expected_response

    mock_emr.set_termination_protection.assert_called_with(
        JobFlowIds=[mock_cluster_id], TerminationProtected=False
    )
    mock_emr.terminate_job_flows(JobFlowIds=[mock_cluster_id])
    mock_scheduler_dao.delete.assert_called_with(
        resource_id=mock_cluster_id, resource_type=ResourceType.EMR_CLUSTER
    )


@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_terminate_emr_cluster_termination_protection_error(mock_emr):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the SetTerminationProtection operation: Dummy error message.",
    )

    mock_emr.set_termination_protection.side_effect = ClientError(
        error_msg, "SetTerminationProtection"
    )

    assert delete(mock_event, mock_context) == expected_response

    mock_emr.set_termination_protection.assert_called_with(
        JobFlowIds=[mock_cluster_id], TerminationProtected=False
    )


@mock.patch("ml_space_lambda.emr.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_terminate_emr_cluster_terminate_job_flows_error(mock_emr, mock_scheduler):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the TerminateJobFlows operation: Dummy error message.",
    )

    mock_emr.terminate_job_flows.side_effect = ClientError(error_msg, "TerminateJobFlows")

    assert delete(mock_event, mock_context) == expected_response

    mock_emr.set_termination_protection.assert_called_with(
        JobFlowIds=[mock_cluster_id], TerminationProtected=False
    )
    mock_emr.terminate_job_flows.assert_called_with(JobFlowIds=[mock_cluster_id])


@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_terminate_emr_cluster_missing_parameters(mock_emr):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert delete({}, mock_context) == expected_response
    mock_emr.set_termination_protection.assert_not_called()
    mock_emr.terminate_job_flows.assert_not_called()
