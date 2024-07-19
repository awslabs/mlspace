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
from ml_space_lambda.enums import DatasetType, EnvVariable
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class DatasetModel:
    def __init__(
        self,
        scope: str,
        type: DatasetType,
        name: str,
        description: str,
        location: str,
        created_by: str,
        created_at: Optional[float] = None,
        last_updated_at: Optional[float] = None,
    ):
        now = int(time.time())
        self.scope = scope
        self.type = type
        self.name = name
        self.description = description
        self.location = location
        self.created_by = created_by
        self.created_at = created_at if created_at else now
        self.last_updated_at = last_updated_at if last_updated_at else now

        env_variables = get_environment_variables()
        self.prefix = self.location.replace(f"s3://{env_variables[EnvVariable.DATA_BUCKET]}/", "")
        if not self.prefix.endswith("/"):
            self.prefix = self.prefix + "/"

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "scope": self.scope,
            "type": self.type,
            "description": self.description,
            "location": self.location,
            "createdBy": self.created_by,
            "createdAt": self.created_at,
            "lastUpdatedAt": self.last_updated_at,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> DatasetModel:
        return DatasetModel(
            dict_object["scope"],
            dict_object["type"],
            dict_object["name"],
            dict_object["description"],
            dict_object["location"],
            dict_object["createdBy"],
            dict_object.get("createdAt", None),
            dict_object.get("lastUpdatedAt", None),
        )


class DatasetDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars[EnvVariable.DATASETS_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, dataset: DatasetModel) -> None:
        self._create(dataset.to_dict())

    def update(self, scope: str, name: str, dataset: DatasetModel) -> DatasetModel:
        json_key = {"scope": scope, "name": name}
        # Only a subset of fields can be modified
        update_exp = "SET description = :description, lastUpdatedAt = :lastUpdatedAt"
        exp_names = {"#name": "name", "#scope": "scope"}
        exp_values = json.loads(
            dynamodb_json.dumps(
                {
                    ":description": dataset.description,
                    ":lastUpdatedAt": time.time(),
                    ":name": name,
                    ":scope": scope,
                }
            )
        )
        self._update(
            json_key=json_key,
            update_expression=update_exp,
            expression_names=exp_names,
            expression_values=exp_values,
            condition_expression="#scope = :scope AND #name = :name",
        )
        return self._retrieve(json_key)

    def delete(self, scope: str, dataset_name: str) -> None:
        json_key = {"scope": scope, "name": dataset_name}
        self._delete(json_key)

    def get(self, scope: str, dataset_name: str) -> Optional[DatasetModel]:
        json_key = {"scope": scope, "name": dataset_name}
        try:
            json_response = self._retrieve(json_key)
            return DatasetModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_all_for_scope(self, dataset_type: DatasetType, scope: str) -> List[DatasetModel]:
        json_response = self._query(
            key_condition_expression="#s = :scope",
            filter_expression="#t = :type",
            expression_names={"#s": "scope", "#t": "type"},
            expression_values=json.loads(dynamodb_json.dumps({":scope": scope, ":type": dataset_type})),
        ).records

        return [DatasetModel.from_dict(entry) for entry in json_response]
