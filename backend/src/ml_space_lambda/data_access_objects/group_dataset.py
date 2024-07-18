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
from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class GroupDatasetModel:
    def __init__(
        self,
        dataset_name: str,
        group_name: str,
    ):
        self.dataset = dataset_name
        self.group = group_name

    def to_dict(self) -> dict:
        return {
            "dataset": self.dataset,
            "group": self.group,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> GroupDatasetModel:
        return GroupDatasetModel(
            dataset_name=dict_object["dataset"],
            group_name=dict_object["group"],
        )


class GroupDatasetDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name or self.env_vars[EnvVariable.GROUP_DATASETS_TABLE]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, group_dataset: GroupDatasetModel) -> None:
        self._create(group_dataset.to_dict())

    def get(self, group_name: str, dataset_name: str) -> Optional[GroupDatasetModel]:
        json_key = {
            "dataset": dataset_name,
            "group": group_name,
        }
        try:
            json_response = self._retrieve(json_key)
            return GroupDatasetModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_datasets_for_group(self, group_name: str) -> List[GroupDatasetModel]:
        json_response = self._query(
            key_condition_expression="#p = :group",
            expression_names={"#p": "group"},
            expression_values=json.loads(dynamodb_json.dumps({":group": group_name})),
        ).records
        return [GroupDatasetModel.from_dict(entry) for entry in json_response]

    def get_groups_for_dataset(self, dataset_name: str):
        json_response = self._query(
            index_name="ReverseLookup",
            key_condition_expression="#u = :dataset",
            expression_names={"#u": "dataset"},
            expression_values=json.loads(dynamodb_json.dumps({":dataset": dataset_name})),
        ).records
        return [GroupDatasetModel.from_dict(entry) for entry in json_response]

    def delete(self, group_name: str, dataset_name: str) -> None:
        json_key = {
            "dataset": dataset_name,
            "group": group_name,
        }
        self._delete(json_key)
