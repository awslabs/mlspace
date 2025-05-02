import os

from ml_space_lambda.utils.exceptions import ResourceInUseError

os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import json
import unittest
from unittest.mock import patch

# pull in your module under test
from ml_space_lambda.config_profiles import lambda_functions as lf
from ml_space_lambda.data_access_objects.config_profiles import ConfigProfileModel

class MockLambdaContext:
    """Just enough of the AWS Lambda context for api_wrapper decorator."""
    def __init__(self):
        self.function_name = "test-function"

class TestConfigProfilesLambda(unittest.TestCase):

    def setUp(self):
        self.ctx = MockLambdaContext()
        # a minimal “authorizer” snippet so your decorator won't KeyError
        self.base_event = {
            "requestContext": {"authorizer": {"principalId": "test-user"}}
        }
        self.profile_id = "test-profile-id"
        self.profile_model = ConfigProfileModel(
            profile_id=self.profile_id,
            name="Test Profile",
            description="desc",
            notebook_instance_types=["ml.t2.medium"],
            training_job_instance_types=["ml.m5.large"],
            hpo_job_instance_types=["ml.m5.large"],
            transform_job_instance_types=["ml.m5.large"],
            endpoint_instance_types=["ml.m5.large"],
            created_by="test-user",
            created_at=1_234_567,
            updated_by="test-user",
            updated_at=1_234_567,
        )

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_list_profiles_success(self, mock_dao):
        # arrange
        mock_dao.list.return_value = [ self.profile_model.to_dict() ]

        # act
        resp = lf.list_profiles(self.base_event, self.ctx)

        # assert
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertEqual(body, [ self.profile_model.to_dict() ])
        mock_dao.list.assert_called_once()

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_list_profiles_error(self, mock_dao):
        mock_dao.list.side_effect = RuntimeError("failed")
        resp = lf.list_profiles(self.base_event, self.ctx)

        self.assertEqual(resp["statusCode"], 400)
        err = json.loads(resp["body"])
        # generate_exception_response usually wraps your exception in { "message": "...", ... }
        self.assertIn("failed", err )

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_get_profile_success(self, mock_dao):
        mock_dao.get.return_value = self.profile_model

        event = {
            **self.base_event,
            "pathParameters": {"profileId": self.profile_id}
        }
        resp = lf.get_profile(event, self.ctx)

        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"]), self.profile_model.to_dict())
        mock_dao.get.assert_called_once_with(self.profile_id)

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_get_profile_not_found(self, mock_dao):
        mock_dao.get.return_value = None
        event = {
            **self.base_event,
            "pathParameters": {"profileId": self.profile_id}
        }
        resp = lf.get_profile(event, self.ctx)

        self.assertEqual(resp["statusCode"], 404)
        self.assertEqual(json.loads(resp["body"]), {"message": "Profile not found"})
        mock_dao.get.assert_called_once_with(self.profile_id)

    @patch("time.time", lambda: 1_234_567)
    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_create_profile_success(self, mock_dao):
        mock_dao.create.return_value = self.profile_model

        event = {
            **self.base_event,
            "body": json.dumps({
                "name": "Test Profile",
                "description": "desc",
                "notebookInstanceTypes": ["ml.t2.medium"],
                "trainingJobInstanceTypes": ["ml.m5.large"],
                "hpoJobInstanceTypes": ["ml.m5.large"],
                "transformJobInstanceTypes": ["ml.m5.large"],
                "endpointInstanceTypes": ["ml.m5.large"],
            }),
        }
        resp = lf.create_profile(event, self.ctx)

        self.assertEqual(resp["statusCode"], 201)
        self.assertEqual(json.loads(resp["body"]), self.profile_model.to_dict())
        # ensure DAO got a model with correct audit fields
        created_model = mock_dao.create.call_args[0][0]
        self.assertEqual(created_model.created_by, "test-user")
        self.assertEqual(created_model.created_at, 1_234_567)

    @patch("time.time", lambda: 1_234_567)
    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_update_profile_success(self, mock_dao):
        mock_dao.update.return_value = self.profile_model

        event = {
            "requestContext": {
                "authorizer": {"principalId": "updated-test-user"},
            },
            "pathParameters": {"profileId": self.profile_id},
            "body": json.dumps({
                "name": "Test Profile",
                "description": "desc",
                "notebookInstanceTypes": ["ml.t2.medium"],
                "trainingJobInstanceTypes": ["ml.m5.large"],
                "hpoJobInstanceTypes": ["ml.m5.large"],
                "transformJobInstanceTypes": ["ml.m5.large"],
                "endpointInstanceTypes": ["ml.m5.large"],
            }),
        }
        resp = lf.update_profile(event, self.ctx)

        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"]), self.profile_model.to_dict())
        # ensure DAO got a model with correct audit fields
        updated_model = mock_dao.update.call_args[0][0]
        self.assertEqual(updated_model.updated_by, "updated-test-user")
        self.assertEqual(updated_model.updated_at, 1_234_567)

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_delete_profile_success(self, mock_dao):
        # delete just returns None, 204
        event = {
            **self.base_event,
            "pathParameters": {"profileId": self.profile_id}
        }
        resp = lf.delete_profile(event, self.ctx)

        self.assertEqual(resp["statusCode"], 204)
        # body will be JSON‑encoded None → "null"
        self.assertIsNone(json.loads(resp["body"]))
        mock_dao.delete.assert_called_once_with(self.profile_id)

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_delete_profile_error(self, mock_dao):
        mock_dao.delete.side_effect = ResourceInUseError("Resource in use")
        event = {
            **self.base_event,
            "pathParameters": {"profileId": self.profile_id}
        }
        resp = lf.delete_profile(event, self.ctx)

        self.assertEqual(resp["statusCode"], 409)
        err = json.loads(resp["body"])
        self.assertIn("Resource in use", err)
        mock_dao.delete.assert_called_once_with(self.profile_id)
