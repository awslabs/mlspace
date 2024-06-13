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

from __future__ import annotations

import json
from typing import List, Optional

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import ServiceType
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class AppConfigurationModel:
    def __init__(
        self,
        configScope: str,  # 'global' or a project name
        version_id: int,
        configuration: SettingsModel,
        changed_by: str,
        change_reason: str,
        created_at: int,
    ):
        self.configScope = configScope
        self.version_id = version_id
        self.configuration = configuration
        self.changed_by = changed_by
        self.change_reason = change_reason
        self.created_at = created_at

    def to_dict(self) -> dict:
        return {
            "configScope": self.configScope,
            "versionId": self.version_id,
            "configuration": self.configuration.to_dict(),
            "changedBy": self.changed_by,
            "changeReason": self.change_reason,
            "createdAt": self.created_at,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> AppConfigurationModel:
        return AppConfigurationModel(
            dict_object["configScope"],
            dict_object["versionId"],
            SettingsModel.from_dict(dict_object["configuration"]),
            dict_object["changedBy"],
            dict_object["changeReason"],
            dict_object["createdAt"],
        )


class SettingsModel:
    def __init__(
        self,
        enabled_instance_types: ServiceInstanceTypes,
        enabled_services: EnabledServices,
        emr_config: EMRConfig,
        project_creation: Optional[ProjectCreation] = None,
        system_banner: Optional[SystemBanner] = None,
    ):
        self.enabled_instance_types = enabled_instance_types
        self.enabled_services = enabled_services
        self.project_creation = project_creation
        self.emr_config = emr_config
        self.system_banner = system_banner

    def to_dict(self) -> dict:
        config_dict = {
            "EnabledInstanceTypes": self.enabled_instance_types.to_dict(),
            "EnabledServices": self.enabled_services.to_dict(),
            "EMRConfig": self.emr_config.to_dict(),
        }
        # The below configs won't be in project-level configs
        if self.project_creation:
            config_dict["ProjectCreation"] = self.project_creation.to_dict()

        if self.system_banner:
            config_dict["SystemBanner"] = self.system_banner.to_dict()
        return config_dict

    @staticmethod
    def from_dict(dict_object: dict) -> SettingsModel:
        return SettingsModel(
            enabled_instance_types=ServiceInstanceTypes.from_dict(dict_object["EnabledInstanceTypes"]),
            enabled_services=EnabledServices.from_dict(dict_object["EnabledServices"]),
            emr_config=EMRConfig.from_dict(dict_object["EMRConfig"]),
            project_creation=(
                ProjectCreation.from_dict(dict_object["ProjectCreation"]) if "ProjectCreation" in dict_object else None
            ),
            system_banner=SystemBanner.from_dict(dict_object["SystemBanner"]) if "SystemBanner" in dict_object else None,
        )


class ServiceInstanceTypes:
    def __init__(
        self,
        notebook_instance_types: list,
        endpoint_instance_types: list,
        training_job_instance_types: list,
        transform_jobs_instance_types: list,
    ):
        self.notebook_instance_types = notebook_instance_types
        self.endpoint_instance_types = endpoint_instance_types
        self.training_job_instance_types = training_job_instance_types
        self.transform_jobs_instance_types = transform_jobs_instance_types

    def to_dict(self) -> dict:
        return {
            ServiceType.NOTEBOOK.value: self.notebook_instance_types,
            ServiceType.ENDPOINT.value: self.endpoint_instance_types,
            ServiceType.TRAINING_JOB.value: self.training_job_instance_types,
            ServiceType.TRANSFORM_JOB.value: self.transform_jobs_instance_types,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ServiceInstanceTypes:
        return ServiceInstanceTypes(
            dict_object[ServiceType.NOTEBOOK.value],
            dict_object[ServiceType.ENDPOINT.value],
            dict_object[ServiceType.TRAINING_JOB.value],
            dict_object[ServiceType.TRANSFORM_JOB.value],
        )


class EnabledServices:
    def __init__(
        self,
        realtime_translate: bool,
        batch_translate: bool,
        labeling_job: bool,
        emr: bool,
        training_job: bool,
        transform_job: bool,
        hpo_job: bool,
        endpoint: bool,
        endpoint_congig: bool,
        notebook: bool,
        model: bool,
    ):
        self.realtime_translate = realtime_translate
        self.batch_translate = batch_translate
        self.labeling_job = labeling_job
        self.emr = emr
        self.training_job = training_job
        self.transform_job = transform_job
        self.hpo_job = hpo_job
        self.endpoint = endpoint
        self.endpoint_congig = endpoint_congig
        self.notebook = notebook
        self.model = model

    def to_dict(self) -> dict:
        return {
            ServiceType.REALTIME_TRANSLATE.value: self.realtime_translate,
            ServiceType.BATCH_TRANSLATE.value: self.batch_translate,
            ServiceType.LABELING_JOB.value: self.labeling_job,
            ServiceType.EMR_CLUSTER.value: self.emr,
            ServiceType.TRAINING_JOB.value: self.training_job,
            ServiceType.TRANSFORM_JOB.value: self.transform_job,
            ServiceType.HPO_JOB.value: self.hpo_job,
            ServiceType.ENDPOINT.value: self.endpoint,
            ServiceType.ENDPOINT_CONFIG.value: self.endpoint_congig,
            ServiceType.NOTEBOOK.value: self.notebook,
            ServiceType.MODEL.value: self.model,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> EnabledServices:
        return EnabledServices(
            dict_object[ServiceType.REALTIME_TRANSLATE.value],
            dict_object[ServiceType.BATCH_TRANSLATE.value],
            dict_object[ServiceType.LABELING_JOB.value],
            dict_object[ServiceType.EMR_CLUSTER.value],
            dict_object[ServiceType.TRAINING_JOB.value],
            dict_object[ServiceType.TRANSFORM_JOB.value],
            dict_object[ServiceType.HPO_JOB.value],
            dict_object[ServiceType.ENDPOINT.value],
            dict_object[ServiceType.ENDPOINT_CONFIG.value],
            dict_object[ServiceType.NOTEBOOK.value],
            dict_object[ServiceType.MODEL.value],
        )


class EMRConfig:
    def __init__(self, cluster_types: list, auto_scaling: EMRAutoScaling, applications: EMRApplications):
        self.cluster_types = cluster_types
        self.auto_scaling = auto_scaling
        self.applications = applications

    def to_dict(self) -> dict:
        return {
            "clusterTypes": ClusterType.to_dict(self.cluster_types),
            "autoScaling": self.auto_scaling.to_dict(),
            "applications": EMRApplications.to_dict(self.applications),
        }

    @staticmethod
    def from_dict(dict_object: dict) -> EMRConfig:
        return EMRConfig(
            ClusterType.extract_cluster_types(dict_object["clusterTypes"]),
            EMRAutoScaling.from_dict(dict_object["autoScaling"]),
            EMRApplications.extract_applications(dict_object["applications"]),
        )


class ClusterType:
    def __init__(self, name: str, size: int, master_type: str, core_type: str):
        self.name = name
        self.size = size
        self.master_type = master_type
        self.core_type = core_type

    @staticmethod
    def to_dict(cluster_type_list: list):
        list_of_dicts = []
        for clusterType in cluster_type_list:
            list_of_dicts.append(
                {
                    "name": clusterType.name,
                    "size": clusterType.size,
                    "masterType": clusterType.master_type,
                    "coreType": clusterType.core_type,
                }
            )
        return list_of_dicts

    @staticmethod
    def extract_cluster_types(cluster_type_list: list):
        # Given a list of cluster types, parse them into a list of ClusterType objects
        cluster_object_list = []
        for clusterType in cluster_type_list:
            cluster_object_list.append(
                ClusterType(clusterType["name"], clusterType["size"], clusterType["masterType"], clusterType["coreType"])
            )
        return cluster_object_list


class EMRAutoScaling:
    def __init__(
        self,
        min_instances: int,
        max_instances: int,
        scale_out: ScalingModel,
        scale_in: ScalingModel,
    ):
        self.min_instances = min_instances
        self.max_instances = max_instances
        self.scale_out = scale_out
        self.scale_in = scale_in

    def to_dict(self):
        return {
            "minInstances": self.min_instances,
            "maxInstances": self.max_instances,
            "scaleOut": self.scale_out.to_dict(),
            "scaleIn": self.scale_in.to_dict(),
        }

    @staticmethod
    def from_dict(dict_object: dict) -> EMRAutoScaling:
        return EMRAutoScaling(
            dict_object["minInstances"],
            dict_object["maxInstances"],
            ScalingModel.from_dict(dict_object["scaleOut"]),
            ScalingModel.from_dict(dict_object["scaleIn"]),
        )


class ScalingModel:
    def __init__(self, increment: int, percentage_mem_available: int, eval_periods: int, cooldown: int):
        self.increment = increment
        self.percentage_mem_available = percentage_mem_available
        self.eval_periods = eval_periods
        self.cooldown = cooldown

    def to_dict(self):
        return {
            "increment": self.increment,
            "percentageMemAvailable": self.percentage_mem_available,
            "evalPeriods": self.eval_periods,
            "cooldown": self.cooldown,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ScalingModel:
        return ScalingModel(
            dict_object["increment"],
            dict_object["percentageMemAvailable"],
            dict_object["evalPeriods"],
            dict_object["cooldown"],
        )


class EMRApplications:
    def __init__(self, name: str):
        self.name = name

    @staticmethod
    def to_dict(application_list: list):
        list_of_dicts = []
        for application in application_list:
            list_of_dicts.append({"Name": application.name})
        return list_of_dicts

    @staticmethod
    def extract_applications(application_list: list):
        # Given a list of applications, parse them into a list of EMRApplication objects
        application_object_list = []
        for application in application_list:
            application_object_list.append(EMRApplications(application["Name"]))
        return application_object_list


class ProjectCreation:
    def __init__(self, admin_only: bool, allowed_groups: list):
        self.admin_only = admin_only
        self.allowed_groups = allowed_groups

    def to_dict(self) -> dict:
        return {
            "isAdminOnly": self.admin_only,
            "allowedGroups": self.allowed_groups,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ProjectCreation:
        return ProjectCreation(
            dict_object["isAdminOnly"],
            dict_object["allowedGroups"],
        )


class SystemBanner:
    def __init__(self, enabled: bool, text_color: str, background_color: str, text: str):
        self.enabled = enabled
        self.text_color = text_color
        self.background_color = background_color
        self.text = text

    def to_dict(self) -> dict:
        return {
            "isEnabled": self.enabled,
            "textColor": self.text_color,
            "backgroundColor": self.background_color,
            "text": self.text,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> SystemBanner:
        return SystemBanner(
            dict_object["isEnabled"],
            dict_object["textColor"],
            dict_object["backgroundColor"],
            dict_object["text"],
        )


class AppConfigurationDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars["APP_CONFIGURATION_TABLE"]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, config: AppConfigurationModel) -> None:
        # The provided versionId should not exist; if it does, we're updating an outdated version of the config
        self._create(
            config.to_dict(), condition_expression="attribute_not_exists(configScope) AND attribute_not_exists(versionId)"
        )

    def get(self, configScope: str, num_versions: int = 1) -> List[dict]:
        json_response = self._query(
            key_condition_expression="#s = :configScope",
            expression_names={"#s": "configScope"},
            expression_values=json.loads(dynamodb_json.dumps({":configScope": configScope})),
            limit=num_versions,
            page_response=True,
            scan_index_forward=False,
        ).records
        return json_response

    # Currently only used to update the initial app config (versionId=0)
    def update(self, config: dict) -> None:
        json_key = {"configScope": "global", "versionId": 0}
        update_exp = (
            "SET configuration = :config, changedBy = :changedBy, changeReason = :changeReason, createdAt = :createdAt"
        )
        exp_values = json.loads(
            dynamodb_json.dumps(
                {
                    ":changedBy": config["changedBy"],
                    ":changeReason": config["changeReason"],
                    ":createdAt": config["createdAt"],
                    ":config": config["configuration"],
                }
            )
        )
        self._update(
            json_key=json_key,
            update_expression=update_exp,
            expression_values=exp_values,
        )
