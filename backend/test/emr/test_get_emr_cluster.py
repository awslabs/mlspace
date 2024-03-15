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
from unittest import mock

from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.emr.lambda_functions import get

cluster_id = "example_cluster_id"

mock_event = {"pathParameters": {"clusterId": cluster_id}}
mock_context = mock.Mock()
mock_user_name = "test@example.com"

mock_response = {
    "Cluster": {
        "clusterArn": "example_arn",
        "Id": cluster_id,
        "clusterName": "cluster_name",
        "Tags": [
            {"Key": "project", "Value": "example_project"},
            {"Key": "user", "Value": mock_user_name},
        ],
    },
}


@mock.patch("ml_space_lambda.emr.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_get_cluster_success(mock_emr, mock_scheduler):
    mock_resource_scheduler_model = ResourceSchedulerModel(
        resource_id="mock-cluster-id",
        resource_type=ResourceType.EMR_CLUSTER,
        termination_time=1,
        project="mock_project",
    )

    mock_emr.describe_cluster.return_value = mock_response
    mock_scheduler.get.return_value = mock_resource_scheduler_model
    mock_response_with_term_time_and_owner = copy.deepcopy(mock_response)
    mock_response_with_term_time_and_owner["TerminationTime"] = mock_resource_scheduler_model.termination_time
    mock_response_with_term_time_and_owner["Owner"] = mock_user_name
    expected_response = generate_html_response(200, mock_response_with_term_time_and_owner)

    assert get(mock_event, mock_context) == expected_response

    mock_emr.describe_cluster.assert_called_with(ClusterId=cluster_id)
    mock_scheduler.get.assert_called_with(resource_id=cluster_id, resource_type=ResourceType.EMR_CLUSTER)


@mock.patch("ml_space_lambda.emr.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_get_cluster_success_no_term_time(mock_emr, mock_scheduler):
    mock_resource_scheduler_model = ResourceSchedulerModel(
        resource_id="mock-cluster-id",
        resource_type=ResourceType.EMR_CLUSTER,
        termination_time=None,
        project="mock_project",
    )

    mock_emr.describe_cluster.return_value = mock_response
    mock_scheduler.get.return_value = mock_resource_scheduler_model
    expected_response = generate_html_response(200, mock_response)

    assert get(mock_event, mock_context) == expected_response

    mock_emr.describe_cluster.assert_called_with(ClusterId=cluster_id)
    mock_scheduler.get.assert_called_with(resource_id=cluster_id, resource_type=ResourceType.EMR_CLUSTER)


@mock.patch("ml_space_lambda.emr.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_get_cluster_success_no_scheduler(mock_emr, mock_scheduler):
    mock_emr.describe_cluster.return_value = mock_response
    mock_scheduler.get.return_value = None
    expected_response = generate_html_response(200, mock_response)

    assert get(mock_event, mock_context) == expected_response

    mock_emr.describe_cluster.assert_called_with(ClusterId=cluster_id)
    mock_scheduler.get.assert_called_with(resource_id=cluster_id, resource_type=ResourceType.EMR_CLUSTER)
