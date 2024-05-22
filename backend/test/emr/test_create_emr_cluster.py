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
import json
import time
from typing import Optional
from unittest import mock

import pytest
from botocore.exceptions import ClientError

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.enums import ResourceType, ServiceType
from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "SYSTEM_TAG": "MLSpace",
    "EMR_EC2_ROLE_NAME": "Custom-EMR-EC2-Role",
    "EMR_SERVICE_ROLE_NAME": "Custom-EMR-ServiceRole",
    "EMR_SECURITY_CONFIGURATION": "Custom-EMR-Security-Config",
    "EMR_EC2_SSH_KEY": "some-key",
    "EMR_EC2_SSH_KEY": "some-key",
    "MANAGE_IAM_ROLES": "",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.emr import lambda_functions as emr_handler
    from ml_space_lambda.utils.app_config_utils import get_app_config

MOCK_PROJECT_NAME = "example_project"
MOCK_CLUSTER_NAME = "example_cluster_name"
MOCK_RELEASE_LABEL = "emr-6.2.0"

MOCK_APP_CONFIG = {
    "configScope": "global",
    "versionId": 1,
    "changeReason": "Testing",
    "changedBy": "Tester",
    "createdAt": 1,
    "configuration": {
        "DisabledInstanceTypes": {
            ServiceType.NOTEBOOK.value: [],
            ServiceType.ENDPOINT.value: [],
            ServiceType.TRAINING_JOB.value: [],
            ServiceType.TRANSFORM_JOB.value: [],
        },
        "EnabledServices": {
            ServiceType.REALTIME_TRANSLATE.value: "true",
            ServiceType.BATCH_TRANSLATE.value: "false",
            ServiceType.LABELING_JOB.value: "true",
            ServiceType.EMR_CLUSTER.value: "true",
            ServiceType.ENDPOINT.value: "true",
            ServiceType.ENDPOINT_CONFIG.value: "false",
            ServiceType.HPO_JOB.value: "true",
            ServiceType.MODEL.value: "true",
            ServiceType.NOTEBOOK.value: "false",
            ServiceType.TRAINING_JOB.value: "true",
            ServiceType.TRANSFORM_JOB.value: "true",
        },
        "EMRConfig": {
            "clusterSizes": [
                {"name": "Small", "size": 3, "masterType": "m5.xlarge", "coreType": "m5.xlarge"},
                {"name": "Medium", "size": 5, "masterType": "m5.xlarge", "coreType": "m5.xlarge"},
            ],
            "autoScaling": {
                "minInstances": 2,
                "maxInstances": 15,
                "scaleOut": {"increment": 1, "percentageMemAvailable": 15, "evalPeriods": 1, "cooldown": 300},
                "scaleIn": {"increment": -1, "percentageMemAvailable": 75, "evalPeriods": 1, "cooldown": 300},
            },
            "applications": [
                {"Name": "Hadoop"},
                {"Name": "Spark"},
            ],
        },
    },
}


def _expected_args(custom_ami: Optional[str] = None):
    expected_args = {
        "Name": "example_cluster_name",
        "LogUri": "s3://mlspace-log-bucket",
        "ReleaseLabel": MOCK_RELEASE_LABEL,
        "Applications": [{"Name": "Hadoop"}, {"Name": "Spark"}],
        "Instances": {
            "InstanceGroups": [
                {
                    "Name": "Master",
                    "Market": "ON_DEMAND",
                    "InstanceRole": "MASTER",
                    "InstanceType": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["clusterSizes"][0]["masterType"],
                    "InstanceCount": 1,
                },
                {
                    "Name": "Worker",
                    "Market": "ON_DEMAND",
                    "InstanceRole": "CORE",
                    "InstanceType": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["clusterSizes"][0]["coreType"],
                    "InstanceCount": 3,
                    "AutoScalingPolicy": {
                        "Constraints": {
                            "MinCapacity": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"]["minInstances"],
                            "MaxCapacity": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"]["maxInstances"],
                        },
                        "Rules": [
                            {
                                "Name": "AutoScalingPolicyUp",
                                "Description": "Scaling policy configured in the dynamic config",
                                "Action": {
                                    "SimpleScalingPolicyConfiguration": {
                                        "ScalingAdjustment": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"][
                                            "scaleOut"
                                        ]["increment"],
                                        "CoolDown": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"]["scaleOut"][
                                            "cooldown"
                                        ],
                                    }
                                },
                                "Trigger": {
                                    "CloudWatchAlarmDefinition": {
                                        "ComparisonOperator": "LESS_THAN",
                                        "EvaluationPeriods": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"][
                                            "scaleOut"
                                        ]["evalPeriods"],
                                        "MetricName": "YARNMemoryAvailablePercentage",
                                        "Period": 300,
                                        "Threshold": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"]["scaleOut"][
                                            "percentageMemAvailable"
                                        ],
                                        "Unit": "PERCENT",
                                    }
                                },
                            },
                            {
                                "Name": "AutoScalingPolicyDown",
                                "Description": "Scaling policy configured in the dynamic config",
                                "Action": {
                                    "SimpleScalingPolicyConfiguration": {
                                        "ScalingAdjustment": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"][
                                            "scaleIn"
                                        ]["increment"],
                                        "CoolDown": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"]["scaleIn"][
                                            "cooldown"
                                        ],
                                    }
                                },
                                "Trigger": {
                                    "CloudWatchAlarmDefinition": {
                                        "ComparisonOperator": "GREATER_THAN",
                                        "EvaluationPeriods": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"][
                                            "scaleIn"
                                        ]["evalPeriods"],
                                        "MetricName": "YARNMemoryAvailablePercentage",
                                        "Period": 300,
                                        "Threshold": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["autoScaling"]["scaleIn"][
                                            "percentageMemAvailable"
                                        ],
                                        "Unit": "PERCENT",
                                    }
                                },
                            },
                        ],
                    },
                },
            ],
            "Ec2KeyName": TEST_ENV_CONFIG["EMR_EC2_SSH_KEY"],
            "KeepJobFlowAliveWhenNoSteps": True,
            "TerminationProtected": False,
            "Ec2SubnetId": "subnet1",
        },
        "VisibleToAllUsers": True,
        "JobFlowRole": TEST_ENV_CONFIG["EMR_EC2_ROLE_NAME"],
        "ServiceRole": TEST_ENV_CONFIG["EMR_SERVICE_ROLE_NAME"],
        "AutoScalingRole": TEST_ENV_CONFIG["EMR_EC2_ROLE_NAME"],
        "Tags": generate_tags(
            "jdoe@amazon.com",
            MOCK_PROJECT_NAME,
            TEST_ENV_CONFIG["SYSTEM_TAG"],
        ),
        "SecurityConfiguration": TEST_ENV_CONFIG["EMR_SECURITY_CONFIGURATION"],
    }

    if custom_ami:
        for instance_group in expected_args["Instances"]["InstanceGroups"]:
            instance_group["CustomAmiId"] = custom_ami

    return expected_args


def _mock_event_body(subnet: Optional[str] = "", custom_ami: Optional[str] = None):
    options = {
        "emrSize": MOCK_APP_CONFIG["configuration"]["EMRConfig"]["clusterSizes"][0]["name"],
        "emrRelease": "emr-6.2.0",
    }
    if custom_ami:
        options["customAmiId"] = custom_ami

    return {
        "clusterName": "example_cluster_name",
        "options": options,
        "Instances": {"Ec2SubnetId": subnet},
    }


mock_context = mock.Mock()

mock_response = {
    "ClusterArn": "example_arn",
    "JobFlowId": MOCK_CLUSTER_NAME,
}

mock_project = ProjectModel(
    name=MOCK_PROJECT_NAME,
    description="description",
    suspended=False,
    created_by="me",
    created_at=123,
    last_updated_at=321,
    metadata={
        "terminationConfiguration": {
            "defaultEMRClusterTTL": 72,
        }
    },
)

mock_list_response = {
    "Clusters": [
        {
            "Id": "mock-cluster-id",
            "Name": MOCK_CLUSTER_NAME,
            "Status": {
                "State": "RUNNING",
            },
            "ClusterArn": "cluster-arn",
        },
    ]
}


def _mock_args(specific_subnet: Optional[str] = None, custom_ami: Optional[str] = None):
    call_args = copy.deepcopy(_expected_args(custom_ami=custom_ami))
    if specific_subnet:
        call_args["Instances"]["Ec2SubnetId"] = specific_subnet

    return call_args


def _mock_event(subnet: Optional[str] = "", custom_ami: Optional[str] = None):
    event_body = copy.deepcopy(_mock_event_body(subnet=subnet, custom_ami=custom_ami))

    return {
        "body": json.dumps(event_body),
        "requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}},
        "pathParameters": {"clusterId": MOCK_CLUSTER_NAME, "projectName": MOCK_PROJECT_NAME},
    }


@pytest.mark.parametrize(
    "mock_ami_id",
    [
        (None),
        "ami-123456789",
    ],
    ids=[
        "default_ami",
        "custom_ami_id",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.utils.app_config_utils.app_configuration_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.random")
@mock.patch("ml_space_lambda.emr.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_create_emr_cluster_success(
    mock_emr,
    mock_pull_config,
    mock_random,
    mock_project_dao,
    mock_resource_scheduler_dao,
    mock_app_configuration_dao,
    mock_ami_id,
):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}
    emr_handler.cluster_config = {}

    mocked_random_subnet = "example_subnet2"
    mock_random.sample.return_value = [mocked_random_subnet]

    mock_app_configuration_dao.get.return_value = [MOCK_APP_CONFIG]
    get_app_config.cache_clear()
    mock_emr.run_job_flow.return_value = mock_response
    mock_paginator = mock.MagicMock()
    mock_emr.get_paginator.return_value = mock_paginator
    mock_cluster_id = "Cluster1"
    mock_paginator.paginate.return_value = [{"Clusters": [{"Id": mock_cluster_id, "Name": MOCK_CLUSTER_NAME}]}]
    mock_project_dao.get.return_value = mock_project

    expected_response = generate_html_response(200, mock_response)

    assert emr_handler.create(_mock_event(subnet="", custom_ami=mock_ami_id), mock_context) == expected_response

    mock_emr.run_job_flow.assert_called_with(**_mock_args(specific_subnet=mocked_random_subnet, custom_ami=mock_ami_id))
    mock_pull_config.assert_called_once()

    cluster_schedule = mock_resource_scheduler_dao.create.call_args.args[0]
    assert cluster_schedule.resource_id == mock_cluster_id
    assert cluster_schedule.resource_type == ResourceType.EMR_CLUSTER
    # We're mocking a termination time of 3 days so ensure the termination time makes sense
    assert cluster_schedule.termination_time > (time.time() + (71 * 60 * 60))
    assert cluster_schedule.project == mock_project.name


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.utils.app_config_utils.app_configuration_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_create_emr_cluster_success_with_subnet(
    mock_emr, mock_pull_config, mock_project_dao, mock_resource_scheduler_dao, mock_app_configuration_dao
):
    # This test checks to see that the response contains the expected subnet that the user specifies.

    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}
    emr_handler.cluster_config = {}

    specific_subnet = "ThisIsASpecificSubnet1"
    mock_ami_id = "ami-123456789"

    mock_app_configuration_dao.get.return_value = [MOCK_APP_CONFIG]
    get_app_config.cache_clear()
    mock_emr.run_job_flow.return_value = mock_response
    mock_paginator = mock.MagicMock()
    mock_emr.get_paginator.return_value = mock_paginator
    mock_cluster_id = "Cluster1"
    mock_paginator.paginate.return_value = [{"Clusters": [{"Id": mock_cluster_id, "Name": MOCK_CLUSTER_NAME}]}]
    mock_project_dao.get.return_value = mock_project

    expected_response = generate_html_response(200, mock_response)

    assert emr_handler.create(_mock_event(subnet=specific_subnet, custom_ami=mock_ami_id), mock_context) == expected_response

    # Check it had correct parameters and subnet was passed in
    mock_emr.run_job_flow.assert_called_with(**_mock_args(specific_subnet=specific_subnet, custom_ami=mock_ami_id))
    mock_pull_config.assert_not_called()

    # Check it was created successfully
    cluster_schedule = mock_resource_scheduler_dao.create.call_args.args[0]
    assert cluster_schedule.resource_id == mock_cluster_id
    assert cluster_schedule.resource_type == ResourceType.EMR_CLUSTER
    # We're mocking a termination time of 3 days so ensure the termination time makes sense
    assert cluster_schedule.termination_time > (time.time() + (71 * 60 * 60))
    assert cluster_schedule.project == mock_project.name


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.utils.app_config_utils.app_configuration_dao")
@mock.patch("ml_space_lambda.emr.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_create_emr_cluster_client_error(mock_emr, mock_pull_config, mock_app_configuration_dao):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.param_file = {}
    mlspace_config.env_variables = {}
    emr_handler.cluster_config = {}

    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the RunJobFlow operation: Dummy error message.",
    )

    specific_subnet = "ADifferentSubnet"

    mock_app_configuration_dao.get.return_value = [MOCK_APP_CONFIG]
    get_app_config.cache_clear()
    mock_emr.run_job_flow.side_effect = ClientError(error_msg, "RunJobFlow")

    assert emr_handler.create(_mock_event(subnet=specific_subnet), mock_context) == expected_response

    mock_pull_config.assert_not_called()
    error_args = _mock_args(specific_subnet=specific_subnet)
    mock_emr.run_job_flow.assert_called_with(**error_args)


@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
@mock.patch("ml_space_lambda.emr.lambda_functions.pull_config_from_s3")
def test_create_emr_cluster_missing_parameters(mock_pull_config, mock_emr):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert emr_handler.create({}, mock_context) == expected_response
    mock_emr.get_item.assert_not_called()
    mock_pull_config.assert_not_called()
