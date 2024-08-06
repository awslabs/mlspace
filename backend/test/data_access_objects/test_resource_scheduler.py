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

from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerModel
from ml_space_lambda.enums import EnvVariable, ResourceType

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
TEST_RESOURCE_SCHEDULER_TABLE_KEY_SCHEMA = [
    {"AttributeName": "resourceId", "KeyType": "HASH"},
    {"AttributeName": "resourceType", "KeyType": "RANGE"},
]
TEST_RESOURCE_SCHEDULER_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "resourceId", "AttributeType": "S"},
    {"AttributeName": "resourceType", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

MOCK_PROJECT_NAME = "fake-project"
MOCK_TERMINATION_TIME = 999999999


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestDatasetDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars[EnvVariable.RESOURCE_SCHEDULE_TABLE]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_RESOURCE_SCHEDULER_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_RESOURCE_SCHEDULER_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.resource_scheduler_dao = ResourceSchedulerDAO(self.TEST_TABLE, self.ddb)
        # create one record to update, and another to delete
        self.UPDATE_RECORD = ResourceSchedulerModel(
            resource_id="resourceIdUpdate",
            resource_type=ResourceType.NOTEBOOK,
            termination_time=MOCK_TERMINATION_TIME,
            project=MOCK_PROJECT_NAME,
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_RECORD.to_dict())),
        )

        self.DELETE_RECORD = ResourceSchedulerModel(
            resource_id="resourceIdDelete",
            resource_type=ResourceType.NOTEBOOK,
            termination_time=MOCK_TERMINATION_TIME,
            project=MOCK_PROJECT_NAME,
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_RECORD.to_dict())),
        )

        # Seed 10 more records for random testing split between ten projects
        for i in range(10):
            record = ResourceSchedulerModel(
                resource_id=f"resource-id-{i}",
                resource_type=ResourceType.NOTEBOOK,
                termination_time=i,
                project=f"Project{i}",
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
        self.resource_scheduler_dao = None

    def test_get_all_project_resources(self):
        # Test with a non-existent project
        fake_project_resources = self.resource_scheduler_dao.get_all_project_resources("totally-fake-project")
        assert len(fake_project_resources) == 0

        # Test with seeded project
        project_resources = self.resource_scheduler_dao.get_all_project_resources("Project6")
        assert len(project_resources) == 1

    def test_get_resource_scheduler_success(self):
        from_ddb = self.resource_scheduler_dao.get(
            resource_id=self.UPDATE_RECORD.resource_id,
            resource_type=self.UPDATE_RECORD.resource_type,
        )
        assert from_ddb.to_dict() == self.UPDATE_RECORD.to_dict()

    def test_get_resource_scheduler_not_found(self):
        assert not self.resource_scheduler_dao.get(resource_id="non-existant-resource-id", resource_type="non-existant-type")

    def test_add_resource_scheduler_success(self):
        new_record = ResourceSchedulerModel(
            resource_id="resource-id",
            resource_type=ResourceType.NOTEBOOK,
            termination_time=MOCK_TERMINATION_TIME,
            project=MOCK_PROJECT_NAME,
        )
        self.resource_scheduler_dao.create(resource_scheduler=new_record)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={
                "resourceId": {"S": new_record.resource_id},
                "resourceType": {"S": new_record.resource_type},
            },
        )
        assert dynamo_response["Item"]

        resource_scheduler_json = dynamodb_json.loads(dynamo_response["Item"])
        assert resource_scheduler_json == new_record.to_dict()

    def test_resource_scheduler_update_termination_time(self):
        update_item_key = {
            "resourceId": {"S": self.UPDATE_RECORD.resource_id},
            "resourceType": {"S": self.UPDATE_RECORD.resource_type},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        new_termination_time = 9876543211
        self.resource_scheduler_dao.update_termination_time(
            resource_id=self.UPDATE_RECORD.resource_id,
            resource_type=self.UPDATE_RECORD.resource_type,
            new_termination_time=new_termination_time,
            project="SHOULD_NOT_CHANGE",
        )

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["resourceId"] == post_update["resourceId"]
        assert pre_update["resourceType"] == post_update["resourceType"]
        assert pre_update["terminationTime"] != post_update["terminationTime"]
        assert post_update["terminationTime"] == new_termination_time
        # Update should only set the project if it wasn't previously set
        assert pre_update["project"] == post_update["project"]

    # Test a scenario where a resource has had auto termination disabled and then termination is
    # reneabled via a call to the set_termination_time lambda
    def test_resource_scheduler_update_termination_time_upsert(self):
        resource_termination_time = 9876543211
        resource_id = "upsert-test-id"
        resource_type = ResourceType.ENDPOINT
        resource_project = "UPSERT_TEST_PROJECT"

        upsert_item_key = {
            "resourceId": {"S": resource_id},
            "resourceType": {"S": resource_type},
        }

        existing_item = self.ddb.get_item(TableName=self.TEST_TABLE, Key=upsert_item_key)
        assert "Item" not in existing_item

        self.resource_scheduler_dao.update_termination_time(
            resource_id=resource_id,
            resource_type=resource_type,
            new_termination_time=resource_termination_time,
            project=resource_project,
        )

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=upsert_item_key)["Item"])

        assert resource_id == post_update["resourceId"]
        assert resource_type == post_update["resourceType"]
        assert resource_termination_time == post_update["terminationTime"]
        # Update should have set the project as this was an upsert
        assert "UPSERT_TEST_PROJECT" == post_update["project"]

    def test_resource_scheduler_delete(self):
        # Ensure the project exists in dynamo
        delete_item_key = {
            "resourceId": {"S": self.DELETE_RECORD.resource_id},
            "resourceType": {"S": self.DELETE_RECORD.resource_type},
        }
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.resource_scheduler_dao.delete(
            resource_id=self.DELETE_RECORD.resource_id,
            resource_type=self.DELETE_RECORD.resource_type,
        )

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_get_resources_past_termination_time(self):
        # retrieve the 10 seeded projects we added with single digit termination times
        expired_resources = self.resource_scheduler_dao.get_resources_past_termination_time(termination_time=10)

        assert len(expired_resources) == 10
