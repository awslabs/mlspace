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

from ml_space_lambda.data_access_objects.project_group import ProjectGroupModel
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
TEST_PROJECT_GROUP_TABLE_KEY_SCHEMA = [
    {"AttributeName": "project", "KeyType": "HASH"},
    {"AttributeName": "group", "KeyType": "RANGE"},
]
TEST_PROJECT_GROUP_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "project", "AttributeType": "S"},
    {"AttributeName": "group", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

MOCK_PROJECT_NAME = "fake-project"


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestProjectUserDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.project_group import ProjectGroupDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars[EnvVariable.PROJECT_GROUPS_TABLE]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_PROJECT_GROUP_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_PROJECT_GROUP_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "ReverseLookup",
                    "KeySchema": [
                        {"AttributeName": "group", "KeyType": "HASH"},
                        {"AttributeName": "project", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "KEYS_ONLY"},
                }
            ],
        )
        self.project_group_dao = ProjectGroupDAO(self.TEST_TABLE, self.ddb)
        # Seed 2 records for testing update/delete
        self.UPDATE_RECORD = ProjectGroupModel(
            group_name="my_group_1",
            project_name=MOCK_PROJECT_NAME,
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_RECORD.to_dict())),
        )

        self.DELETE_RECORD = ProjectGroupModel(
            group_name="my_group_2",
            project_name=MOCK_PROJECT_NAME,
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_RECORD.to_dict())),
        )

        # Seed 10 more records for random testing split between two projects
        for i in range(10):
            record = ProjectGroupModel(
                group_name=f"my_group_1_{i}",
                project_name=MOCK_PROJECT_NAME if i % 2 == 0 else "secondProject",
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
        self.project_group_dao = None

    def test_get_project_group_success(self):
        from_ddb = self.project_group_dao.get(self.UPDATE_RECORD.project, self.UPDATE_RECORD.group_name)
        assert from_ddb.to_dict() == self.UPDATE_RECORD.to_dict()

    def test_get_project_group_not_found(self):
        assert not self.project_group_dao.get("sample-project", "sample-group")

    def test_add_project_group_success(self):
        new_record = ProjectGroupModel(
            "group_10",
            MOCK_PROJECT_NAME,
            [Permission.PROJECT_OWNER],
        )
        self.project_group_dao.create(new_record)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"project": {"S": MOCK_PROJECT_NAME}, "group": {"S": new_record.group_name}},
        )
        assert dynamo_response["Item"]

        project_group_json = dynamodb_json.loads(dynamo_response["Item"])
        assert project_group_json == new_record.to_dict()

    def test_project_group_update_permissions(self):
        update_item_key = {
            "project": {"S": self.UPDATE_RECORD.project},
            "group": {"S": self.UPDATE_RECORD.group_name},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = ProjectGroupModel.from_dict(self.UPDATE_RECORD.to_dict())
        updated.group_name = "group-that-will-get-dropped"
        updated.project = "project-name-that-will-get-dropped"
        updated.permissions = [Permission.PROJECT_OWNER]
        self.project_group_dao.update(self.UPDATE_RECORD.project, self.UPDATE_RECORD.group_name, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["group"] == post_update["group"]
        assert pre_update["project"] == post_update["project"]

        assert pre_update["permissions"] != post_update["permissions"]
        assert post_update["permissions"] == serialize_permissions(updated.permissions)

    def test_project_group_update_role(self):
        update_item_key = {
            "project": {"S": self.UPDATE_RECORD.project},
            "group": {"S": self.UPDATE_RECORD.group_name},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = ProjectGroupModel.from_dict(self.UPDATE_RECORD.to_dict())
        updated.role = "newFancyRole"
        self.project_group_dao.update(self.UPDATE_RECORD.project, self.UPDATE_RECORD.group_name, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["group"] == post_update["group"]
        assert pre_update["project"] == post_update["project"]
        assert pre_update["permissions"] == post_update["permissions"]

    def test_project_group_delete(self):
        # Ensure the project exists in dynamo
        delete_item_key = {
            "project": {"S": self.DELETE_RECORD.project},
            "group": {"S": self.DELETE_RECORD.group_name},
        }
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.project_group_dao.delete(self.DELETE_RECORD.project, self.DELETE_RECORD.group_name)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_get_groups_for_project(self):
        all_project_groups = self.project_group_dao.get_groups_for_project(MOCK_PROJECT_NAME)
        assert len(all_project_groups) == 7
        for record in all_project_groups:
            assert record.project == MOCK_PROJECT_NAME

    def test_get_groups_for_project_nonexistant(self):
        all_project_groups = self.project_group_dao.get_groups_for_project("MadeUpProjectName")
        assert len(all_project_groups) == 0

    def test_get_projects_for_group(self):
        all_project_groups = self.project_group_dao.get_projects_for_group("my_group_1")
        assert len(all_project_groups) == 1
        for record in all_project_groups:
            assert record.group_name == "my_group_1"

    def test_get_projects_for_group_nonexistant(self):
        all_project_groups = self.project_group_dao.get_projects_for_group("non-existant-group")
        assert len(all_project_groups) == 0
