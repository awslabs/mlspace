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
from typing import List, Optional

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import EnvVariable, Permission
from ml_space_lambda.utils.common_functions import serialize_permissions
from ml_space_lambda.utils.mlspace_config import get_environment_variables

TIMEZONE_PREFERENCE_KEY = "timezone"


class UserModel:
    def __init__(
        self,
        username: str,
        email: str,
        display_name: str,
        suspended: bool,
        permissions: Optional[List[Permission]] = None,
        created_at: Optional[float] = None,
        last_login: Optional[float] = None,
        preferences: Optional[dict] = {},
    ):
        now = int(time.time())
        self.username = username
        self.email = email
        self.display_name = display_name
        self.suspended = suspended
        self.permissions = permissions if permissions else []
        self.created_at = created_at if created_at else now
        self.last_login = last_login if last_login else now
        self.preferences = preferences

    def to_dict(self) -> dict:
        return {
            "username": self.username,
            "email": self.email,
            "displayName": self.display_name,
            "suspended": self.suspended,
            "permissions": serialize_permissions(self.permissions),
            "createdAt": self.created_at,
            "lastLogin": self.last_login,
            "preferences": self.preferences,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> UserModel:
        permissions = [Permission(entry) for entry in dict_object.get("permissions", [])]
        return UserModel(
            dict_object["username"],
            dict_object["email"],
            dict_object["displayName"],
            dict_object["suspended"],
            permissions,
            dict_object.get("createdAt", None),
            dict_object.get("lastLogin", None),
            dict_object.get("preferences", {}),
        )


class UserDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars[EnvVariable.USERS_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, user: UserModel) -> None:
        self._create(user.to_dict())

    def update(self, username: str, user: UserModel) -> UserModel:
        json_key = {"username": username}
        # Only a subset of fields can be modified
        update_exp = "SET #p = :permissions, suspended = :suspended, lastLogin = :lastLogin, preferences = :preferences"
        exp_values = json.loads(
            dynamodb_json.dumps(
                {
                    ":permissions": serialize_permissions(user.permissions),
                    ":suspended": user.suspended,
                    ":lastLogin": user.last_login,
                    ":preferences": user.preferences,
                    ":username": username,
                }
            )
        )
        exp_names = {"#p": "permissions"}
        self._update(
            json_key=json_key,
            update_expression=update_exp,
            expression_names=exp_names,
            expression_values=exp_values,
            condition_expression="username = :username",
        )
        return self._retrieve(json_key)

    def delete(self, username: str) -> None:
        json_key = {"username": username}
        self._delete(json_key)

    def get(self, username: str) -> Optional[UserModel]:
        json_key = {"username": username}
        try:
            json_response = self._retrieve(json_key)
            return UserModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_all(self, include_suspended: Optional[bool] = False) -> List[UserModel]:
        if include_suspended:
            json_response = self._scan().records
        else:
            json_response = self._scan(
                filter_expression="suspended = :suspended",
                expression_values=json.loads(dynamodb_json.dumps({":suspended": False})),
            ).records

        return [UserModel.from_dict(entry) for entry in json_response]
