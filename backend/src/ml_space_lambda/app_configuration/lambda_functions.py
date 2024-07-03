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
import logging
import time

import boto3

from ml_space_lambda.app_configuration.policy_helper.active_service_policy_manager import ActiveServicePolicyManager
from ml_space_lambda.app_configuration.policy_helper.notebook import update_instance_constraint_policies
from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationDAO, AppConfigurationModel, SettingsModel
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    event_wrapper,
    generate_exception_response,
    generate_html_response,
    retry_config,
)
from ml_space_lambda.utils.iam_manager import IAMManager
from ml_space_lambda.utils.mlspace_config import get_environment_variables
from ml_space_lambda.utils.resource_utils import suspend_all_of_type

log = logging.getLogger(__name__)
app_configuration_dao = AppConfigurationDAO()
env_variables = get_environment_variables()
translate_client = boto3.client("translate", config=retry_config)
resource_metadata_dao = ResourceMetadataDAO()


@event_wrapper
def update_configuration(event, context):
    iam_manager = IAMManager()
    active_service_policy_manager = ActiveServicePolicyManager(context)
    status_code = 200
    execution_error = None
    request = json.loads(event["body"])
    configScope = request["configScope"]
    version_id = request["versionId"] + 1  # increment so this will be the latest version
    resource_types_to_suspend = []

    new_configuration = SettingsModel.from_dict(request["configuration"])

    app_configuration = AppConfigurationModel(
        configScope=configScope,
        version_id=version_id,
        configuration=new_configuration,
        changed_by=event["requestContext"]["authorizer"]["principalId"],
        change_reason=request["changeReason"],
        created_at=time.time(),
    )

    if env_variables[EnvVariable.MANAGE_IAM_ROLES] and configScope == "global":
        # Update the deactivated services permissions with an updated deny policy
        try:
            resource_types_to_suspend = active_service_policy_manager.update_activated_services_policy(
                app_configuration, iam_manager=iam_manager
            )
        except Exception as e:
            logging.exception(f"Failed to update the denied services policy {str(e)}")
            execution_error = e
            status_code = 500

        if status_code == 200:
            # Update the allowed instance types with updated instances policies
            try:
                update_instance_constraint_policies(app_configuration.configuration.enabled_instance_types, context)
            except Exception as e:
                logging.exception(f"Failed to update the instances policy {str(e)}")
                execution_error = e
                status_code = 500

    # All updates were successfully executed
    if status_code == 200:
        try:
            # Create a record for this configuration and mark it the latest config by incrementing the version Id
            app_configuration_dao.create(config=app_configuration)
            response_message = f"Successfully updated configuration for {configScope}, version {version_id}."
        except Exception as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                e.response["ResponseMetadata"]["HTTPStatusCode"] = 429
            e.response["Error"]["Message"] = "Failed when updating the app configuration." + (
                " " + e.response["Error"]["Message"] if e.response["Error"]["Message"] else ""
            )
            execution_error = e
            status_code = 500

        if len(resource_types_to_suspend) > 0:
            try:
                for resource_type in resource_types_to_suspend:
                    suspend_all_of_type(resource_type)
            except Exception:
                status_code = 207
                response_message = f"Successfully updated configuration for {configScope}, version {version_id}, but issues were encountered when suspending resources for a deactivated service. Please contact your system administrator for assistance in suspending resources for deactivated services."

    # If an irrecoverable error occurred
    if execution_error:
        if env_variables[EnvVariable.MANAGE_IAM_ROLES] and configScope == "global":
            # Get the current app-config
            stable_app_config = AppConfigurationModel.from_dict(app_configuration_dao.get("global")[0])

            # Update the deactivated services permissions with an updated deny policy
            try:
                active_service_policy_manager.update_activated_services_policy(stable_app_config, iam_manager=iam_manager)
            except Exception as e:
                logging.exception(f"Failed to update the denied services policy {str(e)}")

            # Update the allowed instance types with updated instances policies
            try:
                update_instance_constraint_policies(stable_app_config.configuration.enabled_instance_types, context)
            except Exception as e:
                # Log the error, but don't overwrite the original error message
                logging.exception(f"Failed to update the instances policy {str(e)}")

        return generate_exception_response(execution_error, status_code)

    return generate_html_response(status_code, response_message)


@api_wrapper
def get_configuration(event, context):
    configScope = event["queryStringParameters"]["configScope"]
    num_versions = int(event["queryStringParameters"].get("numVersions", 1))

    return app_configuration_dao.get(configScope=configScope, num_versions=num_versions)
