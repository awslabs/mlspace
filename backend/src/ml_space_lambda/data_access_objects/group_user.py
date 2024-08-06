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
from ml_space_lambda.enums import EnvVariable, Permission
from ml_space_lambda.utils.common_functions import serialize_permissions
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class GroupUserModel:
    def __init__(
        self,
        username: str,
        group_name: str,
        role: Optional[str] = None,
        permissions: Optional[List[Permission]] = None,
    ):
        permissions = permissions or []
        self.user = username
        self.group = group_name
        self.permissions = permissions
        self.role = role or ""

    def to_dict(self) -> dict:
        return {
            "user": self.user,
            "group": self.group,
            "permissions": serialize_permissions(self.permissions),
            "role": self.role,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> GroupUserModel:
        permissions = [Permission(entry) for entry in dict_object.get("permissions", [])]
        return GroupUserModel(
            username=dict_object["user"],
            group_name=dict_object["group"],
            permissions=permissions,
            role=dict_object.get("role", ""),
        )


class GroupUserDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name or self.env_vars[EnvVariable.GROUP_USERS_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, group_user: GroupUserModel) -> None:
        self._create(group_user.to_dict())

    def get(self, group_name: str, username: str) -> Optional[GroupUserModel]:
        json_key = {
            "user": username,
            "group": group_name,
        }
        try:
            json_response = self._retrieve(json_key)
            return GroupUserModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_users_for_group(self, group_name: str) -> List[GroupUserModel]:
        json_response = self._query(
            key_condition_expression="#p = :group",
            expression_names={"#p": "group"},
            expression_values=json.loads(dynamodb_json.dumps({":group": group_name})),
        ).records
        return [GroupUserModel.from_dict(entry) for entry in json_response]

    # NOTE: This is a keys only projection. If you need the permissions that a user
    #       has on a group you will need to query that record individually.
    def get_groups_for_user(self, username: str):
        json_response = self._query(
            index_name="ReverseLookup",
            key_condition_expression="#u = :user",
            expression_names={"#u": "user"},
            expression_values=json.loads(dynamodb_json.dumps({":user": username})),
        ).records
        return [GroupUserModel.from_dict(entry) for entry in json_response]

    def delete(self, group_name: str, username: str) -> None:
        json_key = {
            "user": username,
            "group": group_name,
        }
        self._delete(json_key)

    def update(self, group: str, user: str, group_user: GroupUserModel) -> None:
        key = {"user": user, "group": group}
        update_exp = "SET #r = :role, #p = :permissions"
        exp_names = {
            "#r": "role",
            "#p": "permissions",
        }
        exp_values = json.loads(
            dynamodb_json.dumps(
                {
                    ":role": group_user.role,
                    ":permissions": serialize_permissions(group_user.permissions),
                }
            )
        )
        self._update(
            json_key=key,
            update_expression=update_exp,
            expression_names=exp_names,
            expression_values=exp_values,
        )
