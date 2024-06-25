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

from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.enums import Permission
from ml_space_lambda.utils.common_functions import serialize_permissions

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
TEST_GROUP_USER_TABLE_KEY_SCHEMA = [
    {"AttributeName": "group", "KeyType": "HASH"},
    {"AttributeName": "user", "KeyType": "RANGE"},
]
TEST_GROUP_USER_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "group", "AttributeType": "S"},
    {"AttributeName": "user", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

MOCK_GROUP_NAME = "fake-group"


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestGroupUserDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.group_user import GroupUserDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars["GROUP_USERS_TABLE"]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_GROUP_USER_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_GROUP_USER_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "ReverseLookup",
                    "KeySchema": [
                        {"AttributeName": "user", "KeyType": "HASH"},
                        {"AttributeName": "group", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "KEYS_ONLY"},
                }
            ],
        )
        self.group_user_dao = GroupUserDAO(self.TEST_TABLE, self.ddb)
        # Seed 2 records for testing update/delete
        self.UPDATE_RECORD = GroupUserModel(
            username="jdoe@example.com",
            group_name=MOCK_GROUP_NAME,
            permissions=[Permission.COLLABORATOR],
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_RECORD.to_dict())),
        )

        self.DELETE_RECORD = GroupUserModel(
            username="matt@example.com",
            group_name=MOCK_GROUP_NAME,
            role="fakeRoleName",
            permissions=[Permission.COLLABORATOR],
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_RECORD.to_dict())),
        )

        # Seed 10 more records for random testing split between two groups
        for i in range(10):
            record = GroupUserModel(
                username=f"test.user-{i}@example.com",
                group_name=MOCK_GROUP_NAME if i % 2 == 0 else "secondGroup",
                permissions=[Permission.COLLABORATOR],
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
        self.group_user_dao = None

    def test_get_group_user_success(self):
        from_ddb = self.group_user_dao.get(self.UPDATE_RECORD.group, self.UPDATE_RECORD.user)
        assert from_ddb.to_dict() == self.UPDATE_RECORD.to_dict()

    def test_get_group_user_not_found(self):
        assert not self.group_user_dao.get("sample-group", "sample-user")

    def test_add_group_user_success(self):
        new_record = GroupUserModel(
            "add-unit-test@example.com",
            MOCK_GROUP_NAME,
            "newRoleName",
            [Permission.COLLABORATOR, Permission.GROUP_OWNER],
        )
        self.group_user_dao.create(new_record)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"group": {"S": MOCK_GROUP_NAME}, "user": {"S": new_record.user}},
        )
        assert dynamo_response["Item"]

        group_user_json = dynamodb_json.loads(dynamo_response["Item"])
        assert group_user_json == new_record.to_dict()

    def test_group_user_update_permissions(self):
        update_item_key = {
            "group": {"S": self.UPDATE_RECORD.group},
            "user": {"S": self.UPDATE_RECORD.user},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = GroupUserModel.from_dict(self.UPDATE_RECORD.to_dict())
        updated.user = "username-that-will-get-dropped"
        updated.group = "group-name-that-will-get-dropped"
        updated.permissions = [Permission.COLLABORATOR, Permission.GROUP_OWNER]
        self.group_user_dao.update(self.UPDATE_RECORD.group, self.UPDATE_RECORD.user, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["user"] == post_update["user"]
        assert pre_update["group"] == post_update["group"]
        assert pre_update["role"] == post_update["role"]

        assert pre_update["permissions"] != post_update["permissions"]
        assert post_update["permissions"] == serialize_permissions(updated.permissions)

    def test_group_user_update_role(self):
        update_item_key = {
            "group": {"S": self.UPDATE_RECORD.group},
            "user": {"S": self.UPDATE_RECORD.user},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = GroupUserModel.from_dict(self.UPDATE_RECORD.to_dict())
        updated.role = "newFancyRole"
        self.group_user_dao.update(self.UPDATE_RECORD.group, self.UPDATE_RECORD.user, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["user"] == post_update["user"]
        assert pre_update["group"] == post_update["group"]
        assert pre_update["permissions"] == post_update["permissions"]

        assert pre_update["role"] != post_update["role"]
        assert post_update["role"] == updated.role

    def test_group_user_delete(self):
        # Ensure the group exists in dynamo
        delete_item_key = {
            "group": {"S": self.DELETE_RECORD.group},
            "user": {"S": self.DELETE_RECORD.user},
        }
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.group_user_dao.delete(self.DELETE_RECORD.group, self.DELETE_RECORD.user)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_get_users_for_group(self):
        all_group_users = self.group_user_dao.get_users_for_group(MOCK_GROUP_NAME)
        assert len(all_group_users) == 7
        for record in all_group_users:
            assert record.group == MOCK_GROUP_NAME

    def test_get_users_for_group_nonexistant(self):
        all_group_users = self.group_user_dao.get_users_for_group("MadeUpGroupName")
        assert len(all_group_users) == 0

    def test_get_groups_for_user(self):
        all_group_users = self.group_user_dao.get_groups_for_user("jdoe@example.com")
        assert len(all_group_users) == 1
        for record in all_group_users:
            assert record.user == "jdoe@example.com"

    def test_get_groups_for_user_nonexistant(self):
        all_group_users = self.group_user_dao.get_groups_for_user("non-existant-user")
        assert len(all_group_users) == 0
