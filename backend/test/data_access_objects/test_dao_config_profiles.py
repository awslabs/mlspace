import os
import json
import unittest
from unittest.mock import MagicMock, patch

# make sure boto3.resource() / .client() won't explode
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.config_profiles import (
    ConfigProfilesDAO,
    ConfigProfileModel,
)
from ml_space_lambda.data_access_objects.dynamo_data_store import PagedResults
from ml_space_lambda.utils.exceptions import ResourceInUseError


class TestConfigProfilesDAO(unittest.TestCase):

    def setUp(self):
        # a fake low‑level boto3 client
        self.mock_client = MagicMock()
        # a fake projects table for delete()
        self.mock_projects_table = MagicMock()
        # construct DAO with our fake client and override projects_table
        self.dao = ConfigProfilesDAO(table_name="profiles", client=self.mock_client)
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
        # arrange: patch _scan to return our PagedResults
        with patch.object(
                ConfigProfilesDAO, "_scan",
                return_value=PagedResults([{"profileId":"p1","name":"nm","description":"d","updatedAt":42}], None)
        ) as mock_scan:
            result = self.dao.list()

        # assert
        self.assertEqual(result, [{"profileId":"p1","name":"nm","description":"d","updatedAt":42}])
        mock_scan.assert_called_once_with(
            projection_expression="profileId, #n, description, updatedAt",
            expression_names={"#n": "name"},
            page_response=False
        )

    def test_get_returns_model_when_found(self):
        # arrange
        with patch.object(
                ConfigProfilesDAO, "_retrieve",
                return_value=self.sample
        ) as mock_retrieve:
            model = self.dao.get("p1")

        # assert
        self.assertIsInstance(model, ConfigProfileModel)
        self.assertEqual(model.to_dict(), self.sample)
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
                profile_id=None,
                name="n", description="d",
                notebook_instance_types=["i1"],
                training_job_instance_types=["i2"],
                hpo_job_instance_types=["i3"],
                transform_job_instance_types=["i4"],
                endpoint_instance_types=["i5"],
                created_by="u", created_at=None, updated_by="u", updated_at=None
            )

            # patch underlying _create
            with patch.object(self.dao, "_create") as mock_create:
                returned = self.dao.create(m)

        # assert
        self.assertIs(returned, m)
        self.assertEqual(m.created_at, 1234)
        self.assertEqual(m.updated_at, 1234)
        mock_create.assert_called_once_with(m.to_dict())

    def test_update_builds_expression_and_returns_new_model(self):
        # prepare a model to update
        m = ConfigProfileModel(
            profile_id="p1",
            name="old", description="old",
            notebook_instance_types=["i1"],
            training_job_instance_types=["i2"],
            hpo_job_instance_types=["i3"],
            transform_job_instance_types=["i4"],
            endpoint_instance_types=["i5"],
            created_by="u1", created_at=100,
            updated_by="u1", updated_at=100,
        )
        # freeze time for updated_at
        with patch("time.time", return_value=999):
            # craft a new dict as if Dynamo returned it
            new_dict = dict(self.sample)
            # Dynamodb‑style JSON
            dynamo_attrs = json.loads(dynamodb_json.dumps(new_dict))
            self.mock_client.update_item.return_value = {"Attributes": dynamo_attrs}

            # call update
            returned = self.dao.update(m)

        # it should call through to boto3.update_item
        self.mock_client.update_item.assert_called_once()
        # and returned must be a new model reflecting new_dict
        self.assertIsInstance(returned, ConfigProfileModel)
        self.assertEqual(returned.to_dict(), new_dict)

    def test_delete_raises_if_projects_query_count_gt_zero(self):
        # arrange: projects_table.query returns Count=1
        self.mock_projects_table.query.return_value = {"Count": 1}
        # act/assert
        with self.assertRaises(ResourceInUseError):
            self.dao.delete("p1")
        self.mock_projects_table.query.assert_called_once_with(
            IndexName="configProfileId-index",
            KeyConditionExpression=unittest.mock.ANY,
            ProjectionExpression="projectId"
        )

    def test_delete_calls__delete_if_no_projects(self):
        # arrange
        self.mock_projects_table.query.return_value = {"Count": 0}
        with patch.object(self.dao, "_delete") as mock_delete:
            self.dao.delete("p1")

        mock_delete.assert_called_once_with({"profileId": "p1"})
