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

from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.enums import EnvVariable, Permission
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
TEST_PROJECT_USER_TABLE_KEY_SCHEMA = [
    {"AttributeName": "project", "KeyType": "HASH"},
    {"AttributeName": "user", "KeyType": "RANGE"},
]
TEST_PROJECT_USER_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "project", "AttributeType": "S"},
    {"AttributeName": "user", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

MOCK_PROJECT_NAME = "fake-project"
MOCK_SECOND_PROJECT_NAME = "secondProject"


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestProjectUserDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars[EnvVariable.PROJECT_USERS_TABLE]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_PROJECT_USER_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_PROJECT_USER_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "ReverseLookup",
                    "KeySchema": [
                        {"AttributeName": "user", "KeyType": "HASH"},
                        {"AttributeName": "project", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "KEYS_ONLY"},
                }
            ],
        )
        self.project_user_dao = ProjectUserDAO(self.TEST_TABLE, self.ddb)
        # Seed 2 records for testing update/delete
        self.UPDATE_RECORD = ProjectUserModel(
            username="jdoe@example.com",
            project_name=MOCK_PROJECT_NAME,
            permissions=[],
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_RECORD.to_dict())),
        )

        self.DELETE_RECORD = ProjectUserModel(
            username="matt@example.com",
            project_name=MOCK_PROJECT_NAME,
            role="fakeRoleName",
            permissions=[],
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_RECORD.to_dict())),
        )

        # Seed 10 more records for random testing split between two projects
        for i in range(10):
            record = ProjectUserModel(
                username=f"test.user-{i}@example.com",
                project_name=MOCK_PROJECT_NAME if i % 2 == 0 else MOCK_SECOND_PROJECT_NAME,
                permissions=[],
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
        self.project_user_dao = None

    def test_get_project_user_success(self):
        from_ddb = self.project_user_dao.get(self.UPDATE_RECORD.project, self.UPDATE_RECORD.user)
        assert from_ddb.to_dict() == self.UPDATE_RECORD.to_dict()

    def test_get_project_user_not_found(self):
        assert not self.project_user_dao.get("sample-project", "sample-user")

    def test_add_project_user_success(self):
        new_record = ProjectUserModel(
            "add-unit-test@example.com",
            MOCK_PROJECT_NAME,
            "newRoleName",
            [Permission.PROJECT_OWNER],
        )
        self.project_user_dao.create(new_record)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"project": {"S": MOCK_PROJECT_NAME}, "user": {"S": new_record.user}},
        )
        assert dynamo_response["Item"]

        project_user_json = dynamodb_json.loads(dynamo_response["Item"])
        assert project_user_json == new_record.to_dict()

    def test_project_user_update_permissions(self):
        update_item_key = {
            "project": {"S": self.UPDATE_RECORD.project},
            "user": {"S": self.UPDATE_RECORD.user},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = ProjectUserModel.from_dict(self.UPDATE_RECORD.to_dict())
        updated.user = "username-that-will-get-dropped"
        updated.project = "project-name-that-will-get-dropped"
        updated.permissions = [Permission.PROJECT_OWNER]
        self.project_user_dao.update(self.UPDATE_RECORD.project, self.UPDATE_RECORD.user, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["user"] == post_update["user"]
        assert pre_update["project"] == post_update["project"]
        assert pre_update["role"] == post_update["role"]

        assert pre_update["permissions"] != post_update["permissions"]
        assert post_update["permissions"] == serialize_permissions(updated.permissions)

    def test_project_user_update_role(self):
        update_item_key = {
            "project": {"S": self.UPDATE_RECORD.project},
            "user": {"S": self.UPDATE_RECORD.user},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = ProjectUserModel.from_dict(self.UPDATE_RECORD.to_dict())
        updated.role = "newFancyRole"
        self.project_user_dao.update(self.UPDATE_RECORD.project, self.UPDATE_RECORD.user, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["user"] == post_update["user"]
        assert pre_update["project"] == post_update["project"]
        assert pre_update["permissions"] == post_update["permissions"]

        assert pre_update["role"] != post_update["role"]
        assert post_update["role"] == updated.role

    def test_project_user_delete(self):
        # Ensure the project exists in dynamo
        delete_item_key = {
            "project": {"S": self.DELETE_RECORD.project},
            "user": {"S": self.DELETE_RECORD.user},
        }
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.project_user_dao.delete(self.DELETE_RECORD.project, self.DELETE_RECORD.user)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_get_users_for_project(self):
        all_project_users = self.project_user_dao.get_users_for_project(MOCK_PROJECT_NAME)
        assert len(all_project_users) == 7
        for record in all_project_users:
            assert record.project == MOCK_PROJECT_NAME

    def test_get_users_for_project_nonexistant(self):
        all_project_users = self.project_user_dao.get_users_for_project("MadeUpProjectName")
        assert len(all_project_users) == 0

    def test_get_projects_for_user(self):
        all_project_users = self.project_user_dao.get_projects_for_user("jdoe@example.com")
        assert len(all_project_users) == 1
        for record in all_project_users:
            assert record.user == "jdoe@example.com"

    def test_get_projects_for_user_nonexistant(self):
        all_project_users = self.project_user_dao.get_projects_for_user("non-existant-user")
        assert len(all_project_users) == 0

    def test_get_all_project_users(self):
        third_project = "thirdProject"
        new_record = ProjectUserModel(
            username=f"madeup.user@example.com",
            project_name=third_project,
            permissions=[],
        )
        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(new_record.to_dict())),
        )
        all_users = self.project_user_dao.get_all()
        found_project = False
        found_second_project = False
        found_third_project = False
        for user in all_users:
            if user.project == MOCK_PROJECT_NAME:
                found_project = True
            elif user.project == MOCK_SECOND_PROJECT_NAME:
                found_second_project = True
            elif user.project == third_project:
                found_third_project = True
        assert found_project and found_second_project and found_third_project
