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

from ml_space_lambda.enums import ResourceType, ServiceType

mock_context = mock.Mock()
mock_context.invoked_function_arn.split.return_value = "arn:aws:lambda:us-east-1:123456789010:function/some-lambda".split(":")

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "JOB_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/job-instance-constraint",
    "ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN": "arn:aws:iam::policy/job-instance-constraint",
    "MANAGE_IAM_ROLES": "True",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    import ml_space_lambda.app_configuration.lambda_functions as lambda_function
    from ml_space_lambda.app_configuration.lambda_functions import update_configuration as lambda_handler
    from ml_space_lambda.app_configuration.policy_helper.active_service_policy_manager import ActiveServicePolicyManager
    from ml_space_lambda.utils.common_functions import generate_html_response

    lambda_function.env_variables = TEST_ENV_CONFIG

mock_time = int(time.time())


def dict_merge(dictA, dictB):
    for k, v in dictB.items():
        if k in dictA and isinstance(dictA[k], dict) and isinstance(dictB[k], dict):
            dict_merge(dictA[k], dictB[k])
        else:
            dictA[k] = dictB[k]


def generate_event(config_scope: str, version_id: int, overrides: dict[str, any] = {}):
    config = {
        "configScope": config_scope,
        "versionId": version_id,
        "changeReason": "Testing",
        "createdAt": mock_time,
        "configuration": {
            "EnabledInstanceTypes": {
                ServiceType.NOTEBOOK.value: ["ml.t3.medium", "ml.r5.large"],
                ServiceType.ENDPOINT.value: ["ml.t3.large", "ml.r5.medium"],
                ServiceType.TRAINING_JOB.value: ["ml.t3.xlarge", "ml.r5.small"],
                ServiceType.TRANSFORM_JOB.value: ["ml.t3.kindabig", "ml.r5.kindasmall"],
            },
            "EnabledServices": {
                ServiceType.REALTIME_TRANSLATE.value: True,
                ServiceType.BATCH_TRANSLATE.value: True,
                ServiceType.LABELING_JOB.value: True,
                ServiceType.EMR_CLUSTER.value: True,
                ServiceType.ENDPOINT.value: True,
                ServiceType.ENDPOINT_CONFIG.value: True,
                ServiceType.HPO_JOB.value: True,
                ServiceType.MODEL.value: True,
                ServiceType.NOTEBOOK.value: True,
                ServiceType.TRAINING_JOB.value: True,
                ServiceType.TRANSFORM_JOB.value: True,
            },
            "ProjectCreation": {"isAdminOnly": "true", "allowedGroups": ["Justice League", "Avengers", "TMNT"]},
            "EMRConfig": {
                "clusterTypes": [
                    {"name": "Small", "size": 3, "masterType": "m5.xlarge", "coreType": "m5.xlarge"},
                    {"name": "Medium", "size": 5, "masterType": "m5.xlarge", "coreType": "m5.xlarge"},
                    {"name": "Large", "size": 7, "masterType": "m5.xlarge", "coreType": "p3.8xlarge"},
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
                    {"Name": "Ganglia"},
                    {"Name": "Hive"},
                    {"Name": "Tez"},
                    {"Name": "Presto"},
                    {"Name": "Livy"},
                ],
            },
            "SystemBanner": {
                "isEnabled": "true",
                "textColor": "Red",
                "backgroundColor": "White",
                "text": "Jeff Bezos",
            },
        },
    }
    dict_merge(config, overrides)
    return {
        "body": json.dumps(config),
        "requestContext": {"authorizer": {"principalId": "jdoe"}},
    }


@pytest.mark.parametrize(
    "config_scope",
    [
        ("global"),
        ("project_name"),
    ],
    ids=[
        "update_config_app",
        "update_config_project",
    ],
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.suspend_all_of_type")
def test_update_config_success(
    mock_suspend_all_of_type,
    mock_iam_manager,
    mock_app_config_dao,
    mock_update_instance_constraint_policies,
    config_scope: str,
):
    version_id = 1
    mock_event = generate_event(config_scope, version_id)
    mock_app_config_dao.create.return_value = None

    # Add 1 to version ID as it's incremented as part of the update
    success_response = f"Successfully updated configuration for {config_scope}, version {version_id+1}."
    expected_response = generate_html_response(200, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response


# @mock.pathc("ml_space_lambda.app_configuration.lambda_functions.suspend_all_of_type")
@mock.patch(
    "ml_space_lambda.app_configuration.policy_helper.active_service_policy_manager.ActiveServicePolicyManager.update_activated_services_policy"
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_success_with_suspend_resources_issues(
    mock_app_config_dao, mock_update_instance_constraint_policies, mock_update_activated_services_policy
):
    version_id = 1
    mock_event = generate_event("global", version_id)
    mock_app_config_dao.create.return_value = None
    mock_update_activated_services_policy.return_value = [ResourceType.BATCH_TRANSLATE_JOB]

    # Add 1 to version ID as it's incremented as part of the update
    success_response = "Successfully updated configuration for global, version 2, but issues were encountered when suspending resources for a deactivated service. Please contact your system administrator for assistance in suspending resources for deactivated services."
    expected_response = generate_html_response(207, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response


# @mock.pathc("ml_space_lambda.app_configuration.lambda_functions.suspend_all_of_type")
@mock.patch(
    "ml_space_lambda.app_configuration.policy_helper.active_service_policy_manager.ActiveServicePolicyManager.update_activated_services_policy"
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_instances_policy_update_issues(
    mock_app_config_dao, mock_update_instance_constraint_policies, mock_update_activated_services_policy
):
    version_id = 1
    mock_event = generate_event("global", version_id)
    mock_app_config_dao.create.return_value = None
    mock_update_activated_services_policy.return_value = [ResourceType.BATCH_TRANSLATE_JOB]

    def raise_exception(event, context):
        raise Exception()

    mock_update_instance_constraint_policies.side_effect = raise_exception

    # Should cause a status code 500 and not invoke the app config creation
    assert lambda_handler(mock_event, mock_context)["statusCode"] == 500
    mock_app_config_dao.create.assert_not_called()
    assert mock_update_activated_services_policy.call_count == 2
    assert mock_update_instance_constraint_policies.call_count == 2


# @mock.pathc("ml_space_lambda.app_configuration.lambda_functions.suspend_all_of_type")
@mock.patch(
    "ml_space_lambda.app_configuration.policy_helper.active_service_policy_manager.ActiveServicePolicyManager.update_activated_services_policy"
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_services_policy_update_issues(
    mock_app_config_dao, mock_update_instance_constraint_policies, mock_update_activated_services_policy
):
    version_id = 1
    mock_event = generate_event("global", version_id)
    mock_app_config_dao.create.return_value = None

    def raise_exception(config, iam_manager=None):
        raise Exception()

    mock_update_activated_services_policy.side_effect = raise_exception

    # Should cause a status code 500 and not invoke the app config creation
    assert lambda_handler(mock_event, mock_context)["statusCode"] == 500
    mock_app_config_dao.create.assert_not_called()
    assert mock_update_activated_services_policy.call_count == 2
    assert mock_update_instance_constraint_policies.call_count == 1


@pytest.mark.parametrize(
    "config_scope",
    [
        ("global"),
        ("project_name"),
    ],
    ids=[
        "update_config_app_outdated",
        "update_config_project_outdated",
    ],
)
@mock.patch(
    "ml_space_lambda.app_configuration.policy_helper.active_service_policy_manager.ActiveServicePolicyManager.update_activated_services_policy"
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_outdated(
    mock_app_config_dao, mock_update_instance_constraint_policies, mock_update_activated_services_policy, config_scope: str
):
    version_id = 1
    mock_event = generate_event(config_scope, version_id)

    error_msg = {
        "Error": {"Code": "ConditionalCheckFailedException", "Message": "The conditional request failed."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        429,
        "An error occurred (ConditionalCheckFailedException) when calling the PutItem operation: The conditional request failed.",
    )

    mock_app_config_dao.create.side_effect = ClientError(error_msg, "PutItem")
    assert lambda_handler(mock_event, mock_context) == expected_response


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.AppConfigurationModel")
@mock.patch(
    "ml_space_lambda.app_configuration.policy_helper.active_service_policy_manager.ActiveServicePolicyManager.update_activated_services_policy"
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
def test_update_config_unexpected_exception(
    mock_app_config_dao, mock_update_instance_constraint_policies, mock_update_activated_services_policy, mock_app_config_model
):
    version_id = 1
    mock_event = generate_event("global", version_id)

    error_msg = {
        "Error": {"Code": "UnexpectedException", "Message": "Some unexpected exception occurred."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (UnexpectedException) when calling the PutItem operation: Some unexpected exception occurred.",
    )

    mock_app_config_dao.create.side_effect = ClientError(error_msg, "PutItem")
    mock_app_config_model.from_dict.return_value = "dummy-value"
    assert lambda_handler(mock_event, mock_context) == expected_response


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.suspend_all_of_type")
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_update_active_services_all_active_success(
    mock_suspend_all_of_type, mock_iam_manager, mock_app_config_dao, mock_update_instance_constraint_policies
):
    version_id = 1
    mock_event = generate_event("global", version_id)
    mock_app_config_dao.create.return_value = None

    # Add 1 to version ID as it's incremented as part of the update
    success_response = f"Successfully updated configuration for {'global'}, version {version_id+1}."
    expected_response = generate_html_response(200, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_active_service_policy_manager = ActiveServicePolicyManager(mock_context)
    mock_iam_manager.generate_policy_string.assert_called_with(mock_active_service_policy_manager.FILLER_DENY_STATEMENTS)
    mock_iam_manager.update_dynamic_policy.assert_called_with(
        mock_iam_manager.generate_policy_string(),
        "app-denied-services",
        "services",
        "deny",
        on_create_attach_to_notebook_role=True,
        on_create_attach_to_app_role=True,
    )


@pytest.mark.parametrize(
    "type_info",
    [
        {"resource_type": ResourceType.BATCH_TRANSLATE_JOB, "service_type": ServiceType.BATCH_TRANSLATE},
        {"service_type": ServiceType.REALTIME_TRANSLATE},
        {"resource_type": ResourceType.LABELING_JOB, "service_type": ServiceType.LABELING_JOB},
        {"resource_type": ResourceType.EMR_CLUSTER, "service_type": ServiceType.EMR_CLUSTER},
    ],
    ids=["test_batch_translate", "test_realtime_translate", "test_labeling_job", "test_emr_cluster"],
)
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.suspend_all_of_type")
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_update_active_services_single_deny_success(
    mock_suspend_all_of_type, mock_iam_manager, mock_app_config_dao, mock_update_instance_constraint_policies, type_info
):
    version_id = 1
    overrides = {
        "configuration": {
            "EnabledServices": {
                ServiceType.REALTIME_TRANSLATE.value: True,
                ServiceType.BATCH_TRANSLATE.value: True,
                ServiceType.LABELING_JOB.value: True,
                ServiceType.EMR_CLUSTER.value: True,
                ServiceType.ENDPOINT.value: True,
                ServiceType.ENDPOINT_CONFIG.value: True,
                ServiceType.HPO_JOB.value: True,
                ServiceType.MODEL.value: True,
                ServiceType.NOTEBOOK.value: True,
                ServiceType.TRAINING_JOB.value: True,
                ServiceType.TRANSFORM_JOB.value: True,
            },
        }
    }
    overrides["configuration"]["EnabledServices"][type_info["service_type"]] = False
    mock_event = generate_event("global", version_id, overrides=overrides)
    mock_app_config_dao.create.return_value = None

    # Add 1 to version ID as it's incremented as part of the update
    success_response = f"Successfully updated configuration for {'global'}, version {version_id+1}."
    expected_response = generate_html_response(200, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_active_service_policy_manager = ActiveServicePolicyManager(mock_context)
    mock_iam_manager.generate_policy_string.assert_called_with(
        mock_active_service_policy_manager.SERVICE_DEACTIVATE_PROPERTIES[type_info["service_type"]]["Statements"]
    )
    mock_iam_manager.update_dynamic_policy.assert_called_with(
        mock_iam_manager.generate_policy_string(),
        "app-denied-services",
        "services",
        "deny",
        on_create_attach_to_notebook_role=True,
        on_create_attach_to_app_role=True,
    )
    if "resource_type" in type_info:
        mock_suspend_all_of_type.assert_called_with(type_info["resource_type"])


@mock.patch("ml_space_lambda.app_configuration.lambda_functions.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.app_configuration_dao")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.app_configuration.lambda_functions.suspend_all_of_type")
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_update_active_services_group_deny_success(
    mock_suspend_all_of_type, mock_iam_manager, mock_app_config_dao, mock_upate_instance_constraint_policies
):
    version_id = 1
    mock_event = generate_event(
        "global",
        version_id,
        overrides={
            "configuration": {
                "EnabledServices": {
                    ServiceType.REALTIME_TRANSLATE.value: False,
                    ServiceType.BATCH_TRANSLATE.value: False,
                    ServiceType.LABELING_JOB.value: True,
                    ServiceType.EMR_CLUSTER.value: True,
                    ServiceType.ENDPOINT.value: True,
                    ServiceType.ENDPOINT_CONFIG.value: True,
                    ServiceType.HPO_JOB.value: True,
                    ServiceType.MODEL.value: True,
                    ServiceType.NOTEBOOK.value: True,
                    ServiceType.TRAINING_JOB.value: True,
                    ServiceType.TRANSFORM_JOB.value: True,
                },
            }
        },
    )
    mock_app_config_dao.create.return_value = None

    # Add 1 to version ID as it's incremented as part of the update
    success_response = f"Successfully updated configuration for {'global'}, version {version_id+1}."
    expected_response = generate_html_response(200, success_response)

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_active_service_policy_manager = ActiveServicePolicyManager(mock_context)
    mock_iam_manager.generate_policy_string.assert_called_with(
        mock_active_service_policy_manager.SERVICE_DEACTIVATE_PROPERTIES[ServiceType.REALTIME_TRANSLATE]["Statements"]
        + mock_active_service_policy_manager.SERVICE_DEACTIVATE_PROPERTIES[ServiceType.BATCH_TRANSLATE]["Statements"]
        + mock_active_service_policy_manager.SERVICE_GROUP_DEACTIVATE_PROPERTIES[0]["Statements"]
    )
    mock_iam_manager.update_dynamic_policy.assert_called_with(
        mock_iam_manager.generate_policy_string(),
        "app-denied-services",
        "services",
        "deny",
        on_create_attach_to_notebook_role=True,
        on_create_attach_to_app_role=True,
    )
    mock_suspend_all_of_type.assert_called_with(ResourceType.BATCH_TRANSLATE_JOB)
