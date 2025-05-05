import os
import json
import unittest
from unittest.mock import patch

from ml_space_lambda.utils.exceptions import ResourceInUseError

# ensure boto3 won't complain
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

# pull in your module under test
from ml_space_lambda.config_profiles import lambda_functions as lf
from ml_space_lambda.data_access_objects.config_profiles import ConfigProfileModel

class MockLambdaContext:
    """Minimal AWS Lambda context for api_wrapper."""
    def __init__(self):
        self.function_name = "test-function"

class TestConfigProfilesLambda(unittest.TestCase):

    def setUp(self):
        self.ctx = MockLambdaContext()
        self.base_event = {
            "requestContext": {"authorizer": {"principalId": "test-user"}}
        }
        self.profile_id = "test-profile-id"
        # build a Pydantic model instance
        self.profile_model = ConfigProfileModel(
            profileId=self.profile_id,
            name="Test Profile",
            description="desc",
            notebookInstanceTypes=["ml.t2.medium"],
            trainingJobInstanceTypes=["ml.m5.large"],
            hpoJobInstanceTypes=["ml.m5.large"],
            transformJobInstanceTypes=["ml.m5.large"],
            endpointInstanceTypes=["ml.m5.large"],
            createdBy="test-user",
            createdAt=1_234_567,
            updatedBy="test-user",
            updatedAt=1_234_567,
        )
        # its JSON‑serializable form:
        self.profile_dict = self.profile_model.dict(
            by_alias=True, exclude_none=True
        )

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_list_profiles_success(self, mock_dao):
        # arrange: DAO returns list of dicts
        mock_dao.list.return_value = [self.profile_dict]

        # act
        resp = lf.list_profiles(self.base_event, self.ctx)

        # assert
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertEqual(body, [self.profile_dict])
        mock_dao.list.assert_called_once()

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_list_profiles_error(self, mock_dao):
        mock_dao.list.side_effect = RuntimeError("failed")
        resp = lf.list_profiles(self.base_event, self.ctx)

        self.assertEqual(resp["statusCode"], 400)
        err = json.loads(resp["body"])
        self.assertIn("failed", err)

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_get_profile_success(self, mock_dao):
        mock_dao.get.return_value = self.profile_model

        event = {
            **self.base_event,
            "pathParameters": {"profileId": self.profile_id}
        }
        resp = lf.get_profile(event, self.ctx)

        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"]), self.profile_dict)
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
        self.assertEqual(
            json.loads(resp["body"]),
            {"message": "Profile not found"}
        )
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
        self.assertEqual(json.loads(resp["body"]), self.profile_dict)

        # verify the DAO.create saw a Pydantic model with correct audit fields
        created_model = mock_dao.create.call_args[0][0]
        self.assertIsInstance(created_model, ConfigProfileModel)
        self.assertEqual(created_model.createdBy, "test-user")
        self.assertEqual(created_model.createdAt, 1_234_567)
        self.assertEqual(created_model.updatedBy, "test-user")
        self.assertEqual(created_model.updatedAt, 1_234_567)

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
        self.assertEqual(json.loads(resp["body"]), self.profile_dict)

        updated_model = mock_dao.update.call_args[0][0]
        self.assertIsInstance(updated_model, ConfigProfileModel)
        self.assertEqual(updated_model.updatedBy, "updated-test-user")
        self.assertEqual(updated_model.updatedAt, 1_234_567)

    @patch.object(lf, "config_profiles_dao", autospec=True)
    def test_delete_profile_success(self, mock_dao):
        event = {
            **self.base_event,
            "pathParameters": {"profileId": self.profile_id}
        }
        resp = lf.delete_profile(event, self.ctx)

        self.assertEqual(resp["statusCode"], 204)
        # body is JSON‑encoded None → "null"
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
        self.assertIn("Resource in use", err.get("message", ""))
        mock_dao.delete.assert_called_once_with(self.profile_id)
