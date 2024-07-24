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
import time
from typing import Any, Dict, List, Optional

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import EnvVariable, ResourceType
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class ProjectModel:
    def __init__(
        self,
        name: str,
        description: str,
        suspended: bool,
        created_by: str,
        created_at: Optional[float] = None,
        last_updated_at: Optional[float] = None,
        metadata: Optional[dict] = {},
        groups: List[str] = [],
    ):
        now = int(time.time())
        self.name = name
        self.description = description
        self.suspended = suspended
        self.created_by = created_by
        self.created_at = created_at if created_at else now
        self.last_updated_at = last_updated_at if last_updated_at else now
        self.metadata = metadata
        self.groups = groups

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "suspended": self.suspended,
            "createdBy": self.created_by,
            "createdAt": self.created_at,
            "lastUpdatedAt": self.last_updated_at,
            "metadata": self.metadata,
            "groups": self.groups,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ProjectModel:
        return ProjectModel(
            dict_object["name"],
            dict_object["description"],
            dict_object.get("suspended", False),
            dict_object["createdBy"],
            dict_object.get("createdAt", None),
            dict_object.get("lastUpdatedAt", None),
            dict_object.get("metadata", {}),
            dict_object.get("groups", []),
        )

    def has_default_stop_time(self, resource_type: ResourceType):
        if resource_type == ResourceType.ENDPOINT:
            stop_time_config_name = "defaultEndpointTTL"
        elif resource_type == ResourceType.NOTEBOOK:
            stop_time_config_name = "defaultNotebookStopTime"
        elif resource_type == ResourceType.EMR_CLUSTER:
            stop_time_config_name = "defaultEMRClusterTTL"
        else:
            return False

        return (
            self.metadata
            and "terminationConfiguration" in self.metadata
            and stop_time_config_name in self.metadata["terminationConfiguration"]
        )


class ProjectDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars[EnvVariable.PROJECTS_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, project: ProjectModel) -> None:
        self._create(project.to_dict())

    def update(self, name: str, project: ProjectModel) -> ProjectModel:
        json_key = {"name": name}
        # Only a subset of fields can be modified
        update_exp = "SET description = :description, suspended = :suspended, lastUpdatedAt = :lastUpdatedAt, metadata = :metadata, groups = :groups"
        exp_names = {"#name": "name"}
        exp_values = json.loads(
            dynamodb_json.dumps(
                {
                    ":description": project.description,
                    ":suspended": project.suspended,
                    ":lastUpdatedAt": time.time(),
                    ":name": name,
                    ":metadata": project.metadata,
                    ":groups": project.groups,
                }
            )
        )
        self._update(
            json_key=json_key,
            update_expression=update_exp,
            expression_names=exp_names,
            expression_values=exp_values,
            condition_expression="#name = :name",
        )
        return self._retrieve(json_key)

    def delete(self, name: str) -> None:
        json_key = {"name": name}
        self._delete(json_key)

    def get(self, name: str) -> Optional[ProjectModel]:
        json_key = {"name": name}
        try:
            json_response = self._retrieve(json_key)
            return ProjectModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_all(
        self, include_suspended: Optional[bool] = False, project_names: Optional[List[str]] = None
    ) -> List[ProjectModel]:
        expression_attribute_values: Dict[str, Any] = {}
        filter_expressions = []

        if not include_suspended:
            expression_attribute_values[":suspended"] = include_suspended
            filter_expressions.append("suspended = :suspended")

        if project_names is not None:
            # If we specified a filter but it was empty then just return an empty list
            if not project_names:
                return []
            # While a scan and filter isn't ideal the project table should never contain an
            # excessive amount of entries (maybe thousands at the extreme end) so we should
            # be fine here. We could also update the UI to not display the project description
            # and then we wouldn't need this call at all because the project user table
            # has the info we need and we can do an index based lookup in that scenario
            expressions = []
            for i in range(len(project_names)):
                expressions.append(f":p{i}")

            filter_expressions.append(f"#name IN ({', '.join(expressions)})")

            for index, expression in enumerate(expressions):
                expression_attribute_values[expression] = project_names[index]

        json_response = self._scan(
            filter_expression=" AND ".join(filter_expressions) if filter_expressions else None,
            expression_names={"#name": "name"} if project_names else None,
            expression_values=(
                json.loads(dynamodb_json.dumps(expression_attribute_values)) if expression_attribute_values else None
            ),
        ).records
        return [ProjectModel.from_dict(entry) for entry in json_response]
