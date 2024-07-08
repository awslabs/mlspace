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

from enum import Enum


class DatasetType(str, Enum):
    def __str__(self):
        return str(self.value)

    GLOBAL = "global"
    PRIVATE = "private"
    PROJECT = "project"


# Updating the ResourceType enumeration will likely require an update to the
# corresponding enum in the FrontEnd code (src/shared/model/resource-metadata-model.ts)
class ResourceType(str, Enum):
    def __str__(self):
        return str(self.value)

    BATCH_TRANSLATE_JOB = "batch-translate-job"
    EMR_CLUSTER = "cluster"
    ENDPOINT = "endpoint"
    ENDPOINT_CONFIG = "endpoint-config"
    HPO_JOB = "hpo-job"
    LABELING_JOB = "labeling-job"
    MODEL = "model"
    NOTEBOOK = "notebook-instance"
    TRAINING_JOB = "training-job"
    TRANSFORM_JOB = "transform-job"


# This is specifically used for app configuration.
# These are service names without dashes so they can be used as properties of a model in the frontend
class ServiceType(str, Enum):
    def __str__(self):
        return str(self.value)

    REALTIME_TRANSLATE = "realtimeTranslate"
    BATCH_TRANSLATE = "batchTranslate"
    EMR_CLUSTER = "emrCluster"
    ENDPOINT = "endpoint"
    ENDPOINT_CONFIG = "endpointConfig"
    HPO_JOB = "hpoJob"
    LABELING_JOB = "labelingJob"
    MODEL = "model"
    NOTEBOOK = "notebook"
    TRAINING_JOB = "trainingJob"
    TRANSFORM_JOB = "transformJob"


class IAMStatementProperty(str, Enum):
    def __str__(self):
        return str(self.value)

    ACTION = "Action"
    EFFECT = "Effect"
    RESOURCE = "Resource"
    CONDITION = "Condition"


class IAMEffect(str, Enum):
    def __str__(self):
        return str(self.value)

    DENY = "Deny"
    ALLOW = "Allow"


class EnvVariable(str, Enum):
    def __str__(self):
        return str(self.value)

    BUCKET = "BUCKET"
    S3_KEY = "S3_KEY"
    SYSTEM_TAG = "SYSTEM_TAG"
    DATASETS_TABLE = "DATASETS_TABLE"
    PROJECTS_TABLE = "PROJECTS_TABLE"
    PROJECT_USERS_TABLE = "PROJECT_USERS_TABLE"
    USERS_TABLE = "USERS_TABLE"
    RESOURCE_SCHEDULE_TABLE = "RESOURCE_SCHEDULE_TABLE"
    RESOURCE_METADATA_TABLE = "RESOURCE_METADATA_TABLE"
    APP_CONFIGURATION_TABLE = "APP_CONFIGURATION_TABLE"
    GROUPS_TABLE = "GROUPS_TABLE"
    GROUP_USERS_TABLE = "GROUP_USERS_TABLE"
    AWS_DEFAULT_REGION = "AWS_DEFAULT_REGION"
    DATA_BUCKET = "DATA_BUCKET"
    EMR_CONFIG_BUCKET = "EMR_CONFIG_BUCKET"
    MANAGE_IAM_ROLES = "MANAGE_IAM_ROLES"
    LOG_BUCKET = "LOG_BUCKET"
    DYNAMO_TABLE = "DYNAMO_TABLE"
    EMR_EC2_ROLE_NAME = "EMR_EC2_ROLE_NAME"
    EMR_SERVICE_ROLE_NAME = "EMR_SERVICE_ROLE_NAME"
    EMR_SECURITY_CONFIGURATION = "EMR_SECURITY_CONFIGURATION"
    EMR_EC2_SSH_KEY = "EMR_EC2_SSH_KEY"
    ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN = "ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN"
    NEW_USER_SUSPENSION_DEFAULT = "NEW_USER_SUSPENSION_DEFAULT"
    TRANSLATE_DATE_ROLE_ARN = "TRANSLATE_DATE_ROLE_ARN"
    NOTEBOOK_ROLE_NAME = "NOTEBOOK_ROLE_NAME"
    APP_ROLE_NAME = "APP_ROLE_NAME"
    PERMISSIONS_BOUNDARY_ARN = "PERMISSIONS_BOUNDARY_ARN"
    JOB_INSTANCE_CONSTRAINT_POLICY_ARN = "JOB_INSTANCE_CONSTRAINT_POLICY_ARN"
    KMS_INSTANCE_CONDITIONS_POLICY_ARN = "KMS_INSTANCE_CONDITIONS_POLICY_ARN"


class Permission(str, Enum):
    def __str__(self):
        return str(self.value)

    COLLABORATOR = "CO"
    PROJECT_OWNER = "MO"
    ADMIN = "PMO"
    ACTING_PMO = "actingPMO"


class IAMResourceType(str, Enum):
    def __str__(self):
        return str(self.value)

    ROLE = "role"
    POLICY = "policy"


class TimezonePreference(str, Enum):
    def __str__(self):
        return str(self.value)

    LOCAL = "Local"
    UTC = "UTC"


permissions_list_enum = [
    Permission.COLLABORATOR,
    Permission.PROJECT_OWNER,
    Permission.ADMIN,
    Permission.ACTING_PMO,
]
