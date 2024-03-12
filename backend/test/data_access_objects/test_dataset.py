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
from unittest import mock, TestCase

import boto3
import moto
import pytest
from botocore.exceptions import ClientError
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.enums import DatasetType

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
TEST_DATASETS_TABLE_KEY_SCHEMA = [
    {"AttributeName": "scope", "KeyType": "HASH"},
    {"AttributeName": "name", "KeyType": "RANGE"},
]
TEST_DATASETS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "scope", "AttributeType": "S"},
    {"AttributeName": "name", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

SAMPLE_DATASET_PROJECT = "fake-project"


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestDatasetDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.dataset import DatasetDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars["DATASETS_TABLE"]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_DATASETS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_DATASETS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.dataset_dao = DatasetDAO(self.TEST_TABLE, self.ddb)
        # Seed 2 datasets for testing update/delete
        self.UPDATE_DS = DatasetModel(
            SAMPLE_DATASET_PROJECT,
            "sample-dataset",
            "Dataset for testing update.",
            "json",
            "s3://mlspace-datasets-123456789/project/fake-project/sample-dataset",
            "testUser2@amazon.com",
        )
        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_DS.to_dict())),
        )

        self.DELETE_DS = DatasetModel(
            "testUser3@amazon.com",
            "bad-dataset",
            "Dataset for testing delete.",
            "png",
            "s3://mlspace-datasets-123456789/private/testUser3/bad-dataset",
            "testUser3@amazon.com",
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_DS.to_dict())),
        )

    def tearDown(self):
        """
        Delete virtual DDB resources/tables
        """
        self.ddb.delete_table(TableName=self.TEST_TABLE)
        self.ddb = None
        self.dataset_dao = None

    def test_create_dataset(self):
        new_ds = DatasetModel(
            DatasetType.GLOBAL.value,
            "test-dataset",
            "Dataset for unit test.",
            "text",
            "s3://mlspace-datasets-123456789/global/test-dataset",
            "testUser@amazon.com",
        )
        self.dataset_dao.create(new_ds)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"scope": {"S": DatasetType.GLOBAL.value}, "name": {"S": new_ds.name}},
        )
        assert dynamo_response["Item"]

        dataset_json = dynamodb_json.loads(dynamo_response["Item"])
        assert dataset_json["name"] == new_ds.name
        assert dataset_json["scope"] == new_ds.scope
        assert dataset_json["description"] == new_ds.description
        assert dataset_json["format"] == new_ds.format
        assert dataset_json["location"] == new_ds.location
        assert dataset_json["createdBy"] == new_ds.created_by
        assert dataset_json["createdAt"] == dataset_json["lastUpdatedAt"]

    def test_get_dataset(self):
        from_ddb = self.dataset_dao.get(self.UPDATE_DS.scope, self.UPDATE_DS.name)
        assert from_ddb
        assert from_ddb.name == self.UPDATE_DS.name
        assert from_ddb.scope == self.UPDATE_DS.scope
        assert from_ddb.description == self.UPDATE_DS.description
        assert from_ddb.format == self.UPDATE_DS.format
        assert from_ddb.location == self.UPDATE_DS.location
        assert from_ddb.type == DatasetType.PROJECT
        assert from_ddb.created_by == self.UPDATE_DS.created_by

    def test_get_nonexistent_dataset(self):
        from_ddb = self.dataset_dao.get("InvalidProject", self.UPDATE_DS.name)
        assert not from_ddb

    def test_update_dataset(self):
        update_item_key = {"scope": {"S": self.UPDATE_DS.scope}, "name": {"S": self.UPDATE_DS.name}}
        pre_update = dynamodb_json.loads(
            self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"]
        )

        updated = DatasetModel.from_dict(self.UPDATE_DS.to_dict())
        updated.name = "ThisShouldGetDropped"
        updated.description = "This should be changed from the update."
        updated.created_at = 12345
        updated.format = "zip"
        updated.location = "s3://should-be-ignored"
        updated.created_by = "dontchangeme@amazon.com"
        updated.last_updated_at = 54321
        updated.type = DatasetType.GLOBAL
        self.dataset_dao.update(self.UPDATE_DS.scope, self.UPDATE_DS.name, updated)

        post_update = dynamodb_json.loads(
            self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"]
        )

        assert pre_update["name"] == post_update["name"]
        assert pre_update["scope"] == post_update["scope"]
        assert pre_update["location"] == post_update["location"]
        assert pre_update["createdBy"] == post_update["createdBy"]
        assert pre_update["createdAt"] == post_update["createdAt"]
        assert pre_update["lastUpdatedAt"] <= post_update["lastUpdatedAt"]

        assert pre_update["description"] != post_update["description"]
        assert post_update["description"] == updated.description

        assert pre_update["format"] != post_update["format"]
        assert post_update["format"] == updated.format

    def test_update_nonexistent_dataset(self):
        updated = DatasetModel.from_dict(self.UPDATE_DS.to_dict())
        updated.description = "This should be changed from the update."
        with pytest.raises(ClientError) as e_info:
            self.dataset_dao.update("InvalidProject", self.UPDATE_DS.name, updated)
        assert str(e_info.value) == (
            "An error occurred (ConditionalCheckFailedException) when "
            "calling the UpdateItem operation: The conditional request failed"
        )

    def test_delete_dataset(self):
        # Ensure the dataset exists in dynamo
        delete_item_key = {"scope": {"S": self.DELETE_DS.scope}, "name": {"S": self.DELETE_DS.name}}
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.dataset_dao.delete(self.DELETE_DS.scope, self.DELETE_DS.name)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_delete_nonexistent_dataset(self):
        # We're just calling dynamo delete here which will just return
        # realistically we shouldn't ever invoke delete if the dataset
        # doesn't exist because we'll have previously validated the user
        # has access to delete it but either way deleting a non-existant
        # dataset should be the same as deleting one that does exist. No
        # errors.
        self.dataset_dao.delete("InvalidProject", self.UPDATE_DS.name)

    def test_get_all_for_scope(self):
        matching_datasets = self.dataset_dao.get_all_for_scope(
            DatasetType.PROJECT, SAMPLE_DATASET_PROJECT
        )
        assert len(matching_datasets) == 1
        assert matching_datasets[0].to_dict() == self.UPDATE_DS.to_dict()

    def test_get_all_for_scope_no_hits(self):
        matching_datasets = self.dataset_dao.get_all_for_scope(
            DatasetType.PRIVATE, SAMPLE_DATASET_PROJECT
        )
        assert len(matching_datasets) == 0
