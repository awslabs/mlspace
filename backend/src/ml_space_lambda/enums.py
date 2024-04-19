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


class DatasetType(Enum):
    GLOBAL = "global"
    PRIVATE = "private"
    PROJECT = "project"


# Updating the ResourceType enumeration will likely require an update to the
# corresponding enum in the FrontEnd code (src/shared/model/resource-metadata-model.ts)
class ResourceType(str, Enum):
    BATCH_TRANSLATE_JOB = "batch-translate-job"
    REALTIME_TRANSLATE = "real-time-translate"
    EMR_CLUSTER = "cluster"
    ENDPOINT = "endpoint"
    ENDPOINT_CONFIG = "endpoint-config"
    HPO_JOB = "hpo-job"
    LABELING_JOB = "labeling-job"
    MODEL = "model"
    NOTEBOOK = "notebook-instance"
    TRAINING_JOB = "training-job"
    TRANSFORM_JOB = "transform-job"


class Permission(Enum):
    COLLABORATOR = "CO"
    PROJECT_OWNER = "MO"
    ADMIN = "PMO"
    ACTING_PMO = "actingPMO"


class IAMResourceType(Enum):
    ROLE = "role"
    POLICY = "policy"


class TimezonePreference(Enum):
    LOCAL = "Local"
    UTC = "UTC"


permissions_list_enum = [
    Permission.COLLABORATOR,
    Permission.PROJECT_OWNER,
    Permission.ADMIN,
    Permission.ACTING_PMO,
]
