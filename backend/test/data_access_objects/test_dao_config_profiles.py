import os
import json
import unittest
from unittest.mock import MagicMock, patch, ANY

os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.config_profiles import (
    ConfigProfilesDAO,
    ConfigProfileModel,
)
from ml_space_lambda.data_access_objects.dynamo_data_store import PagedResults
from ml_space_lambda.enums import EnvVariable
from ml_space_lambda.utils.exceptions import ResourceInUseError


class TestConfigProfilesDAO(unittest.TestCase):
    def setUp(self):
        # stub out the get_environment_variables call so DAO.__init__ picks up
        # our fake table names
        patcher = patch(
            "ml_space_lambda.data_access_objects.config_profiles.get_environment_variables",
            return_value={
                EnvVariable.CONFIGURATION_PROFILES_TABLE: "profiles",
                EnvVariable.PROJECTS_TABLE: "projects",
            },
        )
        self.addCleanup(patcher.stop)
        patcher.start()

        # a fake low‑level boto3 client
        self.mock_client = MagicMock()
        # a fake projects table for delete()
        self.mock_projects_table = MagicMock()

        # construct DAO with our fake client
        self.dao = ConfigProfilesDAO(table_name="profiles", client=self.mock_client)
        # override the real projects_table
        self.dao.projects_table = self.mock_projects_table

        # a sample full record
        self.sample = {
            "profileId": "p1",
            "name": "nm",
            "description": "desc",
            "notebookInstanceTypes": ["i1"],
            "trainingJobInstanceTypes": ["i2"],
            "hpoJobInstanceTypes": ["i3"],
            "transformJobInstanceTypes": ["i4"],
            "endpointInstanceTypes": ["i5"],
            "createdBy": "u1",
            "createdAt": 100,
            "updatedBy": "u2",
            "updatedAt": 200,
        }

    def test_list_returns_records_from__scan(self):
        fake_items = [{"profileId":"p1","name":"nm","description":"d","updatedAt":42}]
        with patch.object(
                ConfigProfilesDAO, "_scan",
                return_value=PagedResults(fake_items, None)
        ) as mock_scan:
            result = self.dao.list()

        # verify return value
        self.assertEqual(result, fake_items)

        # verify that _scan was called with exactly the three expected kwargs
        mock_scan.assert_called_once()
        _, kwargs = mock_scan.call_args
        self.assertEqual(
            kwargs["projection_expression"],
            "profileId, #n, description, updatedAt"
        )
        self.assertEqual(kwargs["expression_names"], {"#n": "name"})
        self.assertFalse(kwargs["page_response"])

    def test_get_returns_dict_when_found(self):
        # our get() simply returns the raw dict
        with patch.object(
                ConfigProfilesDAO, "_retrieve",
                return_value=self.sample
        ) as mock_retrieve:
            result = self.dao.get("p1")

        self.assertEqual(result, self.sample)
        mock_retrieve.assert_called_once_with({"profileId": "p1"})

    def test_get_returns_none_on_keyerror(self):
        with patch.object(
                ConfigProfilesDAO, "_retrieve",
                side_effect=KeyError
        ):
            self.assertIsNone(self.dao.get("p1"))

    def test_create_sets_timestamps_and_calls__create(self):
        # freeze time
        with patch("time.time", return_value=1234):
            m = ConfigProfileModel(
                name="nm",
                description="desc",
                notebookInstanceTypes=["i1"],
                trainingJobInstanceTypes=["i2"],
                hpoJobInstanceTypes=["i3"],
                transformJobInstanceTypes=["i4"],
                endpointInstanceTypes=["i5"],
                createdBy="u1",
                updatedBy="u1",
            )

            with patch.object(self.dao, "_create") as mock_create:
                returned = self.dao.create(m)

        # same instance returned
        self.assertIs(returned, m)
        # timestamps bumped
        self.assertEqual(m.createdAt, 1234)
        self.assertEqual(m.updatedAt, 1234)
        # ensure we passed the pydantic‐serialized dict into _create
        mock_create.assert_called_once_with(
            m.dict(by_alias=True, exclude_none=True)
        )

    def test_update_builds_expression_and_returns_new_model(self):
        # create a model with known values
        m = ConfigProfileModel(
            profileId="p1",
            name="old",
            description="old",
            notebookInstanceTypes=["i1"],
            trainingJobInstanceTypes=["i2"],
            hpoJobInstanceTypes=["i3"],
            transformJobInstanceTypes=["i4"],
            endpointInstanceTypes=["i5"],
            createdBy="u1",
            createdAt=100,
            updatedBy="u1",
            updatedAt=100,
        )

        with patch("time.time", return_value=999):
            # fake what DynamoDB would return
            new_dict = dict(self.sample)
            dynamo_attrs = json.loads(dynamodb_json.dumps(new_dict))
            self.mock_client.update_item.return_value = {"Attributes": dynamo_attrs}

            result = self.dao.update(m)

        # ensure we called update_item
        self.mock_client.update_item.assert_called_once()
        # and we got back a fresh pydantic model
        self.assertIsInstance(result, ConfigProfileModel)
        self.assertEqual(
            result.dict(by_alias=True, exclude_none=True),
            new_dict
        )

    def test_delete_raises_if_projects_query_count_gt_zero(self):
        self.mock_projects_table.query.return_value = {"Count": 1}
        with self.assertRaises(ResourceInUseError):
            self.dao.delete("p1")
        self.mock_projects_table.query.assert_called_once_with(
            IndexName="configProfileId-index",
            KeyConditionExpression=ANY,
            ProjectionExpression="projectId"
        )

    def test_delete_calls__delete_if_no_projects(self):
        self.mock_projects_table.query.return_value = {"Count": 0}
        with patch.object(self.dao, "_delete") as mock_delete:
            self.dao.delete("p1")

        mock_delete.assert_called_once_with({"profileId": "p1"})
