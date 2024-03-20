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

from ml_space_lambda.data_access_objects.dataset import DatasetDAO
from ml_space_lambda.data_access_objects.project import ProjectDAO
from ml_space_lambda.data_access_objects.project_user import ProjectUserDAO
from ml_space_lambda.data_access_objects.user import UserDAO
from ml_space_lambda.enums import DatasetType, Permission
from ml_space_lambda.utils.migrate_sms_data import migrate_sms_data

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
PROJECTS_TABLE_NAME = "mlspace-projects"
PROJECTS_TABLE_KEY_SCHEMA = [{"AttributeName": "name", "KeyType": "HASH"}]
PROJECTS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "name", "AttributeType": "S"},
]

DATASETS_TABLE_NAME = "mlspace-datasets"
DATASETS_TABLE_KEY_SCHEMA = [
    {"AttributeName": "scope", "KeyType": "HASH"},
    {"AttributeName": "name", "KeyType": "RANGE"},
]
DATASETS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "scope", "AttributeType": "S"},
    {"AttributeName": "name", "AttributeType": "S"},
]

PROJECT_USER_TABLE_NAME = "mlspace-project-users"
PROJECT_USER_TABLE_KEY_SCHEMA = [
    {"AttributeName": "project", "KeyType": "HASH"},
    {"AttributeName": "user", "KeyType": "RANGE"},
]
PROJECT_USER_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "project", "AttributeType": "S"},
    {"AttributeName": "user", "AttributeType": "S"},
]

USERS_TABLE_NAME = "mlspace-users"
USERS_TABLE_KEY_SCHEMA = [{"AttributeName": "username", "KeyType": "HASH"}]
USERS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "username", "AttributeType": "S"},
]

SMS_PRIMARY_TABLE_NAME = "sms-project-table"
SMS_PRIMARY_TABLE_KEY_SCHEMA = [
    {"AttributeName": "d_n", "KeyType": "HASH"},
    {"AttributeName": "p_n", "KeyType": "RANGE"},
]
SMS_PRIMARY_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "d_n", "AttributeType": "S"},
    {"AttributeName": "p_n", "AttributeType": "S"},
]

SMS_ACCESS_TABLE_NAME = "SMSDataAccessTable"
SMS_ACCESS_TABLE_KEY_SCHEMA = [
    {"AttributeName": "a_type", "KeyType": "HASH"},
    {"AttributeName": "dataset", "KeyType": "RANGE"},
]
SMS_ACCESS_TABLE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "a_type", "AttributeType": "S"},
    {"AttributeName": "dataset", "AttributeType": "S"},
]


mock.patch.TEST_PREFIX = (
    "test",
    "setUp",
    "tearDown",
)

SUSPENDED_USER = "CN=Sugar Watkins, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US"
ADMIN_USER = "CN=Carl Jenkins, OU=D007, OU=Division B, OU=Corp, O=Acme Corp, C=US"
PROJECT_OWNER_USER = "CN=Johnny Rico, OU=D002, OU=Division A, OU=Corp, O=Acme Corp, C=US"
TEST_PROJECT_NAME = "Roughnecks"

# Legacy data
LEGACY_PROJECTS = [
    {
        "d_n": "Arachnid",
        "p_n": "Arachnid",
        "info": {"c_date": 1586506807175, "p_des": "Test project for cjenkins."},
    },
    {
        "d_n": "Ticonderoga",
        "p_n": "Ticonderoga",
        "info": {"c_date": 1586506807175, "p_des": "Fleet/Ship analytics."},
    },
    {
        "d_n": TEST_PROJECT_NAME,
        "p_n": TEST_PROJECT_NAME,
        "info": {"c_date": 1586506807175, "p_des": "Project for all Rasczak direct reports."},
    },
    {
        "d_n": "PlanetP",
        "p_n": "PlanetP",
        "info": {"c_date": 1586506807175, "p_des": "dflores personal project"},
    },
]

LEGACY_USERS = [
    {
        "d_n": "CN=Career Sergeant Zim, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": "CN=Career Sergeant Zim, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "info": {"user_email": "zim@agencyA.org", "pmo": False, "c_n": "Zim"},
    },
    {
        "d_n": "CN=Kitten Smith, OU=D002, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": "CN=Kitten Smith, OU=D002, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "info": {"user_email": "ksmith@agencyA.org", "pmo": False, "c_n": "Kitten Smith"},
    },
    {
        "d_n": PROJECT_OWNER_USER,
        "p_n": PROJECT_OWNER_USER,
        "info": {"user_email": "jrico@agencyA.org", "pmo": False, "c_n": "Johnny Rico"},
    },
    {
        "d_n": "CN=Dizzy Flores, OU=D002, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": "CN=Dizzy Flores, OU=D002, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "info": {"user_email": "dflores@agencyA.org", "pmo": False, "c_n": "Dizzy Flores"},
    },
    {
        "d_n": "CN=Ace Levy, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": "CN=Ace Levy, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "info": {"user_email": "alevy@agencyA.org", "pmo": False, "c_n": "Ace Levy"},
    },
    {
        "d_n": SUSPENDED_USER,
        "p_n": SUSPENDED_USER,
        "info": {
            "user_email": "swatkins@agencyA.org",
            "pmo": False,
            "c_n": "Sugar Watkins",
            "suspended": True,
        },
    },
    {
        "d_n": "CN=Jean Rasczak, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": "CN=Jean Rasczak, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "info": {"user_email": "jrasczak@agencyA.org", "pmo": True, "c_n": "Jean Rasczak"},
    },
    {
        "d_n": "CN=Carmen Ibanez, OU=D005, OU=Division B, OU=Corp, O=Acme Corp, C=US",
        "p_n": "CN=Carmen Ibanez, OU=D005, OU=Division B, OU=Corp, O=Acme Corp, C=US",
        "info": {"user_email": "cibanez@agencyB.org", "pmo": False, "c_n": "Carmen Ibanez"},
    },
    {
        "d_n": "CN=Zander Barcalow, OU=D005, OU=Division B, OU=Corp, O=Acme Corp, C=US",
        "p_n": "CN=Zander Barcalow, OU=D005, OU=Division B, OU=Corp, O=Acme Corp, C=US",
        "info": {"user_email": "zbarcalow@agencyB.org", "pmo": False, "c_n": "Zander Barcalow"},
    },
    {
        "d_n": ADMIN_USER,
        "p_n": ADMIN_USER,
        "info": {"user_email": "cjenkins@agencyB.org", "pmo": True, "c_n": "Carl Jenkins"},
    },
]

LEGACY_PROJECT_USERS = [
    {
        "d_n": "CN=Dizzy Flores, OU=D002, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": "PlanetP",
        "info": {"is_mo": True, "is_co": True, "p_des": "dflores personal project"},
    },
    {
        "d_n": ADMIN_USER,
        "p_n": "Arachnid",
        "role": "Arachnid-UnitTest",
        "info": {"is_mo": True, "is_co": True, "p_des": "Test project for cjenkins."},
    },
    {
        "d_n": "CN=Jean Rasczak, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": TEST_PROJECT_NAME,
        "info": {"is_mo": True, "is_co": False, "p_des": "Project for all Rasczak direct reports."},
    },
    {
        "d_n": PROJECT_OWNER_USER,
        "p_n": TEST_PROJECT_NAME,
        "info": {"is_mo": True, "is_co": True, "p_des": "Project for all Rasczak direct reports."},
    },
    {
        "d_n": "CN=Ace Levy, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": TEST_PROJECT_NAME,
        "info": {"is_mo": False, "is_co": True, "p_des": "Project for all Rasczak direct reports."},
    },
    {
        "d_n": "CN=Dizzy Flores, OU=D002, OU=Division A, OU=Corp, O=Acme Corp, C=US",
        "p_n": TEST_PROJECT_NAME,
        "info": {"is_mo": False, "is_co": True, "p_des": "Project for all Rasczak direct reports."},
    },
    {
        "d_n": "CN=Carmen Ibanez, OU=D005, OU=Division B, OU=Corp, O=Acme Corp, C=US",
        "p_n": "Ticonderoga",
        "info": {"is_mo": True, "is_co": True, "p_des": "Fleet/Ship analytics."},
    },
    {
        "d_n": "CN=Zander Barcalow, OU=D005, OU=Division B, OU=Corp, O=Acme Corp, C=US",
        "p_n": "Ticonderoga",
        "info": {"is_mo": False, "is_co": True, "p_des": "Fleet/Ship analytics."},
    },
    {
        "d_n": ADMIN_USER,
        "p_n": "Ticonderoga",
        "info": {"is_mo": False, "is_co": True, "p_des": "Fleet/Ship analytics."},
    },
]

LEGACY_GLOBAL_DATASETS = [
    {
        "a_type": "global",
        "dataset": "FCP-INDI Neuroimaging Data",
        "info": {
            "description": "Raw human and non-human primate neuroimaging data",
            "s3_key": "s3://sms-data/global/datasets/FCP-INDI_Neuroimaging_Data",
            "creator": ADMIN_USER,
            "last_updated": 1594355408393,
        },
    }
]

LEGACY_PROJECT_DATASETS = [
    {
        "a_type": TEST_PROJECT_NAME,
        "dataset": "gdelt-rico",
        "info": {
            "description": "monitors the world's broadcast, print, and web news identifies the people, locations, etc. driving our global society",
            "s3_key": "s3://sms-data/project/Roughnecks/datasets/gdelt-rico",
            "creator": PROJECT_OWNER_USER,
            "last_updated": 1594355408393,
        },
    },
    {
        "a_type": TEST_PROJECT_NAME,
        "dataset": "gdelt",
        "info": {
            "description": "monitors the world's broadcast, print, and web news identifies the people, locations, etc. driving our global society",
            "s3_key": "s3://sms-data/project/Roughnecks/datasets/gdelt",
            "creator": "CN=Dizzy Flores, OU=D002, OU=Division A, OU=Corp, O=Acme Corp, C=US",
            "last_updated": 1594355408393,
        },
    },
]

LEGACY_PRIVATE_DATASETS = [
    {
        "a_type": ADMIN_USER,
        "dataset": "BrainBug",
        "info": {
            "description": "Images from possible brain bug sightings.",
            "s3_key": "s3://sms-data/private/Carl_Jenkins/datasets/BrainBug",
            "creator": ADMIN_USER,
            "last_updated": 1594355408393,
        },
    }
]


@moto.mock_dynamodb
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
class TestProjectDAO(TestCase):
    def setUp(self):
        """
        Set up virtual DDB resources/tables
        """
        from ml_space_lambda.utils.common_functions import retry_config
        from ml_space_lambda.utils.mlspace_config import get_environment_variables

        get_environment_variables()
        self.ddb = boto3.client(
            "dynamodb",
            config=retry_config,
        )
        # Create Legacy SMS tables and load data. These legacy tables have
        # GSI's but those aren't used for migration so we're not mocking them
        self.ddb.create_table(
            TableName=SMS_PRIMARY_TABLE_NAME,
            KeySchema=SMS_PRIMARY_TABLE_KEY_SCHEMA,
            AttributeDefinitions=SMS_PRIMARY_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.ddb.create_table(
            TableName=SMS_ACCESS_TABLE_NAME,
            KeySchema=SMS_ACCESS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=SMS_ACCESS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        # Create MLSpace Tables
        self.ddb.create_table(
            TableName=PROJECTS_TABLE_NAME,
            KeySchema=PROJECTS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=PROJECTS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.ddb.create_table(
            TableName=USERS_TABLE_NAME,
            KeySchema=USERS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=USERS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        self.ddb.create_table(
            TableName=PROJECT_USER_TABLE_NAME,
            KeySchema=PROJECT_USER_TABLE_KEY_SCHEMA,
            AttributeDefinitions=PROJECT_USER_TABLE_ATTRIBUTE_DEFINITIONS,
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
        self.ddb.create_table(
            TableName=DATASETS_TABLE_NAME,
            KeySchema=DATASETS_TABLE_KEY_SCHEMA,
            AttributeDefinitions=DATASETS_TABLE_ATTRIBUTE_DEFINITIONS,
            BillingMode="PAY_PER_REQUEST",
        )
        # Seed legacy data for migration
        for item in [*LEGACY_PRIVATE_DATASETS, *LEGACY_PROJECT_DATASETS, *LEGACY_GLOBAL_DATASETS]:
            self.ddb.put_item(
                TableName=SMS_ACCESS_TABLE_NAME,
                Item=json.loads(dynamodb_json.dumps(item)),
            )
        for item in [*LEGACY_PROJECTS, *LEGACY_PROJECT_USERS, *LEGACY_USERS]:
            self.ddb.put_item(
                TableName=SMS_PRIMARY_TABLE_NAME,
                Item=json.loads(dynamodb_json.dumps(item)),
            )

    def tearDown(self):
        """
        Delete virtual DDB resources/tables
        """
        self.ddb.delete_table(TableName=SMS_PRIMARY_TABLE_NAME)
        self.ddb.delete_table(TableName=SMS_ACCESS_TABLE_NAME)
        self.ddb.delete_table(TableName=PROJECTS_TABLE_NAME)
        self.ddb.delete_table(TableName=USERS_TABLE_NAME)
        self.ddb.delete_table(TableName=PROJECT_USER_TABLE_NAME)
        self.ddb.delete_table(TableName=DATASETS_TABLE_NAME)
        self.ddb = None

    def test_migrate_sms_sample_data(self):
        migrate_sms_data(SMS_PRIMARY_TABLE_NAME, SMS_ACCESS_TABLE_NAME, self.ddb)

        mlspace_projects = self.ddb.scan(TableName=PROJECTS_TABLE_NAME)
        mlspace_users = self.ddb.scan(TableName=USERS_TABLE_NAME)
        mlspace_project_users = self.ddb.scan(TableName=PROJECT_USER_TABLE_NAME)
        mlspace_datasets = self.ddb.scan(TableName=DATASETS_TABLE_NAME)

        # Ensure the expected number of records made it into each of our tables
        assert mlspace_projects["Count"] == len(LEGACY_PROJECTS)
        assert mlspace_users["Count"] == len(LEGACY_USERS)
        assert mlspace_project_users["Count"] == len(LEGACY_PROJECT_USERS)
        assert mlspace_datasets["Count"] == len(LEGACY_GLOBAL_DATASETS + LEGACY_PRIVATE_DATASETS + LEGACY_PROJECT_DATASETS)

        # Spot check that the data got migrated as expected
        found_admin = False
        found_suspended = False
        found_project_owner = False
        user_dao = UserDAO(USERS_TABLE_NAME, self.ddb)
        all_users = user_dao.get_all(True)
        for user in all_users:
            if user.username == SUSPENDED_USER:
                assert user.suspended is True
                assert user.display_name == "Sugar Watkins"
                assert user.permissions == []
                assert user.email == "swatkins@agencyA.org"
                found_suspended = True
            elif user.username == ADMIN_USER:
                assert user.suspended is False
                assert user.display_name == "Carl Jenkins"
                assert user.permissions == [Permission.ADMIN]
                assert user.email == "cjenkins@agencyB.org"
                found_admin = True
            elif user.username == PROJECT_OWNER_USER:
                assert user.suspended is False
                assert user.display_name == "Johnny Rico"
                assert user.permissions == []
                assert user.email == "jrico@agencyA.org"
                found_project_owner = True

        assert found_admin
        assert found_suspended
        assert found_project_owner

        project_dao = ProjectDAO(PROJECTS_TABLE_NAME, self.ddb)
        project = project_dao.get("Roughnecks")
        assert project.description == "Project for all Rasczak direct reports."
        assert project.suspended is False
        assert project.created_by == "System Migration"

        project_user_dao = ProjectUserDAO(PROJECT_USER_TABLE_NAME, self.ddb)
        roughneck_members = project_user_dao.get_users_for_project("Roughnecks")
        assert len(roughneck_members) == 4
        for member in roughneck_members:
            if member.user == PROJECT_OWNER_USER:
                assert Permission.PROJECT_OWNER in member.permissions
                assert Permission.COLLABORATOR in member.permissions
            elif member.user == "CN=Jean Rasczak, OU=D004, OU=Division A, OU=Corp, O=Acme Corp, C=US":
                assert Permission.PROJECT_OWNER in member.permissions
                assert Permission.COLLABORATOR not in member.permissions
            else:
                assert Permission.PROJECT_OWNER not in member.permissions
                assert Permission.COLLABORATOR in member.permissions

        jenkins_projects = project_user_dao.get_projects_for_user(ADMIN_USER)
        assert len(jenkins_projects) == 2

        arachnid_membership = project_user_dao.get("Arachnid", ADMIN_USER)
        assert Permission.PROJECT_OWNER in arachnid_membership.permissions
        assert Permission.COLLABORATOR in arachnid_membership.permissions
        assert "Arachnid-UnitTest" == arachnid_membership.role

        ticonderoga_membership = project_user_dao.get("Ticonderoga", ADMIN_USER)
        assert Permission.PROJECT_OWNER not in ticonderoga_membership.permissions
        assert Permission.COLLABORATOR in ticonderoga_membership.permissions
        assert ticonderoga_membership.role == ""

        datasets_dao = DatasetDAO(DATASETS_TABLE_NAME, self.ddb)
        global_datasets = datasets_dao.get_all_for_scope(DatasetType.GLOBAL, DatasetType.GLOBAL.value)
        admin_datasets = datasets_dao.get_all_for_scope(DatasetType.PRIVATE, ADMIN_USER)
        project_datasets = datasets_dao.get_all_for_scope(DatasetType.PROJECT, TEST_PROJECT_NAME)
        assert len(global_datasets) == 1
        assert len(admin_datasets) == 1
        assert len(project_datasets) == 2
        # Not expecting any datasets in this scope
        assert len(datasets_dao.get_all_for_scope(DatasetType.PRIVATE, SUSPENDED_USER)) == 0

        global_dataset = global_datasets[0]
        assert global_dataset.name == "FCP-INDI Neuroimaging Data"
        assert global_dataset.description == "Raw human and non-human primate neuroimaging data"
        assert global_dataset.type == DatasetType.GLOBAL
        assert global_dataset.location == "s3://sms-data/global/datasets/FCP-INDI_Neuroimaging_Data"
        assert global_dataset.created_by == ADMIN_USER
        assert global_dataset.created_at == 1594355408393
