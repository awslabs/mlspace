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
from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class GroupModel:
    def __init__(
        self,
        name: str,
        description: str,
        created_by: str,
        created_at: Optional[float] = None,
        last_updated_at: Optional[float] = None,
        num_members: Optional[int] = None,
    ):
        now = int(time.time())
        self.name = name
        self.description = description
        self.created_by = created_by
        self.created_at = created_at if created_at else now
        self.last_updated_at = last_updated_at if last_updated_at else now
        self.num_members = num_members

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "createdBy": self.created_by,
            "createdAt": self.created_at,
            "lastUpdatedAt": self.last_updated_at,
            "numMembers": self.num_members,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> GroupModel:
        return GroupModel(
            dict_object["name"],
            dict_object["description"],
            dict_object["createdBy"],
            dict_object.get("createdAt", None),
            dict_object.get("lastUpdatedAt", None),
            dict_object.get("numMembers", None),
        )


class GroupDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars[EnvVariable.GROUPS_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, group: GroupModel) -> None:
        self._create(group.to_dict())

    def update(self, name: str, group: GroupModel) -> GroupModel:
        json_key = {"name": name}
        # Only a subset of fields can be modified
        update_exp = "SET description = :description, lastUpdatedAt = :lastUpdatedAt"
        exp_names = {"#name": "name"}
        exp_values = json.loads(
            dynamodb_json.dumps({":description": group.description, ":lastUpdatedAt": time.time(), ":name": name})
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

    def get(self, name: str) -> Optional[GroupModel]:
        json_key = {"name": name}
        try:
            json_response = self._retrieve(json_key)
            return GroupModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_all(self, group_names: Optional[List[str]] = None) -> List[GroupModel]:
        expression_attribute_values: Dict[str, Any] = {}
        filter_expressions = []

        if group_names is not None:
            # If we specified a filter but it was empty then just return an empty list
            if not group_names:
                return []
            # While a scan and filter isn't ideal the group table should never contain an
            # excessive amount of entries (maybe thousands at the extreme end) so we should
            # be fine here. We could also update the UI to not display the group description
            # and then we wouldn't need this call at all because the group user table
            # has the info we need and we can do an index based lookup in that scenario
            expressions = []
            for i in range(len(group_names)):
                expressions.append(f":p{i}")

            filter_expressions.append(f"#name IN ({', '.join(expressions)})")

            for index, expression in enumerate(expressions):
                expression_attribute_values[expression] = group_names[index]

        json_response = self._scan(
            filter_expression=" AND ".join(filter_expressions) if filter_expressions else None,
            expression_names={"#name": "name"} if group_names else None,
            expression_values=(
                json.loads(dynamodb_json.dumps(expression_attribute_values)) if expression_attribute_values else None
            ),
        ).records
        return [GroupModel.from_dict(entry) for entry in json_response]
