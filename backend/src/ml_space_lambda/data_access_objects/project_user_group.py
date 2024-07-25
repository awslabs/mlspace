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

# Project User Table Data Access Object
from __future__ import annotations

import json
from typing import List, Optional

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import EnvVariable, Permission
from ml_space_lambda.utils.common_functions import serialize_permissions
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class ProjectUserGroupModel:
    def __init__(
        self,
        project_name: str,
        username: str,
        group: str,
        role: Optional[str] = None,
        permissions: Optional[List[Permission]] = None,
    ):
        self.project = project_name
        self.user = username
        self.group = group
        self.role = role if role else ""
        permissions = permissions if permissions else []
        self.permissions = permissions

    def to_dict(self) -> dict:
        return {
            "projectUser": "-".join([self.user, self.project]),
            "project": self.project,
            "user": self.user,
            "group": self.group,
            "permissions": serialize_permissions(self.permissions),
            "role": self.role,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ProjectUserGroupModel:
        permissions = [Permission(entry) for entry in dict_object.get("permissions", [])]
        return ProjectUserGroupModel(
            project_name=dict_object["project"],
            username=dict_object["user"],
            group=dict_object["group"],
            role=dict_object.get("role", ""),
            permissions=permissions,
        )


class ProjectUserGroupDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars[EnvVariable.PROJECT_USER_GROUP_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, project_user: ProjectUserGroupModel) -> None:
        self._create(project_user.to_dict())

    def get(self, project_name: str, user_name: str, group: str) -> Optional[ProjectUserGroupModel]:
        json_key = {
            "projectUser": "-".join([user_name, project_name]),
            "group": group,
        }
        try:
            json_response = self._retrieve(json_key)
            return ProjectUserGroupModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_for_project_user(self, project_name: str, user_name: str, limit=Optional[int]) -> List[ProjectUserGroupModel]:
        json_response = self._query(
            key_condition_expression="projectUser = :projectUser",
            expression_values=json.loads(dynamodb_json.dumps({":projectUser": "-".join([user_name, project_name])})),
            limit=limit,
        ).records
        return [ProjectUserGroupModel.from_dict(entry) for entry in json_response]

    def get_for_group(self, group: str) -> List[ProjectUserGroupModel]:
        json_response = self._query(
            index_name="ReverseLookup",
            key_condition_expression="#g = :group",
            expression_names={"#g": "group"},
            expression_values=json.loads(dynamodb_json.dumps({":group": group})),
        ).records
        return [ProjectUserGroupModel.from_dict(entry) for entry in json_response]

    def delete(self, project_name: str, user_name: str, group: str) -> None:
        json_key = {
            "projectUser": "-".join([user_name, project_name]),
            "group": group,
        }
        self._delete(json_key)

    def update(self, project_name: str, user_name: str, group: str, project_user: ProjectUserGroupModel) -> None:
        key = {
            "projectUser": "-".join([user_name, project_name]),
            "group": group,
        }
        update_exp = "SET #r = :role, #p = :permissions"
        exp_names = {
            "#r": "role",
            "#p": "permissions",
        }
        exp_values = json.loads(
            dynamodb_json.dumps(
                {
                    ":role": project_user.role,
                    ":permissions": serialize_permissions(project_user.permissions),
                }
            )
        )
        self._update(
            json_key=key,
            update_expression=update_exp,
            expression_names=exp_names,
            expression_values=exp_values,
        )
