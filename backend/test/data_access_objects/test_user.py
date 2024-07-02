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
import time
from unittest import TestCase, mock

import boto3
import moto
import pytest
from botocore.exceptions import ClientError
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.user import TIMEZONE_PREFERENCE_KEY, UserModel
from ml_space_lambda.enums import EnvVariable, Permission, TimezonePreference
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
TEST_USERS_TABLE_KEY_SCHEMA = [{"AttributeName": "username", "KeyType": "HASH"}]
TEST_USERS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "username", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestUserDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.user import UserDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars[EnvVariable.USERS_TABLE]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_USERS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_USERS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.user_dao = UserDAO(self.TEST_TABLE, self.ddb)
        # Seed 2 projects for testing update/delete
        self.UPDATE_USER = UserModel("12345", "jdoe@amazon.com", "John Doe", False)
        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_USER.to_dict())),
        )

        self.DELETE_USER = UserModel("98765", "tshelby@amazon.com", "Thomas Shelby", False, [Permission.ADMIN])

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_USER.to_dict())),
        )

        # Seed 10 more records for random testing mark a few suspended (0, 3, 6, 9)
        for i in range(10):
            record = UserModel(
                username=f"test.user-{i}@example.com",
                email=f"test.user-{i}@example.com",
                display_name=f"Test User{i}",
                suspended=(i % 3 == 0),
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
        self.user_dao = None

    def test_create_user(self):
        new_user = UserModel(
            "100",
            "ashelby@amazon.com",
            "Arthur Shelby",
            False,
            permissions=[Permission.ADMIN],
            preferences={TIMEZONE_PREFERENCE_KEY: TimezonePreference.LOCAL},
        )
        self.user_dao.create(new_user)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"username": {"S": new_user.username}},
        )
        assert dynamo_response["Item"]

        user_json = dynamodb_json.loads(dynamo_response["Item"])
        assert user_json["username"] == new_user.username
        assert user_json["email"] == new_user.email
        assert user_json["displayName"] == new_user.display_name
        assert user_json["suspended"] == new_user.suspended
        assert user_json["permissions"] == serialize_permissions(new_user.permissions)
        assert user_json["createdAt"] == user_json["lastLogin"]
        assert user_json["preferences"] == new_user.preferences

    def test_get_user(self):
        from_ddb = self.user_dao.get(self.UPDATE_USER.username)
        assert from_ddb
        assert from_ddb.username == self.UPDATE_USER.username
        assert from_ddb.email == self.UPDATE_USER.email
        assert from_ddb.display_name == self.UPDATE_USER.display_name
        assert from_ddb.permissions == self.UPDATE_USER.permissions
        assert from_ddb.suspended == self.UPDATE_USER.suspended
        assert from_ddb.last_login <= time.time()
        assert from_ddb.last_login >= self.UPDATE_USER.created_at

    def test_get_nonexistent_user(self):
        from_ddb = self.user_dao.get("1")
        assert not from_ddb

    def test_update_user(self):
        update_item_key = {
            "username": {"S": self.UPDATE_USER.username},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = UserModel.from_dict(self.UPDATE_USER.to_dict())
        updated.username = "99999"
        updated.email = "fake@amazon.com"
        updated.display_name = "Fake Name"
        updated.suspended = not self.UPDATE_USER.suspended
        # This is an unrealistic permissions value but we're just testing things
        updated.permissions = [Permission.ACTING_PMO, Permission.ADMIN, Permission.COLLABORATOR]
        updated.created_at = 12345
        # Set last login to 3 days ago
        updated.last_login = time.time() - 60 * 60 * 72
        self.user_dao.update(self.UPDATE_USER.username, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["username"] == post_update["username"]
        assert pre_update["email"] == post_update["email"]
        assert pre_update["displayName"] == post_update["displayName"]

        assert pre_update["lastLogin"] != post_update["lastLogin"]
        assert post_update["lastLogin"] == updated.last_login

        assert pre_update["suspended"] != post_update["suspended"]
        assert post_update["suspended"] == updated.suspended

        assert pre_update["permissions"] != post_update["permissions"]
        assert post_update["permissions"] == serialize_permissions(updated.permissions)

    def test_update_nonexistent_user(self):
        updated = UserModel.from_dict(self.UPDATE_USER.to_dict())
        updated.description = "This should be changed from the update."
        with pytest.raises(ClientError) as e_info:
            self.user_dao.update("1", updated)
        assert str(e_info.value) == (
            "An error occurred (ConditionalCheckFailedException) when "
            "calling the UpdateItem operation: The conditional request failed"
        )

    def test_delete_user(self):
        # Ensure the project exists in dynamo
        delete_item_key = {"username": {"S": self.DELETE_USER.username}}
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.user_dao.delete(self.DELETE_USER.username)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_delete_nonexistent_user(self):
        # We're just calling dynamo delete here which will just return
        # realistically we shouldn't ever invoke delete if the user
        # doesn't exist because the request should have been crafted from
        # a list of available users but either way deleting a non-existant
        # user should be the same as deleting one that does exist. No
        # errors.
        self.user_dao.delete("1")

    def test_get_all_with_suspended(self):
        all_users = self.user_dao.get_all(True)
        assert len(all_users) == 12

    def test_get_all_not_suspended(self):
        all_users = self.user_dao.get_all()
        assert len(all_users) == 8
