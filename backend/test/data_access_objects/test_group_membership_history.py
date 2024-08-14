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
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.group_membership_history import GroupMembershipHistoryDAO, GroupMembershipHistoryModel
from ml_space_lambda.enums import EnvVariable, GroupUserAction

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
TEST_GROUP_HISTORY_TABLE_KEY_SCHEMA = [
    {"AttributeName": "group", "KeyType": "HASH"},
    {"AttributeName": "actionedAt", "KeyType": "RANGE"},
]
TEST_GROUP_HISTORY_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "group", "AttributeType": "S"},
    {"AttributeName": "actionedAt", "AttributeType": "N"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

MOCK_GROUP_NAME = "fake-group"


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestGroupMembershipHistoryDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        import time

        from ml_space_lambda.data_access_objects.group_membership_history import GroupMembershipHistoryModel
        from ml_space_lambda.enums import GroupUserAction
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
            KeySchema=TEST_GROUP_HISTORY_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_GROUP_HISTORY_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.group_membership_history_dao = GroupMembershipHistoryDAO(self.TEST_TABLE, self.ddb)

        # Seed 10 records for random testing split between two groups
        for i in range(10):
            record = GroupMembershipHistoryModel(
                group_name=MOCK_GROUP_NAME if i % 2 == 0 else "secondGroup",
                username=f"my_user_{i}",
                action=GroupUserAction.ADDED if i % 2 == 0 else GroupUserAction.REMOVED,
                actioned_by="admin_user",
                actioned_at=int(time.time()) + i,
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
        self.group_membership_history_dao = None

    def test_add_group_membership_history_success(self):
        new_record = GroupMembershipHistoryModel(
            group_name=MOCK_GROUP_NAME,
            username="my_new_user_from_unit_tests",
            action=GroupUserAction.ADDED,
            actioned_by="admin_user",
            actioned_at=int(time.time()),
        )
        self.group_membership_history_dao.create(new_record)
        dynamo_response = self.ddb.get_item(
            TableName=self.TEST_TABLE,
            Key={"group": {"S": MOCK_GROUP_NAME}, "actionedAt": {"N": f"{new_record.actioned_at}"}},
        )
        assert dynamo_response["Item"]

        group_membership_history_dataset_json = dynamodb_json.loads(dynamo_response["Item"])
        assert group_membership_history_dataset_json == new_record.to_dict()

    def test_get_group_membership_history_for_group(self):
        all_group_datasets = self.group_membership_history_dao.get_all_for_group(MOCK_GROUP_NAME)
        assert len(all_group_datasets) == 5
        for record in all_group_datasets:
            assert record.group == MOCK_GROUP_NAME

    def test_get_group_membership_history_for_group_nonexistant(self):
        all_group_datasets = self.group_membership_history_dao.get_all_for_group("MadeUpGroupName")
        assert len(all_group_datasets) == 0
