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
from botocore.exceptions import ClientError
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.group import GroupModel

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
TEST_GROUPS_TABLE_KEY_SCHEMA = [{"AttributeName": "name", "KeyType": "HASH"}]
TEST_GROUPS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "name", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestGroupDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.group import GroupDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars["GROUPS_TABLE"]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_GROUPS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_GROUPS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.group_dao = GroupDAO(self.TEST_TABLE, self.ddb)
        # Seed 2 groups for testing update/delete
        self.UPDATE_GROUP = GroupModel(
            "fun-group",
            "Group for testing group updates.",
            "testUser2@amazon.com",
        )
        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_GROUP.to_dict())),
        )

        self.DELETE_GROUP = GroupModel(
            "bad-group",
            "Group for testing deleting groups.",
            "testUser3@amazon.com",
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_GROUP.to_dict())),
        )

    def tearDown(self):
        """
        Delete virtual DDB resources/tables
        """
        self.ddb.delete_table(TableName=self.TEST_TABLE)
        self.ddb = None
        self.group_dao = None

    def test_create_group(self):
        new_group = GroupModel(
            "FancyTestGroup",
            "Fancy test group for unit test.",
            "testUser@amazon.com",
        )
        self.group_dao.create(new_group)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"name": {"S": new_group.name}},
        )
        assert dynamo_response["Item"]

        group_json = dynamodb_json.loads(dynamo_response["Item"])
        assert group_json["name"] == new_group.name
        assert group_json["description"] == new_group.description
        assert group_json["createdBy"] == new_group.created_by
        assert group_json["createdAt"] == group_json["lastUpdatedAt"]

    def test_get_group(self):
        from_ddb = self.group_dao.get(self.UPDATE_GROUP.name)
        assert from_ddb
        assert from_ddb.name == self.UPDATE_GROUP.name
        assert from_ddb.description == self.UPDATE_GROUP.description
        assert from_ddb.created_by == self.UPDATE_GROUP.created_by

    def test_get_nonexistent_group(self):
        from_ddb = self.group_dao.get("InvalidGroupName")
        assert not from_ddb

    def test_get_all_groups(self):
        all_groups = self.group_dao.get_all()
        assert len(all_groups) == 2

    def test_get_all_groups_filtered(self):
        all_groups = self.group_dao.get_all(group_names=[self.UPDATE_GROUP.name])
        assert len(all_groups) == 1

    def test_get_all_groups_filtered_empty_filter(self):
        all_groups = self.group_dao.get_all(group_names=[])
        assert len(all_groups) == 0

    def test_get_all_groups_filtered_no_match(self):
        all_groups = self.group_dao.get_all(group_names=["Fake-Group-1", "Fake-Group-2"])
        assert len(all_groups) == 0

    def test_update_group(self):
        update_item_key = {
            "name": {"S": self.UPDATE_GROUP.name},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = GroupModel.from_dict(self.UPDATE_GROUP.to_dict())
        updated.name = "ThisShouldGetDropped"
        updated.description = "This should be changed from the update."
        updated.created_at = 12345
        updated.created_by = "dontchangeme@amazon.com"
        updated.last_updated_at = 54321

        self.group_dao.update(self.UPDATE_GROUP.name, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["name"] == post_update["name"]
        assert pre_update["createdBy"] == post_update["createdBy"]
        assert pre_update["createdAt"] == post_update["createdAt"]
        assert pre_update["lastUpdatedAt"] <= post_update["lastUpdatedAt"]

        assert pre_update["description"] != post_update["description"]
        assert post_update["description"] == updated.description

    def test_update_nonexistent_group(self):
        updated = GroupModel.from_dict(self.UPDATE_GROUP.to_dict())
        updated.description = "This should be changed from the update."
        with pytest.raises(ClientError) as e_info:
            self.group_dao.update("InvalidGroup", updated)
        assert str(e_info.value) == (
            "An error occurred (ConditionalCheckFailedException) when "
            "calling the UpdateItem operation: The conditional request failed"
        )

    def test_delete_group(self):
        # Ensure the group exists in dynamo
        delete_item_key = {"name": {"S": self.DELETE_GROUP.name}}
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.group_dao.delete(self.DELETE_GROUP.name)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_delete_nonexistent_group(self):
        # We're just calling dynamo delete here which will just return
        # realistically we shouldn't ever invoke delete if the group
        # doesn't exist because we'll have previously validated the user
        # has access to delete it but either way deleting a non-existant
        # group should be the same as deleting one that does exist. No
        # errors.
        self.group_dao.delete("InvalidGroup")
