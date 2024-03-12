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

# Testing for the list_endpoint Lambda function
import json
import time
from typing import Any, Dict, Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}
# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.notebook.lambda_functions import edit as lambda_handler

mock_context = mock.Mock()

mock_project_name = "mock-project"
mock_notebook_name = "example-notebook-instance"


def get_mock_body():
    return {
        "NotebookInstanceName": mock_notebook_name,
        "InstanceType": "ml.c5.xlarge",
        "NotebookInstanceLifecycleConfigName": "example-lifecycle-name",
        "VolumeSizeInGB": 1024,
        "Project": mock_project_name,
    }


def get_mock_input():
    return {
        "NotebookInstanceName": mock_notebook_name,
        "InstanceType": "ml.c5.xlarge",
        "LifecycleConfigName": "example-lifecycle-name",
        "VolumeSizeInGB": 1024,
    }


def create_mock_event(mock_body: Optional[Dict[str, Any]] = None):
    return {
        "requestContext": {"authorizer": {"projectName": mock_project_name}},
        "body": json.dumps(mock_body if mock_body else get_mock_body()),
    }


@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_update_notebook_instance_success(mock_sagemaker, mock_pull_config, mock_s3_param_json):
    mock_output = {
        "Status": "Complete",
    }
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.update_notebook_instance.return_value = mock_output
    expected_response = generate_html_response(200, mock_output)
    assert lambda_handler(create_mock_event(), mock_context) == expected_response
    mock_sagemaker.update_notebook_instance.assert_called_with(**get_mock_input())


@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.ec2")
@mock.patch("ml_space_lambda.notebook.lambda_functions.emr")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_update_notebook_instance_success_with_emr_attachment(
    mock_sagemaker, mock_emr, mock_ec2, mock_pull_config, mock_s3_param_json
):
    mock_cluster_id = "fakeClusterId"
    primary_security_group = "example_security_group"
    mock_body = get_mock_body()
    mock_body["clusterId"] = mock_cluster_id
    mock_input = get_mock_input()
    mock_input["LifecycleConfigName"] = "fakeClusterName-int-mls-conf"
    mock_output = {
        "Status": "Complete",
    }
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.update_notebook_instance.return_value = mock_output
    mock_emr.list_instances.return_value = {
        "Instances": [{"Ec2InstanceId": "ec2_instance_id", "PrivateIpAddress": "some_private_ip"}]
    }
    mock_ec2.describe_instances.return_value = {
        "Reservations": [{"Instances": [{"SubnetId": "subnet_id"}]}]
    }
    mock_emr.describe_cluster.return_value = {
        "Cluster": {
            "Name": "fakeClusterName",
            "Ec2InstanceAttributes": {"EmrManagedMasterSecurityGroup": primary_security_group},
        }
    }
    expected_response = generate_html_response(200, mock_output)
    assert lambda_handler(create_mock_event(mock_body), mock_context) == expected_response
    mock_emr.describe_cluster.assert_called_with(ClusterId=mock_cluster_id)
    mock_sagemaker.update_notebook_instance.assert_called_with(**mock_input)


@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_update_notebook_instance_success_with_termination_time(
    mock_sagemaker, mock_project_dao, mock_scheduler_dao, mock_pull_config, mock_s3_param_json
):
    mock_body_with_term_time = get_mock_body()
    mock_body_with_term_time["NotebookDailyStopTime"] = "15:00"
    mock_pull_config.return_value = mock_s3_param_json

    mock_output = {
        "Status": "Complete",
    }
    mock_project = ProjectModel(
        name=mock_project_name,
        description="description",
        suspended=False,
        created_by="me",
        created_at=123,
        last_updated_at=321,
        metadata={
            "terminationConfiguration": {
                "defaultNotebookStopTime": 1234567890,
                "allowNotebookOwnerOverride": True,
            }
        },
    )

    mock_project_dao.get.return_value = mock_project
    mock_sagemaker.update_notebook_instance.return_value = mock_output
    expected_response = generate_html_response(200, mock_output)
    assert (
        lambda_handler(create_mock_event(mock_body_with_term_time), mock_context)
        == expected_response
    )
    mock_sagemaker.update_notebook_instance.assert_called_with(**get_mock_input())
    mock_scheduler_dao.update_termination_time.assert_called_once()
    update_args, update_kwargs = mock_scheduler_dao.update_termination_time.call_args
    assert update_kwargs["resource_id"] == mock_notebook_name
    assert update_kwargs["resource_type"] == ResourceType.NOTEBOOK
    assert update_kwargs["new_termination_time"] > time.time()
    assert update_kwargs["project"] == mock_project_name


@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_update_notebook_instance_success_disable_termination_time(
    mock_sagemaker, mock_project_dao, mock_scheduler_dao, mock_pull_config, mock_s3_param_json
):
    mock_body_with_term_time = get_mock_body()
    mock_body_with_term_time["NotebookDailyStopTime"] = ""
    mock_pull_config.return_value = mock_s3_param_json
    mock_output = {
        "Status": "Complete",
    }
    mock_project = ProjectModel(
        name=mock_project_name,
        description="description",
        suspended=False,
        created_by="me",
        created_at=123,
        last_updated_at=321,
        metadata={
            "terminationConfiguration": {
                "defaultNotebookStopTime": 1234567890,
                "allowNotebookOwnerOverride": True,
            }
        },
    )

    mock_project_dao.get.return_value = mock_project
    mock_sagemaker.update_notebook_instance.return_value = mock_output
    expected_response = generate_html_response(200, mock_output)
    assert (
        lambda_handler(create_mock_event(mock_body_with_term_time), mock_context)
        == expected_response
    )
    mock_sagemaker.update_notebook_instance.assert_called_with(**get_mock_input())
    mock_scheduler_dao.delete.assert_called_with(
        resource_id=mock_body_with_term_time["NotebookInstanceName"],
        resource_type=ResourceType.NOTEBOOK,
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_update_notebook_instance_client_error(
    mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.update_notebook_instance.side_effect = ClientError(
        error_msg, "UpdateNotebookInstance"
    )
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the UpdateNotebookInstance operation: Dummy error message.",
    )
    assert lambda_handler(create_mock_event(), mock_context) == expected_response
    mock_sagemaker.update_notebook_instance.assert_called_with(**get_mock_input())


@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_update_notebook_instance_missing_parameters(
    mock_sagemaker, mock_pull_config, mock_s3_param_json
):
    mock_event = {"body": json.dumps({})}
    mock_pull_config.return_value = mock_s3_param_json
    expected_response = generate_html_response(
        400,
        "Bad Request: 'NotebookInstanceName'",
    )
    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.update_notebook_instance.assert_not_called()


@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_dao")
def test_update_notebook_instance_exception_with_termination_time(
    mock_project_dao, mock_pull_config, mock_s3_param_json
):
    mock_body_with_term_time = get_mock_body()
    mock_pull_config.return_value = mock_s3_param_json
    mock_body_with_term_time["NotebookDailyStopTime"] = "15:00"
    mock_project = ProjectModel(
        name=mock_project_name,
        description="description",
        suspended=False,
        created_by="me",
        created_at=123,
        last_updated_at=321,
        metadata={"terminationConfiguration": {}},
    )
    mock_project_dao.get.return_value = mock_project

    expected_response = generate_html_response(
        400,
        "Bad Request: Not allowed to edit notebook termination time for this project.",
    )

    assert (
        lambda_handler(create_mock_event(mock_body_with_term_time), mock_context)
        == expected_response
    )
