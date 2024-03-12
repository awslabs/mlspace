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

# Testing for the create_notebook_instance Lambda function.
import copy
import json
import os
import time
from typing import Any, Dict, Optional
from unittest import mock

import pytest
from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

NOTEBOOK_SECURITY_GROUP = "notebook_security_group"

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "BUCKET": "mlspace-data-bucket",
    "S3_KEY": "testS3Key",
    "AWS_ACCESS_KEY_ID": "fakeAccessKey",
    "AWS_SECRET_ACCESS_KEY": "fakeSecretKey",
}

project_name = "exampleProject"
user_name = "testUser"
mock_response = {
    "ConfigName": f"{project_name}-example-notebook-instance",
    "NotebookInstanceArn": "notebook-arn",
}

mock_full_notebook_name = "example-notebook-instance"

mock_project_user = ProjectUserModel(
    username=user_name,
    project_name=project_name,
    permissions=[],
    role="dynamoRole",
)

mock_project = ProjectModel(
    name=project_name,
    description="description",
    suspended=False,
    created_by="me",
    created_at=123,
    last_updated_at=321,
    metadata={
        "terminationConfiguration": {
            "defaultNotebookStopTime": "17:00",
            "allowNotebookOwnerOverride": True,
        }
    },
)

mock_describe = {
    "NotebookInstanceArn": "itsHere",
}
mock_context = mock.Mock()

mock_tags = generate_tags(user_name, project_name, "MLSpace")

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.notebook.lambda_functions import _ensure_config, _render_emr_script
    from ml_space_lambda.notebook.lambda_functions import create as lambda_handler


def _mock_event(event_body: Dict[str, Any]) -> Dict:
    return {
        "body": json.dumps(event_body),
        "requestContext": {
            "authorizer": {
                "principalId": user_name,
            },
        },
        "headers": {"x-mlspace-project": project_name},
    }


def _validate_resource_schedule_call(
    resource_schedule: ResourceSchedulerModel, expected_stop: Optional[float] = None
):
    assert resource_schedule.resource_id == mock_full_notebook_name
    assert resource_schedule.resource_type == ResourceType.NOTEBOOK
    if expected_stop:
        assert resource_schedule.termination_time == expected_stop
    else:
        assert resource_schedule.termination_time > time.time()
    assert resource_schedule.project == mock_project.name


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.notebook.lambda_functions.random")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
def test_create_notebook_instance_success_additional_settings(
    mock_resource_metadata_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_project_user_dao,
    mock_project_dao,
    mock_resource_scheduler_dao,
    not_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}

    event_body = {
        "NotebookInstanceName": "example-notebook-instance",
        "InstanceType": "example_type",
        "VolumeSizeInGB": 1024,
        "NotebookInstanceLifecycleConfigName": "fakeLifecycleConfig",
        "userName": user_name,
        "subnetId": "inputSubnet",
        "ProjectName": project_name,
        "NotebookDailyStopTime": "15:00",
    }

    not_random.choice.return_value = "mock_subnet"
    mock_project_user_dao.get.return_value = mock_project_user
    mock_project_dao.get.return_value = mock_project
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.create_notebook_instance.return_value = mock_response
    mock_sagemaker.describe_notebook_instance.return_value = mock_describe
    expected_response = generate_html_response(200, mock_response)

    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": "True"}):
        assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_sagemaker.create_notebook_instance.assert_called_with(
        NotebookInstanceName=mock_full_notebook_name,
        InstanceType="example_type",
        SubnetId="inputSubnet",
        SecurityGroupIds=["example_security_group_id"],
        RoleArn="dynamoRole",
        KmsKeyId="example_key_id",
        Tags=mock_tags,
        LifecycleConfigName="fakeLifecycleConfig",
        DirectInternetAccess="Disabled",
        VolumeSizeInGB=1024,
        RootAccess="Disabled",
    )
    mock_project_user_dao.get.assert_called_with(project_name, user_name)
    mock_pull_config.assert_called_once()
    mock_resource_scheduler_dao.create.assert_called_once()
    _validate_resource_schedule_call(mock_resource_scheduler_dao.create.call_args.args[0])

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        mock_full_notebook_name,
        ResourceType.NOTEBOOK,
        user_name,
        project_name,
        {},
    )


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.notebook.lambda_functions.random")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
def test_create_notebook_instance_success_empty_stop_time(
    mock_resource_metadata_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_project_user_dao,
    mock_project_dao,
    mock_resource_scheduler_dao,
    not_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}

    event_body = {
        "NotebookInstanceName": "example-notebook-instance",
        "InstanceType": "example_type",
        "VolumeSizeInGB": 1024,
        "NotebookInstanceLifecycleConfigName": "fakeLifecycleConfig",
        "userName": user_name,
        "subnetId": "inputSubnet",
        "ProjectName": project_name,
        "NotebookDailyStopTime": "",
    }

    not_random.choice.return_value = "mock_subnet"
    mock_project_user_dao.get.return_value = mock_project_user
    mock_project_dao.get.return_value = mock_project
    mock_pull_config.return_value = mock_s3_param_json
    mock_sagemaker.create_notebook_instance.return_value = mock_response
    mock_sagemaker.describe_notebook_instance.return_value = mock_describe
    expected_response = generate_html_response(200, mock_response)

    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": "True"}):
        assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_sagemaker.create_notebook_instance.assert_called_with(
        NotebookInstanceName=mock_full_notebook_name,
        InstanceType="example_type",
        SubnetId="inputSubnet",
        SecurityGroupIds=["example_security_group_id"],
        RoleArn="dynamoRole",
        KmsKeyId="example_key_id",
        Tags=mock_tags,
        LifecycleConfigName="fakeLifecycleConfig",
        DirectInternetAccess="Disabled",
        VolumeSizeInGB=1024,
        RootAccess="Disabled",
    )
    mock_project_user_dao.get.assert_called_with(project_name, user_name)
    mock_pull_config.assert_called_once()
    mock_resource_scheduler_dao.create.assert_not_called()

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        mock_full_notebook_name,
        ResourceType.NOTEBOOK,
        user_name,
        project_name,
        {},
    )


@pytest.mark.parametrize(
    "additional_payload", [({"NotebookInstanceLifecycleConfigName": "No configuration"}), ({})]
)
@mock.patch("ml_space_lambda.utils.common_functions.time")
@mock.patch("ml_space_lambda.notebook.lambda_functions.random")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
def test_create_notebook_instance_success_no_additional_settings(
    mock_resource_metadata_dao,
    mock_sagemaker,
    mock_pull_config,
    mock_project_user_dao,
    mock_project_dao,
    mock_resource_scheduler_dao,
    not_random,
    mock_time,
    additional_payload,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}

    event_body = {
        "NotebookInstanceName": "example-notebook-instance",
        "InstanceType": "example_type",
        "VolumeSizeInGB": 1024,
        "userName": user_name,
        "subnet": "inputSubnet",
        "ProjectName": project_name,
    }
    event_body.update(additional_payload)
    not_random.choice.return_value = "mock_subnet"
    # Mock out a termination hour / minute that requires shifting the termination time
    # to the next day. We're mocking a datetime that is years in the past and then ensuring the
    # shifted time is that mocked datetime + 1 day (86400 seconds)
    mocked_stop_time = time.mktime(time.strptime("01 Jan 2020 17:00", "%d %b %Y %H:%M"))
    mock_time.mktime.return_value = mocked_stop_time
    # Need to mock the "current time" otherwise the lambda will fail when comparing a mock
    # to a float
    mock_time.time.return_value = time.time()
    mock_project_dao.get.return_value = mock_project
    mock_project_user_dao.get.return_value = mock_project_user
    mock_sagemaker.create_notebook_instance.return_value = mock_response
    mock_sagemaker.describe_notebook_instance.return_value = mock_describe
    expected_response = generate_html_response(200, mock_response)
    mock_pull_config.return_value = mock_s3_param_json

    with mock.patch.dict(os.environ, {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_sagemaker.create_notebook_instance.assert_called_with(
        NotebookInstanceName="example-notebook-instance",
        InstanceType="example_type",
        SubnetId="mock_subnet",
        SecurityGroupIds=["example_security_group_id"],
        RoleArn="mock_iam_role_from_s3_config",
        KmsKeyId="example_key_id",
        LifecycleConfigName="fakeLifecycleConfig",
        DirectInternetAccess="Disabled",
        VolumeSizeInGB=1024,
        Tags=mock_tags,
        RootAccess="Disabled",
    )
    mock_project_user_dao.get.assert_not_called()
    mock_pull_config.assert_called_once()
    mock_resource_scheduler_dao.create.assert_called_once()
    expected_stop_time = mocked_stop_time + (24 * 60 * 60)
    _validate_resource_schedule_call(
        mock_resource_scheduler_dao.create.call_args.args[0], expected_stop_time
    )

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        mock_full_notebook_name,
        ResourceType.NOTEBOOK,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.random")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.notebook.lambda_functions.emr")
@mock.patch("ml_space_lambda.notebook.lambda_functions.ec2")
@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_metadata_dao")
def test_create_notebook_instance_success_attached_to_cluster(
    mock_resource_metadata_dao,
    mock_ec2,
    mock_emr,
    mock_sagemaker,
    mock_pull_config,
    mock_project_user_dao,
    mock_project_dao,
    mock_resource_scheduler_dao,
    not_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}

    primary_security_group = "example_security_group"

    event_body = {
        "NotebookInstanceName": "example-notebook-instance",
        "InstanceType": "example_type",
        "VolumeSizeInGB": 1024,
        "userName": user_name,
        "subnet": "inputSubnet",
        "ProjectName": project_name,
        "clusterId": "fakeClusterId",
    }
    not_random.choice.return_value = "mock_subnet"
    mock_project_user_dao.get.return_value = mock_project_user
    mock_project_dao.get.return_value = mock_project
    mock_sagemaker.create_notebook_instance.return_value = mock_response
    mock_sagemaker.describe_notebook_instance.return_value = mock_describe
    expected_response = generate_html_response(200, mock_response)
    mock_pull_config.return_value = mock_s3_param_json
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

    mock_ec2.authorize_security_group_ingress.side_effect = ClientError(
        {"Error": {"Code": "InvalidPermission.Duplicate"}}, "AuthorizeSecurityGroupIngress"
    )

    with mock.patch.dict(os.environ, {"FEATURE_FLAG_IAM_ROLE_LAMBDA": ""}):
        assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_emr.describe_cluster.assert_called_with(ClusterId=event_body["clusterId"])

    mock_emr.list_instances(ClusterId=event_body["clusterId"], InstanceGroupTypes=["MASTER"])

    mock_ec2.describe_instances.assert_called_with(InstanceIds=["ec2_instance_id"])

    mock_ec2.authorize_security_group_ingress.assert_called_with(
        GroupId=primary_security_group,
        IpPermissions=[
            {
                "IpProtocol": "tcp",
                "FromPort": 8998,
                "ToPort": 8998,
                "UserIdGroupPairs": [{"GroupId": mock_s3_param_json["pSMSSecurityGroupId"][0]}],
            }
        ],
    )

    mock_sagemaker.create_notebook_instance.assert_called_with(
        NotebookInstanceName="example-notebook-instance",
        InstanceType="example_type",
        SubnetId="subnet_id",
        SecurityGroupIds=["example_security_group_id"],
        RoleArn="mock_iam_role_from_s3_config",
        KmsKeyId="example_key_id",
        Tags=mock_tags,
        LifecycleConfigName="fakeClusterName-int-mls-conf",
        DirectInternetAccess="Disabled",
        VolumeSizeInGB=1024,
        RootAccess="Disabled",
    )
    mock_project_user_dao.get.assert_not_called()
    mock_pull_config.assert_called_once()
    mock_resource_scheduler_dao.create.assert_called_once()
    _validate_resource_schedule_call(mock_resource_scheduler_dao.create.call_args.args[0])

    mock_resource_metadata_dao.upsert_record.assert_called_with(
        mock_full_notebook_name,
        ResourceType.NOTEBOOK,
        user_name,
        project_name,
        {},
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_create_notebook_instance_client_error(
    mock_sagemaker, mock_pull_config, mock_project_user_dao, mock_s3_param_json
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}

    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    event_body = {
        "NotebookInstanceName": "example-notebook-instance",
        "InstanceType": "example_type",
        "VolumeSizeInGB": 1024,
        "NotebookInstanceLifecycleConfigName": "some_lifecycle_here",
        "userName": user_name,
        "ProjectName": project_name,
    }
    mock_sagemaker.create_notebook_instance.side_effect = ClientError(
        error_msg, "CreateNotebookInstance"
    )
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the CreateNotebookInstance operation: Dummy error message.",
    )
    mock_project_user_dao.get.return_value = mock_project_user
    mock_pull_config.return_value = mock_s3_param_json

    assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_sagemaker.create_notebook_instance.assert_called()
    mock_project_user_dao.get.assert_not_called()
    mock_pull_config.assert_called_once()


@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_create_notebook_instance_mismatched_header(
    mock_sagemaker, mock_pull_config, mock_project_user_dao
):
    event_body = {
        "NotebookInstanceName": "example-notebook-instance",
        "InstanceType": "example_type",
        "VolumeSizeInGB": 1024,
        "NotebookInstanceLifecycleConfigName": "some_lifecycle_here",
        "userName": user_name,
        "ProjectName": project_name,
    }

    fake_project = "FakeProject"
    bad_event = copy.deepcopy(_mock_event(event_body))
    bad_event["headers"]["x-mlspace-project"] = fake_project
    expected_response = generate_html_response(
        400,
        f"Bad Request: Project header, {fake_project}, does not match the project name associated with the notebook, {project_name}.",
    )

    assert lambda_handler(bad_event, mock_context) == expected_response

    mock_sagemaker.create_notebook_instance.assert_not_called()
    mock_project_user_dao.get.assert_not_called()
    mock_pull_config.assert_not_called()


@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_create_notebook_instance_missing_parameters(
    mock_sagemaker, mock_pull_config, mock_project_user_dao
):
    expected_response = generate_html_response(400, "Missing event parameter: 'requestContext'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.create_notebook_instance.assert_not_called()
    mock_project_user_dao.get.assert_not_called()
    mock_pull_config.assert_not_called()


@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_ensure_config_describe(mock_sagemaker):
    test_config = "testConfig"
    test_info = {
        "ip": "1.2.3.4",
    }
    _ensure_config(test_config, test_info)
    mock_sagemaker.describe_notebook_instance_lifecycle_config.assert_called_with(
        NotebookInstanceLifecycleConfigName="testConfig",
    )
    mock_sagemaker.create_notebook_instance_lifecycle_config.assert_not_called()


@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_ensure_config_create(mock_sagemaker):
    test_config = "testConfig"
    test_info = {
        "ip": "1.2.3.4",
    }
    mock_sagemaker.describe_notebook_instance_lifecycle_config.side_effect = Exception(
        "testException"
    )
    _ensure_config(test_config, test_info)
    mock_sagemaker.describe_notebook_instance_lifecycle_config.assert_called_with(
        NotebookInstanceLifecycleConfigName="testConfig",
    )
    mock_sagemaker.create_notebook_instance_lifecycle_config.assert_called_with(
        NotebookInstanceLifecycleConfigName="testConfig",
        OnStart=[{"Content": _render_emr_script("1.2.3.4")}],
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.random")
@mock.patch("ml_space_lambda.notebook.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.notebook.lambda_functions.emr")
@mock.patch("ml_space_lambda.notebook.lambda_functions.ec2")
@mock.patch("ml_space_lambda.notebook.lambda_functions._ensure_config")
def test_create_notebook_instance_attached_to_cluster_failure(
    mock_ensure_config,
    mock_ec2,
    mock_emr,
    mock_sagemaker,
    mock_pull_config,
    mock_project_user_dao,
    not_random,
    mock_s3_param_json,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}

    primary_security_group = "example_security_group"

    event_body = {
        "NotebookInstanceName": "example-notebook-instance",
        "InstanceType": "example_type",
        "VolumeSizeInGB": 1024,
        "userName": user_name,
        "subnet": "inputSubnet",
        "ProjectName": project_name,
        "clusterId": "fakeClusterId",
    }
    not_random.choice.return_value = "mock_subnet"
    mock_project_user_dao.get.return_value = mock_project_user
    mock_sagemaker.create_notebook_instance.return_value = mock_response
    mock_sagemaker.describe_notebook_instance.return_value = mock_describe
    mock_pull_config.return_value = mock_s3_param_json
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

    mock_ec2.authorize_security_group_ingress.side_effect = ClientError(
        {"Error": {"Code": "ValidationError"}}, "AuthorizeSecurityGroupIngress"
    )
    expected_response = generate_html_response(
        400,
        "An error occurred (ValidationError) when calling the AuthorizeSecurityGroupIngress operation: Unknown",
    )

    with mock.patch.dict(os.environ, {"FEATURE_FLAG_IAM_ROLE_LAMBDA": ""}):
        assert lambda_handler(_mock_event(event_body), mock_context) == expected_response

    mock_emr.describe_cluster.assert_called_with(ClusterId=event_body["clusterId"])

    mock_emr.list_instances(ClusterId=event_body["clusterId"], InstanceGroupTypes=["MASTER"])

    mock_ec2.describe_instances.assert_called_with(InstanceIds=["ec2_instance_id"])

    mock_ec2.authorize_security_group_ingress.assert_called_with(
        GroupId=primary_security_group,
        IpPermissions=[
            {
                "IpProtocol": "tcp",
                "FromPort": 8998,
                "ToPort": 8998,
                "UserIdGroupPairs": [{"GroupId": mock_s3_param_json["pSMSSecurityGroupId"][0]}],
            }
        ],
    )

    mock_sagemaker.create_notebook_instance.assert_not_called()
    mock_project_user_dao.get.assert_not_called()
    mock_pull_config.assert_called_once()
