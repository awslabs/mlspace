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
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetModel
from ml_space_lambda.enums import EnvVariable

TEST_ENV_CONFIG = {
    # Moto doesn't work with iso regions...
    "AWS_DEFAULT_REGION": "us-east-1",
    # Fake cred info for MOTO
    "AWS_ACCESS_KEY_ID": "testing",
    "AWS_SECRET_ACCESS_KEY": "testing",
    "AWS_SECURITY_TOKEN": "testing",
    "AWS_SESSION_TOKEN": "testing",
}

# DDB Configurations
TEST_GROUP_DATASETS_TABLE_KEY_SCHEMA = [
    {"AttributeName": "group", "KeyType": "HASH"},
    {"AttributeName": "dataset", "KeyType": "RANGE"},
]
TEST_GROUP_DATASETS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "group", "AttributeType": "S"},
    {"AttributeName": "dataset", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

MOCK_GROUP_NAME = "fake-group"


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestGroupdatasetDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.group_dataset import GroupDatasetDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars[EnvVariable.GROUP_DATASETS_TABLE]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_GROUP_DATASETS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_GROUP_DATASETS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "ReverseLookup",
                    "KeySchema": [
                        {"AttributeName": "dataset", "KeyType": "HASH"},
                        {"AttributeName": "group", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "KEYS_ONLY"},
                }
            ],
        )
        self.group_dataset_dao = GroupDatasetDAO(self.TEST_TABLE, self.ddb)
        # Seed 2 records for testing update/delete
        self.UPDATE_RECORD = GroupDatasetModel(
            dataset_name="dataset001",
            group_name=MOCK_GROUP_NAME,
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_RECORD.to_dict())),
        )

        self.DELETE_RECORD = GroupDatasetModel(
            dataset_name="dataset999",
            group_name=MOCK_GROUP_NAME,
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_RECORD.to_dict())),
        )

        # Seed 10 more records for random testing split between two groups
        for i in range(10):
            record = GroupDatasetModel(
                dataset_name=f"dataset50{i}",
                group_name=MOCK_GROUP_NAME if i % 2 == 0 else "secondGroup",
            )
            self.ddb.put_item(
                TableName=self.TEST_TABLE,
                Item=json.loads(dynamodb_json.dumps(record.to_dict())),
            )

    def tearDown(self):
        """
        Delete virtual DDB resources/tables
        """
        self.ddb.delete_table(TableName=self.TEST_TABLE)
        self.ddb = None
        self.group_dataset_dao = None

    def test_get_group_dataset_success(self):
        from_ddb = self.group_dataset_dao.get(self.UPDATE_RECORD.group, self.UPDATE_RECORD.dataset)
        assert from_ddb.to_dict() == self.UPDATE_RECORD.to_dict()

    def test_get_group_dataset_not_found(self):
        assert not self.group_dataset_dao.get("sample-group", "sample-dataset")

    def test_add_group_dataset_success(self):
        new_record = GroupDatasetModel(
            "add-unit-test@example.com",
            MOCK_GROUP_NAME,
        )
        self.group_dataset_dao.create(new_record)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"group": {"S": MOCK_GROUP_NAME}, "dataset": {"S": new_record.dataset}},
        )
        assert dynamo_response["Item"]

        group_dataset_json = dynamodb_json.loads(dynamo_response["Item"])
        assert group_dataset_json == new_record.to_dict()

    def test_group_dataset_delete(self):
        # Ensure the group exists in dynamo
        delete_item_key = {
            "group": {"S": self.DELETE_RECORD.group},
            "dataset": {"S": self.DELETE_RECORD.dataset},
        }
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.group_dataset_dao.delete(self.DELETE_RECORD.group, self.DELETE_RECORD.dataset)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_get_datasets_for_group(self):
        all_group_datasets = self.group_dataset_dao.get_datasets_for_group(MOCK_GROUP_NAME)
        assert len(all_group_datasets) == 7
        for record in all_group_datasets:
            assert record.group == MOCK_GROUP_NAME

    def test_get_datasets_for_group_nonexistant(self):
        all_group_datasets = self.group_dataset_dao.get_datasets_for_group("MadeUpGroupName")
        assert len(all_group_datasets) == 0

    def test_get_groups_for_dataset(self):
        all_group_datasets = self.group_dataset_dao.get_groups_for_dataset("dataset001")
        assert len(all_group_datasets) == 1
        for record in all_group_datasets:
            assert record.dataset == "dataset001"

    def test_get_groups_for_dataset_nonexistant(self):
        all_group_datasets = self.group_dataset_dao.get_groups_for_dataset("non-existant-dataset")
        assert len(all_group_datasets) == 0
