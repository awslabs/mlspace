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

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationModel
from ml_space_lambda.enums import EnvVariable, IAMEffect, IAMStatementProperty, ResourceType, ServiceType
from ml_space_lambda.utils.account_utils import account_arn_from_context
from ml_space_lambda.utils.iam_manager import IAM_RESOURCE_PREFIX, IAMManager
from ml_space_lambda.utils.mlspace_config import get_environment_variables

env_variables = get_environment_variables()


class ActiveServicePolicyManager:
    def __init__(self, context):
        self.SERVICE_GROUP_DEACTIVATE_PROPERTIES = [
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
                        IAMStatementProperty.RESOURCE: account_arn_from_context(
                            context, "iam", f"role/{IAM_RESOURCE_PREFIX}*"
                        ),
                        IAMStatementProperty.CONDITION: {"StringEquals": {"iam:PassedToReception": "translate.amazonaws.com"}},
                    },
                ],
            }
        ]

        self.SERVICE_DEACTIVATE_PROPERTIES = {
            ServiceType.BATCH_TRANSLATE: {
                "Statements": [
                    {
                        IAMStatementProperty.EFFECT: IAMEffect.DENY,
                        IAMStatementProperty.ACTION: [
                            "translate:StopTextTranslationJob",
                            "translate:ListTextTranslationJobs",
                            "translate:StartTextTranslationJob",
                            "translate:DescribeTextTranslationJob",
                        ],
                        IAMStatementProperty.RESOURCE: "*",
                    }
                ],
                "ResourceType": ResourceType.BATCH_TRANSLATE_JOB,
            },
            ServiceType.REALTIME_TRANSLATE: {
                "Statements": [
                    {
                        IAMStatementProperty.EFFECT: IAMEffect.DENY,
                        IAMStatementProperty.ACTION: ["translate:TranslateDocument", "translate:TranslateText"],
                        IAMStatementProperty.RESOURCE: "*",
                    }
                ]
            },
            ServiceType.LABELING_JOB: {
                "Statements": [
                    {
                        IAMStatementProperty.EFFECT: IAMEffect.DENY,
                        IAMStatementProperty.ACTION: [
                            "sagemaker:CreateLabelingJob",
                            "sagemaker:DescribeLabelingJob",
                            "sagemaker:StopLabelingJob",
                            "sagemaker:ListLabelingJobs",
                        ],
                        IAMStatementProperty.RESOURCE: "*",
                    }
                ],
                "ResourceType": ResourceType.LABELING_JOB,
            },
            ServiceType.EMR_CLUSTER: {
                "Statements": [
                    {
                        IAMStatementProperty.EFFECT: IAMEffect.DENY,
                        IAMStatementProperty.ACTION: [
                            "elasticmapreduce:*",
                        ],
                        IAMStatementProperty.RESOURCE: "*",
                    },
                    {
                        IAMStatementProperty.EFFECT: IAMEffect.DENY,
                        IAMStatementProperty.ACTION: ["iam:PassRole", "iam:ListRoleTags"],
                        IAMStatementProperty.RESOURCE: [
                            account_arn_from_context(context, "iam", f"role/{env_variables[EnvVariable.EMR_EC2_ROLE_NAME]}"),
                            account_arn_from_context(
                                context, "iam", f"role/{env_variables[EnvVariable.EMR_SERVICE_ROLE_NAME]}"
                            ),
                        ],
                    },
                    {
                        IAMStatementProperty.EFFECT: IAMEffect.DENY,
                        IAMStatementProperty.ACTION: ["ec2:AuthorizeSecurityGroupIngress"],
                        IAMStatementProperty.RESOURCE: account_arn_from_context(context, "ec2", "security-group/*"),
                    },
                    {
                        IAMStatementProperty.EFFECT: IAMEffect.DENY,
                        IAMStatementProperty.ACTION: ["ec2:DescribeInstances", "ec2:DescribeRoutesTables"],
                        IAMStatementProperty.RESOURCE: "*",
                    },
                ],
                "ResourceType": ResourceType.EMR_CLUSTER,
            },
        }

        # Instead of deleting the policy (which requires unattaching from all roles) assign a filler non-impactful statement
        self.FILTER_DENY_STATEMENTS = [
            {
                IAMStatementProperty.EFFECT: IAMEffect.DENY,
                IAMStatementProperty.ACTION: ["dynamodb:CreateTable"],
                IAMStatementProperty.RESOURCE: account_arn_from_context(context, "dynamodb", "table/invalid-table"),
            },
        ]

    def update_activated_services_policy(
        self, app_configuration: AppConfigurationModel, iam_manager: IAMManager = None
    ) -> list[ResourceType]:
        """
        Uses the provided app_configuration and either the provided iam_manager or a new instance of IAMManager to update the policies

        Returns list[ResourceType] of resource types that should be suspended
        """
        resource_types_to_suspend = []
        deny_policy_statements = []
        enabled_services_dict = app_configuration.configuration.enabled_services.to_dict()

        iam_manager = IAMManager() if iam_manager is None else iam_manager

        # Check each service
        for service in enabled_services_dict.keys():
            # If the service is deactivated and has instructions on how to deny the service in 'service_disable_permissions'
            if not enabled_services_dict[service] and service in self.SERVICE_DEACTIVATE_PROPERTIES:
                if "ResourceType" in self.SERVICE_DEACTIVATE_PROPERTIES[service]:
                    resource_types_to_suspend.append(self.SERVICE_DEACTIVATE_PROPERTIES[service]["ResourceType"])
                deny_policy_statements.extend(self.SERVICE_DEACTIVATE_PROPERTIES[service]["Statements"])

        # Check for permissions associated with multiple services
        for group in self.SERVICE_GROUP_DEACTIVATE_PROPERTIES:
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

        # When all services are activated, apply a filler statement so that the policy does not need to be unattached and deleted
        # Unattaching from all roles could cause throttling and will require re-attaching to all dynamic roles later
        if len(deny_policy_statements) == 0:
            deny_policy_statements.extend(self.FILTER_DENY_STATEMENTS)

        # Will create, update the current deny services policy with the new permissions
        iam_manager.update_dynamic_policy(
            iam_manager.generate_policy_string(deny_policy_statements),
            "app-denied-services",
            "services",
            "deny",
            on_create_attach_to_notebook_role=True,
        )

        return resource_types_to_suspend
