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


class ProjectUserModel:
    def __init__(
        self,
        username: str,
        project_name: str,
        role: Optional[str] = None,
        permissions: Optional[List[Permission]] = None,
    ):
        permissions = permissions if permissions else []
        self.user = username
        self.project = project_name
        self.permissions = permissions
        self.role = role if role else ""

    def to_dict(self) -> dict:
        return {
            "user": self.user,
            "project": self.project,
            "permissions": serialize_permissions(self.permissions),
            "role": self.role,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ProjectUserModel:
        return ProjectUserModel(
            username=dict_object["user"],
            project_name=dict_object["project"],
            permissions=dict_object.get("permissions", []),
            role=dict_object.get("role", ""),
        )


class ProjectUserDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars[EnvVariable.PROJECT_USERS_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, project_user: ProjectUserModel) -> None:
        self._create(project_user.to_dict())

    def get(self, project_name: str, user_name: str) -> Optional[ProjectUserModel]:
        json_key = {
            "user": user_name,
            "project": project_name,
        }
        try:
            json_response = self._retrieve(json_key)
            return ProjectUserModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_users_for_project(self, project_name: str) -> List[ProjectUserModel]:
        json_response = self._query(
            key_condition_expression="#p = :project",
            expression_names={"#p": "project"},
            expression_values=json.loads(dynamodb_json.dumps({":project": project_name})),
        ).records
        return [ProjectUserModel.from_dict(entry) for entry in json_response]

    # NOTE: This is a keys only projection. If you need the permissions that a user
    #       has on a project you will need to query that record individually.
    def get_projects_for_user(self, username: str):
        json_response = self._query(
            index_name="ReverseLookup",
            key_condition_expression="#u = :user",
            expression_names={"#u": "user"},
            expression_values=json.loads(dynamodb_json.dumps({":user": username})),
        ).records
        return [ProjectUserModel.from_dict(entry) for entry in json_response]

    def get_all(self) -> List[ProjectUserModel]:
        json_response = self._scan().records
        return [ProjectUserModel.from_dict(entry) for entry in json_response]

    def delete(self, project_name: str, user_name: str) -> None:
        json_key = {
            "user": user_name,
            "project": project_name,
        }
        self._delete(json_key)

    def update(self, project: str, user: str, project_user: ProjectUserModel) -> None:
        key = {"user": user, "project": project}
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
