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

# Core functionality for DynamoDB-based data access objects for accessing MLSpace data.
import json
from typing import Dict, List, Optional

import boto3
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.pagination_helper import decode_pagination_token, encode_pagination_token
from ml_space_lambda.utils.common_functions import retry_config


class PagedResults:
    def __init__(self, records: Optional[List[Dict]] = [], next_token: Optional[str] = None):
        self.records = records
        self.next_token = next_token


# Core DynamoDB Object Store, logic universal to all tables
class DynamoDBObjectStore:
    def __init__(self, table_name="", client=None):
        self.table_name = table_name
        self.client = client if client else boto3.client("dynamodb", config=retry_config)

    def _create(self, json_object: dict):
        dynamodb_input = json.loads(dynamodb_json.dumps(json_object))
        # Add new item to the table
        self.client.put_item(
            TableName=self.table_name,
            Item=dynamodb_input,
        )

    def _retrieve(self, json_key: dict):
        dynamodb_key = json.loads(dynamodb_json.dumps(json_key))
        dynamo_response = self.client.get_item(
            TableName=self.table_name,
            Key=dynamodb_key,
        )
        json_response = dynamodb_json.loads(dynamo_response["Item"])
        return json_response

    def _query(
        self,
        key_condition_expression: str,
        filter_expression: Optional[str] = None,
        expression_names: Optional[dict] = None,
        expression_values: Optional[dict] = None,
        index_name: Optional[str] = None,
        limit: Optional[int] = None,
        page_response: bool = False,
        next_token: str = None,
    ) -> PagedResults:
        kwargs = {"TableName": self.table_name, "KeyConditionExpression": key_condition_expression}
        if filter_expression:
            kwargs["FilterExpression"] = filter_expression
        if expression_names:
            kwargs["ExpressionAttributeNames"] = expression_names
        if expression_values:
            kwargs["ExpressionAttributeValues"] = expression_values
        if limit:
            kwargs["Limit"] = limit
        if index_name:
            kwargs["IndexName"] = index_name
        if next_token:
            kwargs["ExclusiveStartKey"] = decode_pagination_token(next_token)

        dynamo_response = self.client.query(**kwargs)
        results = dynamodb_json.loads(dynamo_response["Items"])

        new_next_token = None
        if not page_response:
            while "LastEvaluatedKey" in dynamo_response:
                kwargs["ExclusiveStartKey"] = dynamo_response["LastEvaluatedKey"]
                dynamo_response = self.client.query(**kwargs)
                results.extend(dynamodb_json.loads(dynamo_response["Items"]))
        elif "LastEvaluatedKey" in dynamo_response:
            # Create encoded pagination token
            new_next_token = encode_pagination_token(dynamo_response["LastEvaluatedKey"])

        return PagedResults(results, new_next_token)

    def _scan(
        self,
        filter_expression: Optional[str] = None,
        expression_names: Optional[dict] = None,
        expression_values: Optional[dict] = None,
        limit: Optional[int] = None,
        page_response: bool = False,
        next_token: str = None,
    ) -> PagedResults:
        kwargs = {"TableName": self.table_name}
        if filter_expression:
            kwargs["FilterExpression"] = filter_expression
            # Expression names and values is only valid if filter expression is set
            if expression_names:
                kwargs["ExpressionAttributeNames"] = expression_names
            if expression_values:
                kwargs["ExpressionAttributeValues"] = expression_values
        if limit:
            kwargs["Limit"] = limit
        if next_token:
            kwargs["ExclusiveStartKey"] = decode_pagination_token(next_token)

        dynamo_response = self.client.scan(**kwargs)
        results = dynamodb_json.loads(dynamo_response["Items"])

        new_next_token = None
        if not page_response:
            while "LastEvaluatedKey" in dynamo_response:
                kwargs["ExclusiveStartKey"] = dynamo_response["LastEvaluatedKey"]
                dynamo_response = self.client.scan(**kwargs)
                results.extend(dynamodb_json.loads(dynamo_response["Items"]))
        elif "LastEvaluatedKey" in dynamo_response:
            # Create encoded pagination token
            new_next_token = encode_pagination_token(dynamo_response["LastEvaluatedKey"])

        return PagedResults(results, new_next_token)

    def _delete(self, json_key: dict):
        dynamodb_key = json.loads(dynamodb_json.dumps(json_key))
        self.client.delete_item(
            TableName=self.table_name,
            Key=dynamodb_key,
        )

    def _update(
        self,
        json_key: dict,
        update_expression: str,
        condition_expression: Optional[str] = None,
        expression_names: Optional[dict] = None,
        expression_values: Optional[dict] = None,
    ):
        dynamodb_key = json.loads(dynamodb_json.dumps(json_key))
        kwargs = {
            "TableName": self.table_name,
            "Key": dynamodb_key,
            "UpdateExpression": update_expression,
        }
        if condition_expression:
            kwargs["ConditionExpression"] = condition_expression
        if expression_names:
            kwargs["ExpressionAttributeNames"] = expression_names
        if expression_values:
            kwargs["ExpressionAttributeValues"] = expression_values
        self.client.update_item(**kwargs)
