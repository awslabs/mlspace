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

# Project Group Table Data Access Object
from __future__ import annotations

import json
from typing import List, Optional

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import EnvVariable, Permission
from ml_space_lambda.utils.common_functions import serialize_permissions
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class ProjectGroupModel:
    def __init__(
        self,
        group_name: str,
        project_name: str,
        permissions: Optional[List[Permission]] = None,
    ):
        permissions = permissions if permissions else []
        self.group_name = group_name
        self.project = project_name
        self.permissions = permissions

    def to_dict(self) -> dict:
        return {
            "group": self.group_name,
            "project": self.project,
            "permissions": serialize_permissions(self.permissions),
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ProjectGroupModel:
        permissions = [Permission(entry) for entry in dict_object.get("permissions", [])]
        return ProjectGroupModel(
            group_name=dict_object["group"],
            project_name=dict_object["project"],
            permissions=permissions,
        )


class ProjectGroupDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars[EnvVariable.PROJECT_GROUPS_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, project_group: ProjectGroupModel) -> None:
        self._create(project_group.to_dict())

    def get(self, project_name: str, group_name: str) -> Optional[ProjectGroupModel]:
        json_key = {
            "group": group_name,
            "project": project_name,
        }
        try:
            json_response = self._retrieve(json_key)
            return ProjectGroupModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_groups_for_project(self, project_name: str) -> List[ProjectGroupModel]:
        json_response = self._query(
            key_condition_expression="#p = :project",
            expression_names={"#p": "project"},
            expression_values=json.loads(dynamodb_json.dumps({":project": project_name})),
        ).records
        return [ProjectGroupModel.from_dict(entry) for entry in json_response]

    # NOTE: This is a keys only projection. If you need the permissions that a group
    #       has on a project you will need to query that record individually.
    def get_projects_for_group(self, group_name: str):
        json_response = self._query(
            index_name="ReverseLookup",
            key_condition_expression="#g = :group",
            expression_names={"#g": "group"},
            expression_values=json.loads(dynamodb_json.dumps({":group": group_name})),
        ).records
        return [ProjectGroupModel.from_dict(entry) for entry in json_response]

    def delete(self, project_name: str, group_name: str) -> None:
        json_key = {
            "group": group_name,
            "project": project_name,
        }
        self._delete(json_key)

    def update(self, project: str, group_name: str, project_group: ProjectGroupModel) -> None:
        key = {"group": group_name, "project": project}
        update_exp = "SET #p = :permissions"
        exp_names = {
            "#p": "permissions",
        }
        exp_values = json.loads(
            dynamodb_json.dumps(
                {
                    ":permissions": serialize_permissions(project_group.permissions),
                }
            )
        )
        self._update(
            json_key=key,
            update_expression=update_exp,
            expression_names=exp_names,
            expression_values=exp_values,
        )
