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
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationDAO, AppConfigurationModel

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    # Fake cred info for MOTO
    "AWS_ACCESS_KEY_ID": "testing",
    "AWS_SECRET_ACCESS_KEY": "testing",
    "AWS_SECURITY_TOKEN": "testing",
    "AWS_SESSION_TOKEN": "testing",
}

# DDB Configurations
TEST_APP_CONFIG_TABLE_KEY_SCHEMA = [
    {"AttributeName": "configScope", "KeyType": "HASH"},
    {"AttributeName": "versionId", "KeyType": "RANGE"},
]
TEST_APP_CONFIG_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "configScope", "AttributeType": "S"},
    {"AttributeName": "versionId", "AttributeType": "N"},
]

mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

mock_time = int(time.time())


def generate_test_config(config_scope: str, version_id: int, is_project: bool) -> dict:
    config = {
        "configScope": config_scope,
        "versionId": version_id,
        "changeReason": "Testing",
        "changedBy": "Tester",
        "createdAt": mock_time,
        "configuration": {
            "DisabledInstanceTypes": {
                "notebook-instance": ["ml.t3.medium", "ml.r5.large"],
                "endpoint": ["ml.t3.large", "ml.r5.medium"],
                "training-job": ["ml.t3.xlarge", "ml.r5.small"],
                "transform-job": ["ml.t3.kindabig", "ml.r5.kindasmall"],
            },
            "EnabledServices": {
                "real-time-translate": "true",
                "batch-translate-job": "false",
                "labeling-job": "true",
                "cluster": "true",
                "endpoint": "true",
                "endpoint-config": "false",
                "hpo-job": "true",
                "model": "true",
                "notebook-instance": "false",
                "training-job": "true",
                "transform-job": "true",
            },
            "EMRConfig": {
                "cluster-sizes": [
                    {"name": "Small", "size": 3, "master-type": "m5.xlarge", "core-type": "m5.xlarge"},
                    {"name": "Medium", "size": 5, "master-type": "m5.xlarge", "core-type": "m5.xlarge"},
                    {"name": "Large", "size": 7, "master-type": "m5.xlarge", "core-type": "p3.8xlarge"},
                ],
                "auto-scaling": {
                    "min-instances": 2,
                    "max-instances": 15,
                    "scale-out": {"increment": 1, "percentage-mem-available": 15, "eval-periods": 1, "cooldown": 300},
                    "scale-in": {"increment": -1, "percentage-mem-available": 75, "eval-periods": 1, "cooldown": 300},
                },
                "applications": [
                    {"Name": "Hadoop"},
                    {"Name": "Spark"},
                    {"Name": "Ganglia"},
                    {"Name": "Hive"},
                    {"Name": "Tez"},
                    {"Name": "Presto"},
                    {"Name": "Livy"},
                ],
            },
        },
    }
    # If this config is not for a project, add the app-wide specific configurations
    if not is_project:
        config["configuration"]["ProjectCreation"] = {
            "AdminOnly": "true",
            "AllowedGroups": ["Justice League", "Avengers", "TMNT"],
        }
        config["configuration"]["SystemBanner"] = {
            "Enabled": "true",
            "TextColor": "Red",
            "BackgroundColor": "White",
            "Text": "Jeff Bezos",
        }

    return config


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestAppConfigDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.data_access_objects.app_configuration import AppConfigurationModel
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        env_vars = get_environment_variables()
        self.TEST_TABLE = env_vars["APP_CONFIGURATION_TABLE"]
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        self.ddb.create_table(
            TableName=self.TEST_TABLE,
            KeySchema=TEST_APP_CONFIG_TABLE_KEY_SCHEMA,
            AttributeDefinitions=TEST_APP_CONFIG_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.app_config_dao = AppConfigurationDAO(self.TEST_TABLE, self.ddb)

        # Seed a global record and 2 project records
        self.GLOBAL_RECORD = AppConfigurationModel.from_dict(generate_test_config("global", 0, False))
        self.PROJECT_RECORD1 = AppConfigurationModel.from_dict(generate_test_config("project1", 0, True))
        self.PROJECT_RECORD2 = AppConfigurationModel.from_dict(generate_test_config("project1", 1, True))

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.GLOBAL_RECORD.to_dict())),
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.PROJECT_RECORD1.to_dict())),
        )

        self.ddb.put_item(
            TableName=self.TEST_TABLE,
            Item=json.loads(dynamodb_json.dumps(self.PROJECT_RECORD2.to_dict())),
        )

    def tearDown(self):
        """
        Delete virtual DDB resources/tables
        """
        self.ddb.delete_table(TableName=self.TEST_TABLE)
        self.ddb = None
        self.app_config_dao = None

    def test_get_app_config_global(self):
        from_ddb = self.app_config_dao.get(self.GLOBAL_RECORD.configScope, 2)
        # num_versions is set to 2, but there's only 1 record so we expect a list of len 1
        assert len(from_ddb) == 1
        assert from_ddb[0].to_dict() == self.GLOBAL_RECORD.to_dict()

    def test_get_app_config_project(self):
        from_ddb = self.app_config_dao.get(self.PROJECT_RECORD1.configScope, 2)
        assert len(from_ddb) == 2
        # The project configs should be returned in descending order based on version ID
        # PROJECT_RECORD2 has a versionId of 2, so it should come first
        assert from_ddb[0].to_dict() == self.PROJECT_RECORD2.to_dict()
        assert from_ddb[1].to_dict() == self.PROJECT_RECORD1.to_dict()

    def test_get_app_config_not_found(self):
        assert not self.app_config_dao.get("sample-project", 1)
        

    def test_create_app_config(self):
        new_record = AppConfigurationModel.from_dict(generate_test_config("project2", 0, True))
        self.app_config_dao.create(new_record)
        from_ddb = self.app_config_dao.get(new_record.configScope, 1)
        assert len(from_ddb) == 1
        assert from_ddb[0].to_dict() == new_record.to_dict()


    def test_create_app_config_outdated(self):
        new_record = AppConfigurationModel.from_dict(generate_test_config("project1", 1, True)) # versionId 1 already exists
        with pytest.raises(self.ddb.exceptions.ConditionalCheckFailedException):
            self.app_config_dao.create(new_record)