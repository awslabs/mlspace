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
from typing import Any, Dict, List, Literal, Optional

from botocore.exceptions import ClientError
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.mlspace_config import get_environment_variables


class PagedMetadataResults:
    def __init__(self, records: Optional[List[ResourceMetadataModel]] = [], next_token: Optional[str] = None):
        self.records = records
        self.next_token = next_token


class ResourceMetadataModel:
    def __init__(
        self,
        id: str,
        type: ResourceType,
        user: str,
        project: str,
        metadata: Optional[dict] = {},
    ):
        self.id = id
        self.type = type
        self.user = user
        self.project = project
        self.metadata = metadata

    def to_dict(self) -> dict:
        return {
            "resourceId": self.id,
            "resourceType": self.type,
            "user": self.user,
            "project": self.project,
            "metadata": self.metadata,
        }

    @staticmethod
    def from_dict(dict_object: dict) -> ResourceMetadataModel:
        return ResourceMetadataModel(
            dict_object["resourceId"],
            dict_object["resourceType"],
            dict_object["user"],
            dict_object["project"],
            dict_object.get("metadata", {}),
        )


class ResourceMetadataDAO(DynamoDBObjectStore):
    def __init__(self, table_name: Optional[str] = None, client=None):
        self.env_vars = get_environment_variables()
        table_name = table_name if table_name else self.env_vars["RESOURCE_METADATA_TABLE"]
        DynamoDBObjectStore.__init__(self, table_name=table_name, client=client)

    def create(self, resource_metadata: ResourceMetadataModel) -> None:
        self._create(resource_metadata.to_dict())

    def update(self, id: str, type: ResourceType, metadata: dict) -> ResourceMetadataModel:
        json_key = {"resourceId": id, "resourceType": type}
        # Only a subset of fields can be modified
        update_exp = "SET metadata = :metadata"
        exp_values = json.loads(dynamodb_json.dumps({":metadata": metadata, ":id": id, ":type": type}))
        self._update(
            json_key=json_key,
            update_expression=update_exp,
            expression_values=exp_values,
            condition_expression="resourceId = :id AND resourceType = :type",
        )
        return self._retrieve(json_key)

    def delete(self, id: str, type: ResourceType) -> None:
        json_key = {"resourceId": id, "resourceType": type}
        self._delete(json_key)

    def get(self, id: str, type: ResourceType) -> Optional[ResourceMetadataModel]:
        json_key = {"resourceId": id, "resourceType": type}
        try:
            json_response = self._retrieve(json_key)
            return ResourceMetadataModel.from_dict(dict_object=json_response)
        except KeyError:
            # If we get a KeyError then the item doesn't exist in dynamo
            return None

    def get_all_for_project_by_type(
        self,
        project: str,
        type: ResourceType,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        fetch_all: Optional[bool] = False,
        filter_expression: Optional[str] = None,
        filter_values: Optional[Dict[str, Any]] = None,
        expression_names: Optional[str] = None,
    ) -> PagedMetadataResults:
        expression_values: Dict[str, Any] = {":project": project, ":resourceType": type}
        if filter_expression and filter_values:
            if ":project" in filter_values or ":resourceType" in filter_values:
                raise ValueError("Reserved expression value specified in filter_values.")
            expression_values.update(filter_values)

        if not expression_names:
            expression_names = {"#p": "project"}
        else:
            if "#p" in expression_names:
                raise ValueError("Reserved expression name, '#p', specified in expression_names.")
            expression_names["#p"] = "project"

        ddb_response = self._query(
            index_name="ProjectResources",
            key_condition_expression="#p = :project and resourceType = :resourceType",
            expression_values=json.loads(dynamodb_json.dumps(expression_values)),
            expression_names=expression_names,
            limit=limit if not fetch_all else None,
            page_response=not fetch_all,
            next_token=next_token,
            filter_expression=filter_expression,
        )
        return PagedMetadataResults(
            [ResourceMetadataModel.from_dict(entry) for entry in ddb_response.records],
            ddb_response.next_token,
        )

    def get_all_for_user_by_type(
        self,
        user: str,
        type: ResourceType,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        fetch_all: Optional[bool] = False,
        filter_expression: Optional[str] = None,
        filter_values: Optional[Dict[str, Any]] = None,
    ) -> PagedMetadataResults:
        expression_values: Dict[str, Any] = {":user": user, ":resourceType": type}
        if filter_expression and filter_values:
            if ":user" in filter_values or ":resourceType" in filter_values:
                raise ValueError("Reserved expression value contained specified in filter_values.")
            expression_values.update(filter_values)
        ddb_response = self._query(
            index_name="UserResources",
            key_condition_expression="#u = :user and resourceType = :resourceType",
            expression_values=json.loads(dynamodb_json.dumps(expression_values)),
            expression_names={"#u": "user"},
            limit=limit if not fetch_all else None,
            page_response=not fetch_all,
            next_token=next_token,
            filter_expression=filter_expression,
        )
        return PagedMetadataResults(
            [ResourceMetadataModel.from_dict(entry) for entry in ddb_response.records],
            ddb_response.next_token,
        )

    def get_all_of_type_with_filters(
        self,
        type: ResourceType,
        project: str = None,
        user: str = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        fetch_all: Optional[bool] = False,
        filter_expression: Optional[str] = None,
        filter_values: Optional[Dict[str, Any]] = None,
        filter_names: Optional[Dict[str, Any]] = None,
        index_name: Literal["ProjectResources", "UserResources", None] = None,
    ) -> PagedMetadataResults:
        # Base values
        expression_values: Dict[str, Any] = {":resourceType": type}
        key_condition_expressions = ["resourceType = :resourceType"]

        # Update with provided project
        if project is not None:
            expression_values[":project"] = project
            if index_name == "ProjectResources":
                key_condition_expressions.append("project = :project")

        if user is not None:
            expression_values[":user"] = user
            if index_name == "UserResources":
                key_condition_expressions.append("user = :user")

        if filter_expression and filter_values:
            if ":resourceType" in filter_values:
                raise ValueError("Reserved expression value ':resourceType' specified in filter_values.")
            expression_values.update(filter_values)

        # Assemble the key condition expression
        if len(key_condition_expressions) > 1:
            key_condition_expression = key_condition_expressions.join(" and ")
        else:
            key_condition_expression = key_condition_expressions[0]

        ddb_response = self._query(
            index_name=index_name,
            key_condition_expression=key_condition_expression,
            expression_values=json.loads(dynamodb_json.dumps(expression_values)),
            expression_names=filter_names,
            limit=limit if not fetch_all else None,
            page_response=not fetch_all,
            next_token=next_token,
            filter_expression=filter_expression,
        )
        return PagedMetadataResults(
            [ResourceMetadataModel.from_dict(entry) for entry in ddb_response.records],
            ddb_response.next_token,
        )

    def upsert_record(self, resource_id: str, resource_type: ResourceType, user: str, project: str, metadata: dict):
        try:
            self.update(resource_id, resource_type, metadata)
        except ClientError as e:
            # If we get a conditional check failed exception it's because we don't have an
            # existing metadata record
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                self.create(
                    ResourceMetadataModel(
                        resource_id,
                        resource_type,
                        user,
                        project,
                        metadata,
                    )
                )
            else:
                raise e
