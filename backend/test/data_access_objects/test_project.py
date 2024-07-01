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

from ml_space_lambda.data_access_objects.project import ProjectModel
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
TEST_PROJECTS_TABLE_KEY_SCHEMA = [{"AttributeName": "name", "KeyType": "HASH"}]
TEST_PROJECTS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "name", "AttributeType": "S"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestProjectDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.project import ProjectDAO
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars[EnvVariable.PROJECTS_TABLE]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_PROJECTS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_PROJECTS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.project_dao = ProjectDAO(self.TEST_TABLE, self.ddb)
        # Seed 2 projects for testing update/delete
        self.UPDATE_PROJECT = ProjectModel(
            "fun-project",
            "Project for testing project updates.",
            False,
            "testUser2@amazon.com",
        )
        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_PROJECT.to_dict())),
        )

        self.DELETE_PROJECT = ProjectModel(
            "bad-project",
            "Project for testing deleting projects.",
            True,
            "testUser3@amazon.com",
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_PROJECT.to_dict())),
        )

    def tearDown(self):
        """
        Delete virtual DDB resources/tables
        """
        self.ddb.delete_table(TableName=self.TEST_TABLE)
        self.ddb = None
        self.project_dao = None

    def test_create_project(self):
        new_project = ProjectModel(
            "FancyTestProject",
            "Fancy test project for unit test.",
            False,
            "testUser@amazon.com",
        )
        self.project_dao.create(new_project)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"name": {"S": new_project.name}},
        )
        assert dynamo_response["Item"]

        project_json = dynamodb_json.loads(dynamo_response["Item"])
        assert project_json["name"] == new_project.name
        assert project_json["description"] == new_project.description
        assert project_json["suspended"] == new_project.suspended
        assert project_json["createdBy"] == new_project.created_by
        assert project_json["createdAt"] == project_json["lastUpdatedAt"]

    def test_get_project(self):
        from_ddb = self.project_dao.get(self.UPDATE_PROJECT.name)
        assert from_ddb
        assert from_ddb.name == self.UPDATE_PROJECT.name
        assert from_ddb.description == self.UPDATE_PROJECT.description
        assert from_ddb.suspended == self.UPDATE_PROJECT.suspended
        assert from_ddb.created_by == self.UPDATE_PROJECT.created_by

    def test_get_nonexistent_project(self):
        from_ddb = self.project_dao.get("InvalidProjectName")
        assert not from_ddb

    def test_get_all_projects(self):
        all_projects = self.project_dao.get_all()
        assert len(all_projects) == 1

    def test_get_all_projects_filtered(self):
        all_projects = self.project_dao.get_all(project_names=[self.UPDATE_PROJECT.name, self.DELETE_PROJECT.name])
        assert len(all_projects) == 1
        for project in all_projects:
            assert not project.suspended

    def test_get_all_projects_filtered_empty_filter(self):
        all_projects = self.project_dao.get_all(project_names=[])
        assert len(all_projects) == 0

    def test_get_all_projects_filtered_no_match(self):
        all_projects = self.project_dao.get_all(project_names=["Fake-Project-1", "Fake-Project-2"])
        assert len(all_projects) == 0

    def test_get_all_projects_filtered_and_suspended(self):
        all_projects = self.project_dao.get_all(
            include_suspended=True,
            project_names=[self.UPDATE_PROJECT.name, self.DELETE_PROJECT.name],
        )
        assert len(all_projects) == 2

    def test_get_all_projects_include_suspended(self):
        all_projects = self.project_dao.get_all(include_suspended=True)
        assert all_projects
        assert len(all_projects) == 2
        has_suspended_projects = False
        for project in all_projects:
            if project.suspended:
                has_suspended_projects = True
                break

        assert has_suspended_projects

    def test_update_project(self):
        update_item_key = {
            "name": {"S": self.UPDATE_PROJECT.name},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated = ProjectModel.from_dict(self.UPDATE_PROJECT.to_dict())
        updated.name = "ThisShouldGetDropped"
        updated.description = "This should be changed from the update."
        updated.suspended = not self.UPDATE_PROJECT.suspended
        updated.created_at = 12345
        updated.created_by = "dontchangeme@amazon.com"
        updated.last_updated_at = 54321

        updated_metadata = {
            "defaultEMRClusterTTL": 2,  # hours
            "defaultEndpointTTL": 3,  # hours
            "defaultNotebookStopTime": "14:23",  # HH:MM UTC
            "allowEMROwnerOverride": False,
            "allowNotebokOwnerOverride": True,
            "allowEndpointOwnerOverride": False,
        }
        updated.metadata = updated_metadata
        self.project_dao.update(self.UPDATE_PROJECT.name, updated)

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["name"] == post_update["name"]
        assert pre_update["createdBy"] == post_update["createdBy"]
        assert pre_update["createdAt"] == post_update["createdAt"]
        assert pre_update["lastUpdatedAt"] <= post_update["lastUpdatedAt"]

        assert pre_update["description"] != post_update["description"]
        assert post_update["description"] == updated.description

        assert pre_update["suspended"] != post_update["suspended"]
        assert post_update["suspended"] == updated.suspended

        assert post_update["metadata"] == updated_metadata
        assert pre_update["metadata"] != post_update["metadata"]

    def test_update_nonexistent_project(self):
        updated = ProjectModel.from_dict(self.UPDATE_PROJECT.to_dict())
        updated.description = "This should be changed from the update."
        with pytest.raises(ClientError) as e_info:
            self.project_dao.update("InvalidProject", updated)
        assert str(e_info.value) == (
            "An error occurred (ConditionalCheckFailedException) when "
            "calling the UpdateItem operation: The conditional request failed"
        )

    def test_delete_project(self):
        # Ensure the project exists in dynamo
        delete_item_key = {"name": {"S": self.DELETE_PROJECT.name}}
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.project_dao.delete(self.DELETE_PROJECT.name)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_delete_nonexistent_project(self):
        # We're just calling dynamo delete here which will just return
        # realistically we shouldn't ever invoke delete if the project
        # doesn't exist because we'll have previously validated the user
        # has access to delete it but either way deleting a non-existant
        # project should be the same as deleting one that does exist. No
        # errors.
        self.project_dao.delete("InvalidProject")

    def test_has_default_stop_time(self):
        updated = ProjectModel.from_dict(self.UPDATE_PROJECT.to_dict())
        updated.metadata = {}

        assert not updated.has_default_stop_time(ResourceType.ENDPOINT)
        assert not updated.has_default_stop_time(ResourceType.NOTEBOOK)
        assert not updated.has_default_stop_time(ResourceType.EMR_CLUSTER)
        assert not updated.has_default_stop_time(ResourceType.MODEL)

        updated.metadata = {
            "terminationConfiguration": {"defaultEndpointTTL": 168},
        }
        assert updated.has_default_stop_time(ResourceType.ENDPOINT)

        updated.metadata = {
            "terminationConfiguration": {"defaultEMRClusterTTL": 168},
        }
        assert updated.has_default_stop_time(ResourceType.EMR_CLUSTER)

        updated.metadata = {
            "terminationConfiguration": {"defaultNotebookStopTime": "17:00"},
        }
        assert updated.has_default_stop_time(ResourceType.NOTEBOOK)
