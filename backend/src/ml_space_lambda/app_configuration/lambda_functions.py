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

from ml_space_lambda.app_configuration.policy_helper.notebook import update_instance_constraint_policies
from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationDAO, AppConfigurationModel, SettingsModel
from ml_space_lambda.utils.common_functions import api_wrapper
import boto3

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationDAO, AppConfigurationModel, SettingsModel
from ml_space_lambda.enums import EnvVariable, IAMEffect, IAMStatementProperty, ServiceType
from ml_space_lambda.utils.account_utils import get_account_arn
from ml_space_lambda.utils.common_functions import (
    api_wrapper,
    event_wrapper,
    generate_exception_response,
    generate_html_response,
)
from ml_space_lambda.utils.iam_manager import IAM_RESOURCE_PREFIX, IAMManager
from ml_space_lambda.utils.mlspace_config import get_environment_variables

iam_manager = IAMManager()
log = logging.getLogger(__name__)
app_configuration_dao = AppConfigurationDAO()
env_variables = get_environment_variables()

service_group_disable_permissions = [
    {
        "Description": "Permissions shared by translate services",
        "ServiceGroup": [ServiceType.BATCH_TRANSLATE, ServiceType.REALTIME_TRANSLATE],
        "Statements": [
            {
                IAMStatementProperty.EFFECT: IAMEffect.DENY,
                IAMStatementProperty.ACTION: [
                    "translate:ListTerminologies",
                    "translate:ListLanguages",
                    "comprehend:Detect*",
                    "comprehend:BatchDetect*",
                ],
                IAMStatementProperty.RESOURCE: "*",
            },
            {
                IAMStatementProperty.EFFECT: IAMEffect.DENY,
                IAMStatementProperty.ACTION: "iam:PassRole",
                IAMStatementProperty.RESOURCE: get_account_arn("iam", f"role/{IAM_RESOURCE_PREFIX}*"),
                IAMStatementProperty.CONDITION: {"StringEquals": {"iam:PassedToReception": "translate.amazonaws.com"}},
            },
        ],
    }
]

service_disable_permissions = {
    ServiceType.BATCH_TRANSLATE: [
        {
            IAMStatementProperty.EFFECT: IAMEffect.DENY,
            IAMStatementProperty.ACTION: [
                "translate:StopTextTranslationJob",
                "translate:ListTextTranslationJob",
                "translate:StartTextTranslationJob",
                "translate:DescribeTextTranslationJob",
            ],
            IAMStatementProperty.RESOURCE: "*",
        }
    ],
    ServiceType.REALTIME_TRANSLATE: [
        {
            IAMStatementProperty.EFFECT: IAMEffect.DENY,
            IAMStatementProperty.ACTION: ["translate:TranslateDocument", "translate:TranslateText"],
            IAMStatementProperty.RESOURCE: "*",
        }
    ],
    ServiceType.LABELING_JOB: [
        {
            IAMStatementProperty.EFFECT: IAMEffect.DENY,
            IAMStatementProperty.ACTION: [
                "sagemaker:CreateLabelingJob",
                "sagemaker:DescribeLabelingJob",
                "sagemaker:StopLabelingJob",
            ],
            IAMStatementProperty.RESOURCE: "*",
        }
    ],
    ServiceType.EMR_CLUSTER: [
        {
            IAMStatementProperty.EFFECT: IAMEffect.DENY,
            IAMStatementProperty.ACTION: [
                "elasticmapreduce:RunJobFlow",
                "elasticmapreduce:ListClusters",
                "elasticmapreduce:DescribeCluster",
                "elasticmapreduce:ListInstances",
                "elasticmapreduce:AddTags",
                "elasticmapreduce:TerminateJobFlows",
                "elasticmapreduce:SetTerminationProtection",
            ],
            IAMStatementProperty.RESOURCE: "*",
        },
        {
            IAMStatementProperty.EFFECT: IAMEffect.DENY,
            IAMStatementProperty.ACTION: ["iam:PassRole", "iam:ListRoleTags"],
            IAMStatementProperty.RESOURCE: [
                get_account_arn("iam", f"role/{env_variables[EnvVariable.EMR_EC2_ROLE_NAME]}"),
                get_account_arn("iam", f"role/{env_variables[EnvVariable.EMR_SERVICE_ROLE_NAME]}"),
            ],
        },
        {
            IAMStatementProperty.EFFECT: IAMEffect.DENY,
            IAMStatementProperty.ACTION: ["ec2:AuthorizeSecurityGroupIngress"],
            IAMStatementProperty.RESOURCE: get_account_arn("ec2", "security-group/*"),
        },
        {
            IAMStatementProperty.EFFECT: IAMEffect.DENY,
            IAMStatementProperty.ACTION: ["ec2:DescribeInstances", "ec2:DescribeRoutesTables"],
            IAMStatementProperty.RESOURCE: "*",
        },
    ],
}


@event_wrapper
def update_configuration(event, context):
    try:
        response_status_code = 200
        warning_issues = []
        request = json.loads(event["body"])
        configScope = request["configScope"]
        version_id = request["versionId"] + 1  # increment so this will be the latest version

        new_configuration = SettingsModel.from_dict(request["configuration"])

        app_configuration = AppConfigurationModel(
            configScope=configScope,
            version_id=version_id,
            configuration=new_configuration,
            changed_by=event["requestContext"]["authorizer"]["principalId"],
            change_reason=request["changeReason"],
            created_at=time.time(),
        )

        try:
            # Create a record for this configuration and mark it the latest config by incrementing the version Id
            app_configuration_dao.create(config=app_configuration)
        except Exception as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                e.response["ResponseMetadata"]["HTTPStatusCode"] = 429
            raise e

        # Create the new app deny policy
        try:
            deny_policy_statements = []
            enabled_services_dict = app_configuration.configuration.enabled_services.to_dict()
            # Check each service
            for service in enabled_services_dict.keys():
                # If the service has permissions that need to be denied
                if service in service_disable_permissions:
                    # If the service is deactivated
                    if not enabled_services_dict[service]:
                        # TODO: Stop all jobs and instances associated with the service
                        deny_policy_statements.extend(service_disable_permissions[service])

            # Check for permissions associated with multiple services
            for group in service_group_disable_permissions:
                # If all the services in a group are deactivated, then add the group deny statements to the deny policy
                if "ServiceGroup" in group:
                    active_service_in_group = False
                    for group_service in group["ServiceGroup"]:
                        if enabled_services_dict[group_service]:
                            active_service_in_group = True
                            break
                    # Deny permissions related to the service group
                    if not active_service_in_group and "Statements" in group:
                        deny_policy_statements.extend(group["Statements"])

            # Will create, update, or delete the current deny services policy with the new permissions
            # An empty deny_policy_statements list will result in the policy being deleted as there are no permissions to apply
            iam_manager.update_dynamic_policy(
                iam_manager.generate_policy_string(deny_policy_statements),
                "app-denied-services",
                "services",
                "deny",
                on_create_attach_to_notebook_role=True,
            )

        except Exception as e:
            logging.error(f"Failed to update the denied services policy {str(e)}")
            response_status_code = 207
            warning_issues.append("Failed when updating the deny policy for deacivating service IAM permissions.")

        # All updates were successfully executed
        if response_status_code == 200:
            response_message = f"Successfully updated configuration for {configScope}, version {version_id}."
        # App config was successfullyl updated but other elements may have failed resulting in mixed results
        elif response_status_code == 207:
            response_message = (
                f"Successfully updated configuration for {configScope}, version {version_id}, but some issues were encountered"
            )
            if len(warning_issues) > 0:
                response_message = (
                    response_message
                    + "\n"
                    + "\n".join(warning_issues)
                    + "Please contact your system administrator for further assistance."
                )

        return generate_html_response(response_status_code, response_message)
    except Exception as e:
        return generate_exception_response(e)


@api_wrapper
def get_configuration(event, context):
    configScope = event["queryStringParameters"]["configScope"]
    num_versions = int(event["queryStringParameters"].get("numVersions", 1))

    return app_configuration_dao.get(configScope=configScope, num_versions=num_versions)
