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

import json
from unittest import TestCase, mock

import boto3
import moto
import pytest
from botocore.exceptions import ParamValidationError
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore

TEST_ENV_CONFIG = {
    # Moto doesn't work with iso regions...
    "AWS_DEFAULT_REGION": "us-east-1",
    # Fake cred info for MOTO
    "AWS_ACCESS_KEY_ID": "testing",
    "AWS_SECRET_ACCESS_KEY": "testing",
    "AWS_SECURITY_TOKEN": "testing",
    "AWS_SESSION_TOKEN": "testing",
}

TEST_TABLE_NAME = "unit-test"
TEST_TABLE_KEY_SCHEMA = [
    {"AttributeName": "type", "KeyType": "HASH"},
    {"AttributeName": "id", "KeyType": "RANGE"},
]
TEST_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "type", "AttributeType": "S"},
    {"AttributeName": "id", "AttributeType": "S"},
]

NONEXISTENT_KEY = {"id": {"S": "12345"}, "type": {"S": "odd"}}

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)


def default_message(id: str) -> str:
    return f"This is a message for entry number: {id}"


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestDynamoDataStore(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.utils.common_functions import retry_config

        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=TEST_TABLE_NAME,
            KeySchema=TEST_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )

        for i in range(100):
            self.ddb.put_item(
                TableName=TEST_TABLE_NAME,
                Item=json.loads(
                    dynamodb_json.dumps(
                        {
                            "id": f"{i}",
                            "msg": default_message(str(i)),
                            "type": "even" if i % 2 == 0 else "odd",
                        }
                    )
                ),
            )

    def tearDown(self):
        """
        Delete virtual DDB resources/tables
        """
        self.ddb.delete_table(TableName=TEST_TABLE_NAME)
        self.ddb = None

    def test_dyanmodb_create(self):
        pre_create = self.ddb.get_item(
            TableName=TEST_TABLE_NAME,
            Key=NONEXISTENT_KEY,
        )
        assert "Item" not in pre_create

        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        test_client._create({"id": "12345", "type": "odd"})

        post_create = self.ddb.get_item(
            TableName=TEST_TABLE_NAME,
            Key=NONEXISTENT_KEY,
        )
        assert post_create["Item"]

    def test_dynamodb_retrieve(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        dynamo_response = test_client._retrieve({"id": "13", "type": "odd"})
        assert dynamo_response
        assert dynamo_response["type"] == "odd"
        assert dynamo_response["id"] == "13"
        assert dynamo_response["msg"] == default_message("13")

    def test_dynamodb_retrieve_nonexistent(self):
        pre_existing = self.ddb.get_item(
            TableName=TEST_TABLE_NAME,
            Key=NONEXISTENT_KEY,
        )
        assert "Item" not in pre_existing
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        with pytest.raises(KeyError):
            test_client._retrieve({"id": "12345", "type": "odd"})

    def test_dynamodb_delete_success(self):
        to_delete_key = {"id": {"S": "99"}, "type": {"S": "odd"}}
        pre_delete = self.ddb.get_item(TableName=TEST_TABLE_NAME, Key=to_delete_key)
        assert pre_delete["Item"]

        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        test_client._delete({"id": "99", "type": "odd"})
        post_delete = self.ddb.get_item(
            TableName=TEST_TABLE_NAME,
            Key=to_delete_key,
        )
        assert "Item" not in post_delete

    def test_dynamodb_conditional_update(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        test_client._update(
            json_key={"id": "21", "type": "odd"},
            update_expression="SET #value = :val, #otherValue = :other",
            condition_expression="attribute_not_exists(modified)",
            expression_names={"#value": "msg", "#otherValue": "modified"},
            expression_values=json.loads(dynamodb_json.dumps({":val": "Updated Message!", ":other": True})),
        )

        post_update = dynamodb_json.loads(
            self.ddb.get_item(
                TableName=TEST_TABLE_NAME,
                Key={"id": {"S": "21"}, "type": {"S": "odd"}},
            )["Item"]
        )
        assert post_update == {
            "id": "21",
            "type": "odd",
            "msg": "Updated Message!",
            "modified": True,
        }

    def test_dynamodb_update_expression_names_and_values(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        test_client._update(
            json_key={"id": "22", "type": "even"},
            update_expression="SET #value = :val, #otherValue = :other",
            expression_names={"#value": "msg", "#otherValue": "modified"},
            expression_values=json.loads(dynamodb_json.dumps({":val": "Updated Message!", ":other": False})),
        )

        post_update = dynamodb_json.loads(
            self.ddb.get_item(
                TableName=TEST_TABLE_NAME,
                Key={"id": {"S": "22"}, "type": {"S": "even"}},
            )["Item"]
        )
        assert post_update == {
            "id": "22",
            "type": "even",
            "msg": "Updated Message!",
            "modified": False,
        }

    def test_dynamodb_update_expression(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        test_client._update(
            json_key={"id": "23", "type": "odd"},
            update_expression="SET msgClone = msg",
        )

        post_update = dynamodb_json.loads(
            self.ddb.get_item(
                TableName=TEST_TABLE_NAME,
                Key={"id": {"S": "23"}, "type": {"S": "odd"}},
            )["Item"]
        )
        assert post_update == {
            "id": "23",
            "type": "odd",
            "msg": default_message("23"),
            "msgClone": default_message("23"),
        }

    def test_dynamodb_update_exception(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        with pytest.raises(ParamValidationError):
            test_client._update(
                json_key={"key": "stringValue"},
                update_expression="SET #value = :val",
                expression_names={"#value": "paramOne"},
                # Expression values is invalid here
                expression_values={":val": "valueOne"},
            )

    def test_dynamodb_query(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        results = test_client._query(
            key_condition_expression="#t = :type",
            expression_names={"#t": "type"},
            expression_values=json.loads(dynamodb_json.dumps({":type": "even"})),
        )
        assert len(results.records) == 50
        assert not results.next_token

    def test_dynamodb_query_with_filter(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        results = test_client._query(
            key_condition_expression="#t = :type",
            filter_expression="begins_with (#i, :val)",
            expression_names={"#t": "type", "#i": "id"},
            expression_values=json.loads(dynamodb_json.dumps({":type": "even", ":val": "1"})),
        )
        assert len(results.records) == 5
        assert not results.next_token

    def test_dynamodb_query_fetch_all_multiple_pages(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        results = test_client._query(
            key_condition_expression="#t = :type",
            expression_names={"#t": "type"},
            expression_values=json.loads(dynamodb_json.dumps({":type": "odd"})),
            limit=10,
        )
        assert len(results.records) == 50
        assert not results.next_token

    def test_dynamodb_query_paged_response(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        results = test_client._query(
            key_condition_expression="#t = :type",
            expression_names={"#t": "type"},
            expression_values=json.loads(dynamodb_json.dumps({":type": "odd"})),
            limit=10,
            page_response=True,
        )
        assert len(results.records) == 10
        assert results.next_token is not None

        second_page = test_client._query(
            key_condition_expression="#t = :type",
            expression_names={"#t": "type"},
            expression_values=json.loads(dynamodb_json.dumps({":type": "odd"})),
            limit=10,
            page_response=True,
            next_token=results.next_token,
        )
        assert len(second_page.records) == 10
        assert second_page.next_token is not None

        # Ensure the pages are different
        initial_page_ids = [record["id"] for record in results.records]
        second_page_ids = [record["id"] for record in second_page.records]
        unique_ids = set().union(initial_page_ids, second_page_ids)
        assert len(unique_ids) == 20

    def test_dynamodb_query_exception(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        with pytest.raises(ParamValidationError):
            test_client._query(key_condition_expression="#t = :type", limit=-10)

    def test_dynamodb_scan(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        results = test_client._scan(filter_expression="")
        assert len(results.records) == 100
        assert not results.next_token

    def test_dynamodb_scan_fetch_all_multiple_pages(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        results = test_client._scan(limit=10)
        assert len(results.records) == 100
        assert not results.next_token

    def test_dynamodb_scan_paged_response(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        results = test_client._scan(limit=10, page_response=True)
        assert len(results.records) == 10
        assert results.next_token

        second_page = test_client._scan(limit=10, page_response=True, next_token=results.next_token)
        assert len(second_page.records) == 10
        assert second_page.next_token

        # Ensure the pages are different
        initial_page_ids = [record["id"] for record in results.records]
        second_page_ids = [record["id"] for record in second_page.records]
        unique_ids = set().union(initial_page_ids, second_page_ids)
        assert len(unique_ids) == 20

    def test_dynamodb_scan_with_filter(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        results = test_client._scan(
            filter_expression="#t = :type",
            expression_names={"#t": "type"},
            expression_values=json.loads(dynamodb_json.dumps({":type": "even"})),
        )
        assert len(results.records) == 50
        assert not results.next_token

    def test_dynamodb_scan_exception(self):
        test_client = DynamoDBObjectStore(TEST_TABLE_NAME, self.ddb)
        with pytest.raises(ParamValidationError):
            test_client._scan(limit=-10)
