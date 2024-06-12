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
from typing import List
from unittest import TestCase, mock

import boto3
import moto
import pytest
from botocore.exceptions import ClientError
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataModel
from ml_space_lambda.enums import ResourceType

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
TEST_METADATA_TABLE_KEY_SCHEMA = [
    {"AttributeName": "resourceType", "KeyType": "HASH"},
    {"AttributeName": "resourceId", "KeyType": "RANGE"},
]
TEST_METADATA_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "resourceType", "AttributeType": "S"},
    {"AttributeName": "resourceId", "AttributeType": "S"},
    {"AttributeName": "project", "AttributeType": "S"},
    {"AttributeName": "user", "AttributeType": "S"},
]

TEST_PROJECT_NAME = "TestProject"
TEST_USER_NAME = "jdoe@amazon.com"
DEMO_PROJECT_NAME = "DemoProject"
FILTER_TEST_PROJECT_NAME = "FitlerTest"

FILTER_TEST_USERNAME = "filter@amazon.com"

TO_DELETE_ID = "arn:to-delete"
TO_UPDATE_ID = "arn:to-update"

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)


def assert_resources(
    resources: List[ResourceMetadataModel],
    expected_len: int,
    expected_type: ResourceType,
    expected_project: str = None,
    expected_user: str = None,
    expected_status: str = None,
):
    assert len(resources) == expected_len

    for res in resources:
        assert res.type == expected_type
        if expected_project:
            assert res.project == expected_project
        if expected_user:
            assert res.user == expected_user
        if expected_status:
            assert res.metadata["ResourceStatus"] == expected_status


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestResourceMetadataDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataDAO
        from ml_space_lambda.utils.common_functions import retry_config

        self.TEST_TABLE = "mlspace-resource-metadata"
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_METADATA_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_METADATA_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
            LocalSecondaryIndexes=[
                {
                    "IndexName": "ProjectResources",
                    "KeySchema": [
                        {"AttributeName": "resourceType", "KeyType": "HASH"},
                        {"AttributeName": "project", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
                {
                    "IndexName": "UserResources",
                    "KeySchema": [
                        {"AttributeName": "resourceType", "KeyType": "HASH"},
                        {"AttributeName": "user", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
            ],
        )
        self.resource_metadata_dao = ResourceMetadataDAO(self.TEST_TABLE, self.ddb)

        # Seed 2 records for testing update/delete
        self.UPDATE_RESOURCE_METADATA = ResourceMetadataModel(
            TO_UPDATE_ID,
            ResourceType.TRAINING_JOB,
            TEST_USER_NAME,
            TEST_PROJECT_NAME,
            {"ResourceStatus": "fake", "createdAt": int(time.time())},
        )
        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.UPDATE_RESOURCE_METADATA.to_dict())),
        )

        self.DELETE_RESOURCE_METADATA = ResourceMetadataModel(
            TO_DELETE_ID,
            ResourceType.EMR_CLUSTER,
            TEST_USER_NAME,
            TEST_PROJECT_NAME,
            {"ResourceStatus": "fake", "createdAt": int(time.time())},
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.DELETE_RESOURCE_METADATA.to_dict())),
        )
        # Create some sample resource metadata entries
        # 6 endpoint records
        # 5 training job records
        # 10 batch translate job records
        # 29 notebook records (20 for test TEST_PROJECT_NAME and 12 for TEST_USER_NAME)
        for i in range(50):
            res_type = ResourceType.NOTEBOOK
            if i % 5 == 0:
                res_type = ResourceType.BATCH_TRANSLATE_JOB
            elif i % 8 == 0:
                res_type = ResourceType.TRAINING_JOB
            elif i % 7 == 0:
                res_type = ResourceType.ENDPOINT

            self.ddb.put_item(
                TableName=self.TEST_TABLE,
                Item=json.loads(
                    dynamodb_json.dumps(
                        {
                            "resourceType": res_type,
                            "resourceId": f"fakeArn:{i}",
                            "project": TEST_PROJECT_NAME if i % 3 != 0 else "DemoProject",
                            "user": TEST_USER_NAME if i % 2 == 0 else f"user-{i}",
                            "metadata": {
                                "ResourceStatus": "Completed" if i % 16 == 0 else "InProgress",
                                "createdAt": int(time.time()),
                            },
                        }
                    )
                ),
            )
        # Create some sample data for filtering tests
        for i in range(5):
            self.ddb.put_item(
                TableName=self.TEST_TABLE,
                Item=json.loads(
                    dynamodb_json.dumps(
                        {
                            "resourceType": ResourceType.TRAINING_JOB,
                            "resourceId": f"fakeArn:filterTest/{i}",
                            "project": FILTER_TEST_PROJECT_NAME,
                            "user": FILTER_TEST_USERNAME,
                            "metadata": {
                                "ResourceStatus": "Completed" if i % 2 == 0 else "InProgress",
                                "createdAt": int(time.time()),
                            },
                        }
                    )
                ),
            )

    def tearDown(self):
        """
        Delete virtual DDB resources/tables
        """
        self.ddb.delete_table(TableName=self.TEST_TABLE)
        self.ddb = None
        self.resource_metadata_dao = None

    def test_create_resource_metadata(self):
        mock_create_timestamp = int(time.time())
        mock_model_arn = "arn:aws:us-east-1:123456789012:sagemaker:model/Demo-Model"
        model_resource = ResourceMetadataModel(
            mock_model_arn,
            ResourceType.MODEL,
            TEST_USER_NAME,
            TEST_PROJECT_NAME,
            {"createdAt": mock_create_timestamp},
        )

        self.resource_metadata_dao.create(model_resource)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"resourceType": {"S": ResourceType.MODEL}, "resourceId": {"S": mock_model_arn}},
        )
        assert dynamo_response["Item"]

        resource_json = dynamodb_json.loads(dynamo_response["Item"])
        assert resource_json["resourceType"] == ResourceType.MODEL
        assert resource_json["resourceId"] == mock_model_arn
        assert resource_json["project"] == TEST_PROJECT_NAME
        assert resource_json["user"] == TEST_USER_NAME
        assert resource_json["metadata"]["createdAt"] == mock_create_timestamp

    def test_get_resource_metadata(self):
        target_id = "fakeArn:0"
        # The item with "fakeArn:0" should be a batch translate job (0 % 5 == 0), that is
        # associated with the demo project, and the test user
        from_ddb = self.resource_metadata_dao.get(target_id, ResourceType.BATCH_TRANSLATE_JOB)
        assert from_ddb
        assert from_ddb.type == ResourceType.BATCH_TRANSLATE_JOB
        assert from_ddb.id == target_id
        assert from_ddb.project == DEMO_PROJECT_NAME
        assert from_ddb.user == TEST_USER_NAME
        assert from_ddb.metadata["createdAt"]

    def test_get_nonexistant_metadata(self):
        # There is a record with this Id but not with the corresponding resource type
        from_ddb = self.resource_metadata_dao.get("fakeArn:0", ResourceType.NOTEBOOK)
        assert not from_ddb

    def test_get_resources_for_project(self):
        # 20 of the total 29 notebooks should be for TestProject and the other 9 should be for
        # DemoProject
        test_project_notebooks = []
        results = self.resource_metadata_dao.get_all_for_project_by_type(TEST_PROJECT_NAME, ResourceType.NOTEBOOK, limit=10)
        assert results.next_token
        test_project_notebooks.extend(results.records)
        results = self.resource_metadata_dao.get_all_for_project_by_type(
            TEST_PROJECT_NAME,
            ResourceType.NOTEBOOK,
            next_token=results.next_token,
        )
        assert not results.next_token
        test_project_notebooks.extend(results.records)
        assert_resources(test_project_notebooks, 20, ResourceType.NOTEBOOK, expected_project=TEST_PROJECT_NAME)

        results = self.resource_metadata_dao.get_all_for_project_by_type(DEMO_PROJECT_NAME, ResourceType.NOTEBOOK)
        assert not results.next_token
        assert_resources(results.records, 9, ResourceType.NOTEBOOK, expected_project=DEMO_PROJECT_NAME)

        # There are a total of 10 batch jobs 4 of them are associated with the DemoProject,
        # i = 0, 15, 30, 45. The other 6 are associated with the TestProject
        results = self.resource_metadata_dao.get_all_for_project_by_type(TEST_PROJECT_NAME, ResourceType.BATCH_TRANSLATE_JOB)
        assert_resources(
            results.records,
            6,
            ResourceType.BATCH_TRANSLATE_JOB,
            expected_project=TEST_PROJECT_NAME,
        )
        assert not results.next_token

        results = self.resource_metadata_dao.get_all_for_project_by_type(DEMO_PROJECT_NAME, ResourceType.BATCH_TRANSLATE_JOB)
        assert_resources(
            results.records,
            4,
            ResourceType.BATCH_TRANSLATE_JOB,
            expected_project=DEMO_PROJECT_NAME,
        )
        assert not results.next_token

    def test_get_resources_by_type_for_project(self):
        # 20 of the total 29 notebooks should be for TestProject and the other 9 should be for
        # DemoProject
        test_project_notebooks = []
        results = self.resource_metadata_dao.get_all_of_type_with_filters(
            ResourceType.NOTEBOOK, project=TEST_PROJECT_NAME, limit=10
        )
        assert results.next_token
        test_project_notebooks.extend(results.records)
        results = self.resource_metadata_dao.get_all_of_type_with_filters(
            ResourceType.NOTEBOOK,
            project=TEST_PROJECT_NAME,
            next_token=results.next_token,
        )
        assert not results.next_token
        test_project_notebooks.extend(results.records)
        assert_resources(test_project_notebooks, 20, ResourceType.NOTEBOOK, expected_project=TEST_PROJECT_NAME)

        results = self.resource_metadata_dao.get_all_of_type_with_filters(ResourceType.NOTEBOOK, project=DEMO_PROJECT_NAME)
        assert not results.next_token
        assert_resources(results.records, 9, ResourceType.NOTEBOOK, expected_project=DEMO_PROJECT_NAME)

        # There are a total of 10 batch jobs 4 of them are associated with the DemoProject,
        # i = 0, 15, 30, 45. The other 6 are associated with the TestProject
        results = self.resource_metadata_dao.get_all_of_type_with_filters(
            ResourceType.BATCH_TRANSLATE_JOB, project=TEST_PROJECT_NAME
        )
        assert_resources(
            results.records,
            6,
            ResourceType.BATCH_TRANSLATE_JOB,
            expected_project=TEST_PROJECT_NAME,
        )
        assert not results.next_token

        results = self.resource_metadata_dao.get_all_of_type_with_filters(
            ResourceType.BATCH_TRANSLATE_JOB, project=DEMO_PROJECT_NAME
        )
        assert_resources(
            results.records,
            4,
            ResourceType.BATCH_TRANSLATE_JOB,
            expected_project=DEMO_PROJECT_NAME,
        )
        assert not results.next_token

    def test_get_resources_for_project_filtered(self):
        all_project_resources = dynamodb_json.loads(
            self.ddb.query(
                TableName=self.TEST_TABLE,
                IndexName="ProjectResources",
                KeyConditionExpression="#p = :project and resourceType = :resourceType",
                ExpressionAttributeValues={
                    ":project": {"S": FILTER_TEST_PROJECT_NAME},
                    ":resourceType": {"S": ResourceType.TRAINING_JOB},
                },
                ExpressionAttributeNames={"#p": "project"},
            )
        )
        expected_in_progress = 0
        expected_complete = 0

        for item in dynamodb_json.loads(all_project_resources["Items"]):
            status = item["metadata"]["ResourceStatus"]
            if status == "InProgress":
                expected_in_progress += 1
            if status == "Completed":
                expected_complete += 1

        results = self.resource_metadata_dao.get_all_for_project_by_type(
            FILTER_TEST_PROJECT_NAME,
            ResourceType.TRAINING_JOB,
            limit=10,
            filter_expression="metadata.ResourceStatus = :resourceStatus",
            filter_values={":resourceStatus": "InProgress"},
        )

        assert not results.next_token
        assert_resources(
            results.records,
            expected_in_progress,
            ResourceType.TRAINING_JOB,
            expected_project=FILTER_TEST_PROJECT_NAME,
            expected_status="InProgress",
        )

        results = self.resource_metadata_dao.get_all_for_project_by_type(
            FILTER_TEST_PROJECT_NAME,
            ResourceType.TRAINING_JOB,
            limit=10,
            filter_expression="metadata.ResourceStatus = :resourceStatus",
            filter_values={":resourceStatus": "Completed"},
        )

        assert not results.next_token
        assert_resources(
            results.records,
            expected_complete,
            ResourceType.TRAINING_JOB,
            expected_project=FILTER_TEST_PROJECT_NAME,
            expected_status="Completed",
        )

    def test_get_resources_for_project_error_protected_expression_name(self):
        with pytest.raises(ValueError):
            self.resource_metadata_dao.get_all_for_project_by_type(
                FILTER_TEST_PROJECT_NAME, ResourceType.TRAINING_JOB, expression_names={"#p": "anything"}
            )

    def test_get_resources_for_user(self):
        user_notebooks = []
        results = self.resource_metadata_dao.get_all_for_user_by_type(TEST_USER_NAME, ResourceType.NOTEBOOK, limit=10)

        assert results.next_token
        user_notebooks.extend(results.records)
        results = self.resource_metadata_dao.get_all_for_user_by_type(
            TEST_USER_NAME, ResourceType.NOTEBOOK, next_token=results.next_token
        )
        assert not results.next_token
        user_notebooks.extend(results.records)

        assert_resources(user_notebooks, 12, ResourceType.NOTEBOOK, expected_user=TEST_USER_NAME)

    def test_get_resources_by_type_for_user(self):
        user_notebooks = []
        results = self.resource_metadata_dao.get_all_of_type_with_filters(ResourceType.NOTEBOOK, user=TEST_USER_NAME, limit=10)

        assert results.next_token
        user_notebooks.extend(results.records)
        results = self.resource_metadata_dao.get_all_of_type_with_filters(
            ResourceType.NOTEBOOK, user=TEST_USER_NAME, next_token=results.next_token
        )
        assert not results.next_token
        user_notebooks.extend(results.records)

        assert_resources(user_notebooks, 12, ResourceType.NOTEBOOK, expected_user=TEST_USER_NAME)

    def test_get_resources_for_user_filtered(self):
        all_user_resources = dynamodb_json.loads(
            self.ddb.query(
                TableName=self.TEST_TABLE,
                IndexName="UserResources",
                KeyConditionExpression="#u = :username and resourceType = :resourceType",
                ExpressionAttributeValues={
                    ":username": {"S": FILTER_TEST_USERNAME},
                    ":resourceType": {"S": ResourceType.TRAINING_JOB},
                },
                ExpressionAttributeNames={"#u": "user"},
            )
        )
        expected_in_progress = 0
        expected_complete = 0

        for item in dynamodb_json.loads(all_user_resources["Items"]):
            status = item["metadata"]["ResourceStatus"]
            if status == "InProgress":
                expected_in_progress += 1
            if status == "Completed":
                expected_complete += 1

        # Ensure we've got some data to test
        assert expected_in_progress > 0
        assert expected_complete > 0

        results = self.resource_metadata_dao.get_all_for_user_by_type(
            FILTER_TEST_USERNAME,
            ResourceType.TRAINING_JOB,
            limit=10,
            filter_expression="metadata.ResourceStatus = :resourceStatus",
            filter_values={":resourceStatus": "Completed"},
        )

        assert not results.next_token
        assert_resources(
            results.records,
            expected_complete,
            ResourceType.TRAINING_JOB,
            expected_user=FILTER_TEST_USERNAME,
            expected_status="Completed",
        )

        results = self.resource_metadata_dao.get_all_for_user_by_type(
            FILTER_TEST_USERNAME,
            ResourceType.TRAINING_JOB,
            limit=10,
            filter_expression="metadata.ResourceStatus = :resourceStatus",
            filter_values={":resourceStatus": "InProgress"},
        )

        assert not results.next_token
        assert_resources(
            results.records,
            expected_in_progress,
            ResourceType.TRAINING_JOB,
            expected_user=FILTER_TEST_USERNAME,
            expected_status="InProgress",
        )

    def test_update_resource_metadata(self):
        update_item_key = {
            "resourceId": {"S": self.UPDATE_RESOURCE_METADATA.id},
            "resourceType": {"S": self.UPDATE_RESOURCE_METADATA.type},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated_metadata = {"ResourceStatus": "Updated by the unit test"}
        self.resource_metadata_dao.update(
            self.UPDATE_RESOURCE_METADATA.id, self.UPDATE_RESOURCE_METADATA.type, updated_metadata
        )

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["resourceId"] == post_update["resourceId"]
        assert pre_update["resourceType"] == post_update["resourceType"]
        assert pre_update["project"] == post_update["project"]
        assert pre_update["user"] == post_update["user"]

        assert pre_update["metadata"] != post_update["metadata"]
        assert post_update["metadata"] == updated_metadata

    def test_update_nonexistant_resource_metadata(self):
        updated_metadata = {"message": "This should be changed from the update."}
        with pytest.raises(ClientError) as e_info:
            self.resource_metadata_dao.update("InvalidId", ResourceType.NOTEBOOK, updated_metadata)
        assert str(e_info.value) == (
            "An error occurred (ConditionalCheckFailedException) when "
            "calling the UpdateItem operation: The conditional request failed"
        )

    def test_delete_resource_metadata(self):
        target_id = TO_DELETE_ID
        target_type = ResourceType.EMR_CLUSTER
        # Ensure the record exists in dynamo
        delete_item_key = {
            "resourceId": {"S": target_id},
            "resourceType": {"S": target_type},
        }
        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" in to_delete

        self.resource_metadata_dao.delete(target_id, target_type)

        to_delete = self.ddb.get_item(TableName=self.TEST_TABLE, Key=delete_item_key)
        assert "Item" not in to_delete

    def test_delete_noexistant_resource_metadata(self):
        # We're just calling dynamo delete here which will just return realistically we shouldn't
        # ever invoke delete if the record doesn't exist because we'll have previously validated
        # the user has access to delete it but either way deleting a non-existant resource metadata
        # record should be the same as deleting one that does exist. No errors.
        self.resource_metadata_dao.delete("InvalidId", ResourceType.ENDPOINT)

    def test_upsert_metadata_create(self):
        mock_create_timestamp = int(time.time())
        mock_model_arn = "arn:aws:us-east-1:123456789012:sagemaker:model/Demo-Model-2"

        self.resource_metadata_dao.upsert_record(
            mock_model_arn,
            ResourceType.MODEL,
            TEST_USER_NAME,
            TEST_PROJECT_NAME,
            {"createdAt": mock_create_timestamp},
        )
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"resourceType": {"S": ResourceType.MODEL}, "resourceId": {"S": mock_model_arn}},
        )
        assert dynamo_response["Item"]

        resource_json = dynamodb_json.loads(dynamo_response["Item"])
        assert resource_json["resourceType"] == ResourceType.MODEL
        assert resource_json["resourceId"] == mock_model_arn
        assert resource_json["project"] == TEST_PROJECT_NAME
        assert resource_json["user"] == TEST_USER_NAME
        assert resource_json["metadata"]["createdAt"] == mock_create_timestamp

    def test_upsert_metadata_invalid_data(self):
        mock_create_timestamp = int(time.time())

        with pytest.raises(ClientError) as e_info:
            self.resource_metadata_dao.upsert_record(
                "",
                "",
                "",
                "",
                {"createdAt": mock_create_timestamp},
            )

        assert (
            str(e_info.value)
            == "An error occurred (ValidationException) when calling the PutItem operation: One or more parameter values were invalid: An AttributeValue may not contain an empty string. Key: resourceType"
        )

    def test_upsert_metadata_update(self):
        update_item_key = {
            "resourceId": {"S": self.UPDATE_RESOURCE_METADATA.id},
            "resourceType": {"S": self.UPDATE_RESOURCE_METADATA.type},
        }
        pre_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        updated_metadata = {"ResourceStatus": "Upserted by the upsert update test"}
        self.resource_metadata_dao.upsert_record(
            self.UPDATE_RESOURCE_METADATA.id,
            self.UPDATE_RESOURCE_METADATA.type,
            TEST_USER_NAME,
            TEST_PROJECT_NAME,
            updated_metadata,
        )

        post_update = dynamodb_json.loads(self.ddb.get_item(TableName=self.TEST_TABLE, Key=update_item_key)["Item"])

        assert pre_update["resourceId"] == post_update["resourceId"]
        assert pre_update["resourceType"] == post_update["resourceType"]
        assert pre_update["project"] == post_update["project"]
        assert pre_update["user"] == post_update["user"]

        assert pre_update["metadata"] != post_update["metadata"]
        assert post_update["metadata"] == updated_metadata

    def test_filtered_results_reserved_values(self):
        with pytest.raises(ValueError):
            self.resource_metadata_dao.get_all_for_user_by_type(
                FILTER_TEST_USERNAME,
                ResourceType.TRAINING_JOB,
                limit=10,
                filter_expression="metadata.ResourceStatus = :user",
                filter_values={":user": "InProgress"},
            )

        with pytest.raises(ValueError):
            self.resource_metadata_dao.get_all_for_user_by_type(
                FILTER_TEST_USERNAME,
                ResourceType.TRAINING_JOB,
                limit=10,
                filter_expression="metadata.ResourceStatus = :resourceType",
                filter_values={":resourceType": "InProgress"},
            )

        results = self.resource_metadata_dao.get_all_for_user_by_type(
            FILTER_TEST_USERNAME,
            ResourceType.TRAINING_JOB,
            limit=10,
            filter_expression="metadata.ResourceStatus = :project",
            filter_values={":project": "InProgress"},
        )
        assert len(results.records) > 0

        with pytest.raises(ValueError):
            self.resource_metadata_dao.get_all_for_project_by_type(
                FILTER_TEST_PROJECT_NAME,
                ResourceType.TRAINING_JOB,
                limit=10,
                filter_expression="metadata.ResourceStatus = :project",
                filter_values={":project": "InProgress"},
            )

        with pytest.raises(ValueError):
            self.resource_metadata_dao.get_all_for_project_by_type(
                FILTER_TEST_PROJECT_NAME,
                ResourceType.TRAINING_JOB,
                limit=10,
                filter_expression="metadata.ResourceStatus = :resourceType",
                filter_values={":resourceType": "InProgress"},
            )

        results = self.resource_metadata_dao.get_all_for_project_by_type(
            FILTER_TEST_PROJECT_NAME,
            ResourceType.TRAINING_JOB,
            limit=10,
            filter_expression="metadata.ResourceStatus = :user",
            filter_values={":user": "InProgress"},
        )
        assert len(results.records) > 0

    def test_get_resources_for_type(self):
        notebooks = []
        results = self.resource_metadata_dao.get_all_of_type_with_filters(ResourceType.NOTEBOOK, limit=10)

        assert results.next_token
        notebooks.extend(results.records)
        results = self.resource_metadata_dao.get_all_of_type_with_filters(ResourceType.NOTEBOOK, next_token=results.next_token)
        assert not results.next_token
        notebooks.extend(results.records)

        assert_resources(notebooks, 29, ResourceType.NOTEBOOK)

    def test_get_resources_for_type_filtered(self):
        # 11 training jobs. 4 - InProgress, 6 Completed, 2 Fake. Limit 10 = 2 pages
        all_project_resources = dynamodb_json.loads(
            self.ddb.query(
                TableName=self.TEST_TABLE,
                KeyConditionExpression="resourceType = :resourceType",
                ExpressionAttributeValues={
                    ":resourceType": {"S": ResourceType.TRAINING_JOB},
                },
            )
        )
        expected_in_progress = 0
        expected_complete = 0

        for item in dynamodb_json.loads(all_project_resources["Items"]):
            status = item["metadata"]["ResourceStatus"]
            if status == "InProgress":
                expected_in_progress += 1
            if status == "Completed":
                expected_complete += 1

        results = self.resource_metadata_dao.get_all_of_type_with_filters(
            ResourceType.TRAINING_JOB,
            limit=10,
            filter_expression="metadata.ResourceStatus = :resourceStatus",
            filter_values={":resourceStatus": "InProgress"},
        )

        assert results.next_token
        # Since there are more records than can fit on a page, get pages until complete
        records = results.records
        while results.next_token:
            results = self.resource_metadata_dao.get_all_of_type_with_filters(
                ResourceType.TRAINING_JOB,
                limit=10,
                filter_expression="metadata.ResourceStatus = :resourceStatus",
                filter_values={":resourceStatus": "InProgress"},
                next_token=results.next_token,
            )
            records += results.records
        assert_resources(
            records,
            expected_in_progress,
            ResourceType.TRAINING_JOB,
            expected_status="InProgress",
        )

        results = self.resource_metadata_dao.get_all_of_type_with_filters(
            ResourceType.TRAINING_JOB,
            limit=10,
            filter_expression="metadata.ResourceStatus = :resourceStatus",
            filter_values={":resourceStatus": "Completed"},
        )

        assert results.next_token
        # Since there are more records than can fit on a page, get pages until complete
        records = results.records
        while results.next_token:
            results = self.resource_metadata_dao.get_all_of_type_with_filters(
                ResourceType.TRAINING_JOB,
                limit=10,
                filter_expression="metadata.ResourceStatus = :resourceStatus",
                filter_values={":resourceStatus": "Completed"},
                next_token=results.next_token,
            )
            records += results.records
        assert_resources(
            records,
            expected_complete,
            ResourceType.TRAINING_JOB,
            expected_status="Completed",
        )

    def test_get_all_for_type_error_parameter_conflict(self):
        with pytest.raises(ValueError):
            self.resource_metadata_dao.get_all_of_type_with_filters(
                ResourceType.TRAINING_JOB, user="bob", project="bob-project"
            )

    def test_get_all_for_type_error_protected_filter_value(self):
        with pytest.raises(ValueError):
            self.resource_metadata_dao.get_all_of_type_with_filters(
                ResourceType.TRAINING_JOB, filter_expression="not an expression", filter_values={":resourceType": "anything"}
            )
