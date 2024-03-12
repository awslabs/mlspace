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

# Resource Scheduler Data Access Object
from __future__ import annotations

import json
from typing import List, Optional

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class ResourceSchedulerModel:
    def __init__(
        self,
        resource_id: str,
        resource_type: ResourceType,
        termination_time: int,
        project: str,
    ):
        self.resource_id = resource_id
        self.resource_type = resource_type
        self.termination_time = termination_time
        self.project = project

    def to_dict(self) -> dict:
        return {
            "resourceId": self.resource_id,
            "resourceType": self.resource_type,
            "terminationTime": self.termination_time,
            "project": self.project,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ResourceSchedulerModel:
        return ResourceSchedulerModel(
            resource_id=dict_object["resourceId"],
            resource_type=dict_object["resourceType"],
            termination_time=dict_object["terminationTime"],
            project=dict_object["project"],
        )


class ResourceSchedulerDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars["RESOURCE_SCHEDULE_TABLE"]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, resource_scheduler: ResourceSchedulerModel) -> None:
        self._create(resource_scheduler.to_dict())

    def get(
        self, resource_id: str, resource_type: ResourceType
    ) -> Optional[ResourceSchedulerModel]:
        json_key = {"resourceId": resource_id, "resourceType": resource_type}
        try:
            json_response = self._retrieve(json_key)
            return ResourceSchedulerModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def delete(self, resource_id: str, resource_type: ResourceType) -> None:
        json_key = {"resourceId": resource_id, "resourceType": resource_type}
        self._delete(json_key)

    def update_termination_time(
        self, resource_id: str, resource_type: ResourceType, new_termination_time: int, project: str
    ) -> None:
        json_key = {"resourceId": resource_id, "resourceType": resource_type}
        update_exp = "SET terminationTime = :terminationTime, #p = if_not_exists(#p, :project)"
        exp_names = {"#p": "project"}
        exp_values = json.loads(
            dynamodb_json.dumps({":terminationTime": new_termination_time, ":project": project})
        )
        self._update(
            json_key=json_key,
            expression_names=exp_names,
            update_expression=update_exp,
            expression_values=exp_values,
        )

    def get_resources_past_termination_time(
        self, termination_time: int
    ) -> List[ResourceSchedulerModel]:
        expression_attribute_values = {":terminationTime": termination_time}
        json_response = self._scan(
            filter_expression="terminationTime < :terminationTime",
            expression_values=json.loads(dynamodb_json.dumps(expression_attribute_values)),
        ).records
        return [ResourceSchedulerModel.from_dict(entry) for entry in json_response]

    def get_all_project_resources(self, project_name: str) -> List[ResourceSchedulerModel]:
        exp_values = json.loads(dynamodb_json.dumps({":project_name": project_name}))
        exp_names = {"#p": "project"}
        json_response = self._scan(
            filter_expression="#p = :project_name",
            expression_names=exp_names,
            expression_values=exp_values,
        ).records
        return [ResourceSchedulerModel.from_dict(entry) for entry in json_response]
