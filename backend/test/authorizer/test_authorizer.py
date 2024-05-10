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

import copy
import json
import urllib
from datetime import datetime, timedelta, timezone
from typing import Dict
from unittest import mock

import jwt
import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.resource_metadata import ResourceMetadataModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.enums import DatasetType, Permission, ResourceType, ServiceType

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "OIDC_VERIFY_SIGNATURE": "False"}
MOCK_OIDC_ENV = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "OIDC_URL": "https://example-oidc.com/realms/mlspace",
    "OIDC_CLIENT_NAME": "web-client",
    # We're using a self signed cert for dev
    "OIDC_VERIFY_SSL": "False",
}


with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.authorizer.lambda_function import lambda_handler
    from ml_space_lambda.utils.app_config_utils import get_app_config

MOCK_USERNAME = "test@amazon.com"

MOCK_ADMIN_USER = UserModel("admin", "admin@amazon.com", "Admin User", False, [Permission.ADMIN])
MOCK_SUSPENDED_USER = UserModel("badguy", "badguy@amazon.com", "Bad Guy", True, [])
MOCK_OWNER_USER = UserModel("resource_owner", "owner@amazon.com", "Resource Owner", False, [])
MOCK_USER = UserModel("jdoe", "jdoe@amazon.com", "John Doe", False, [])

MOCK_PROJECT_NAME = "UnitTestProject"
MOCK_JOB_NAME = "UnitTestJob"
MOCK_REPORT_NAME = "UnitTestReport"
MOCK_SUSPENDED_PROJECT_NAME = "SuspendedTestProject"
MOCK_PROJECT = ProjectModel(MOCK_PROJECT_NAME, "Project used for unit tests", False, MOCK_OWNER_USER.username)
MOCK_SUSPENDED_PROJECT = ProjectModel(
    MOCK_SUSPENDED_PROJECT_NAME,
    "Suspended project used for unit tests",
    True,
    MOCK_OWNER_USER.username,
)
MOCK_OWNER_PROJECT_USER = ProjectUserModel(MOCK_OWNER_USER.username, MOCK_PROJECT_NAME, permissions=[Permission.PROJECT_OWNER])
MOCK_REGULAR_PROJECT_USER = ProjectUserModel(MOCK_USER.username, MOCK_PROJECT_NAME, permissions=[Permission.COLLABORATOR])


def policy_response(
    allow: bool = True,
    user: UserModel = None,
    project: ProjectModel = None,
    username: str = MOCK_USERNAME,
    valid_token: bool = True,
):
    response_context = {}
    principal_id = "Unknown"
    if valid_token:
        principal_id = user.username if user else username
        if user and not user.suspended:
            response_context = {"user": json.dumps(user.to_dict())}
        if project:
            response_context["projectName"] = project.name

    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": "Allow" if allow else "Deny",
                    "Resource": "fakeArn",
                }
            ],
        },
        "context": response_context,
    }


def mock_event(
    method: str = "GET",
    path_params: Dict[str, str] = {},
    resource: str = "/fake-resource",
    expired_token: bool = False,
    user: UserModel = None,
    headers: Dict[str, str] = {},
    username: str = MOCK_USERNAME,
    kid: str = "GLptrSDjXhtLZfjbgEjpmZy4r6CtwWnNg6k-Oyfd864",
):
    now = datetime.now(tz=timezone.utc)
    exp_time = now if expired_token else now + timedelta(minutes=60)
    with open("test/authorizer/jwtRS256.key") as rsa_key:
        encoded_jwt = jwt.encode(
            {
                "aud": "web-client",
                "exp": exp_time,
                "preferred_username": user.username if user else username,
                "email": user.email if user else username,
            },
            rsa_key.read(),
            algorithm="RS256",
            headers={"kid": kid},
        )

    headers["authorization"] = f"Bearer {encoded_jwt}"
    return {
        "resource": resource,
        "pathParameters": path_params,
        "httpMethod": method,
        "methodArn": "fakeArn",
        "headers": headers,
    }


def generate_test_config(config_scope: str = "global", is_project: bool = False, admin_only: bool = False) -> dict:
    config = {
        "configScope": config_scope,
        "versionId": 1,
        "changeReason": "Testing",
        "changedBy": "Tester",
        "createdAt": 1,
        "configuration": {
            "DisabledInstanceTypes": {
                ServiceType.NOTEBOOK.value: [],
                ServiceType.ENDPOINT.value: [],
                ServiceType.TRAINING_JOB.value: [],
                ServiceType.TRANSFORM_JOB.value: [],
            },
            "EnabledServices": {
                ServiceType.REALTIME_TRANSLATE.value: "true",
                ServiceType.BATCH_TRANSLATE.value: "false",
                ServiceType.LABELING_JOB.value: "true",
                ServiceType.EMR_CLUSTER.value: "true",
                ServiceType.ENDPOINT.value: "true",
                ServiceType.ENDPOINT_CONFIG.value: "false",
                ServiceType.HPO_JOB.value: "true",
                ServiceType.MODEL.value: "true",
                ServiceType.NOTEBOOK.value: "false",
                ServiceType.TRAINING_JOB.value: "true",
                ServiceType.TRANSFORM_JOB.value: "true",
            },
            "EMRConfig": {
                "clusterSizes": [
                    {"name": "Small", "size": 3, "masterType": "m5.xlarge", "coreType": "m5.xlarge"},
                ],
                "autoScaling": {
                    "minInstances": 2,
                    "maxInstances": 15,
                    "scaleOut": {"increment": 1, "percentageMemAvailable": 15, "evalPeriods": 1, "cooldown": 300},
                    "scaleIn": {"increment": -1, "percentageMemAvailable": 75, "evalPeriods": 1, "cooldown": 300},
                },
                "applications": [
                    {"name": "Hadoop"},
                    {"name": "Spark"},
                ],
            },
        },
    }
    # If this config is not for a project, add the app-wide specific configurations
    if not is_project:
        config["configuration"]["ProjectCreation"] = {
            "isAdminOnly": admin_only,
            "allowedGroups": ["Justice League", "Avengers", "TMNT"],
        }
        config["configuration"]["SystemBanner"] = {
            "isEnabled": "true",
            "textColor": "Red",
            "backgroundColor": "White",
            "text": "Jeff Bezos",
        }

    return config


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_missing_auth_header():
    assert lambda_handler(
        {
            "resource": "/fake-resource",
            "pathParameters": {},
            "httpMethod": "GET",
            "methodArn": "fakeArn",
            "headers": {},
        },
        {},
    ) == policy_response(allow=False, valid_token=False)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_invalid_auth_header():
    assert lambda_handler(
        {
            "resource": "/fake-resource",
            "pathParameters": {},
            "httpMethod": "GET",
            "methodArn": "fakeArn",
            "headers": {"authorization": "Bearer "},
        },
        {},
    ) == policy_response(allow=False, valid_token=False)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.jwt")
def test_malformed_token(mock_jwt):
    mock_jwt.decode.side_effect = Exception("DecodeError")
    assert lambda_handler(
        {
            "resource": "/fake-resource",
            "pathParameters": {},
            "httpMethod": "GET",
            "methodArn": "fakeArn",
            "headers": {"authorization": "Bearer asdf"},
        },
        {},
    ) == policy_response(allow=False, valid_token=False)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_expired_token():
    assert lambda_handler(mock_event(expired_token=True), {}) == policy_response(allow=False)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_initcap_header(mock_user_dao):
    mock_user_dao.get.return_value = MOCK_ADMIN_USER
    mock_event_body = copy.deepcopy(
        mock_event(
            user=MOCK_ADMIN_USER,
            resource="/current-user",
            method="GET",
        )
    )
    mock_event_body["headers"]["Authorization"] = mock_event_body["headers"]["authorization"]
    del mock_event_body["headers"]["authorization"]

    assert lambda_handler(
        mock_event_body,
        {},
    ) == policy_response(user=MOCK_ADMIN_USER)
    mock_user_dao.get.assert_called_with(MOCK_ADMIN_USER.username)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_nonexistent_user(mock_user_dao):
    mock_user_dao.get.return_value = None
    assert lambda_handler(mock_event(), {}) == policy_response(allow=False)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_suspended_user(mock_user_dao):
    mock_user_dao.get.return_value = MOCK_SUSPENDED_USER
    assert lambda_handler(mock_event(user=MOCK_SUSPENDED_USER), {}) == policy_response(allow=False, user=MOCK_SUSPENDED_USER)
    mock_user_dao.get.assert_called_with(MOCK_SUSPENDED_USER.username)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_create_user(mock_user_dao):
    mock_user_dao.get.return_value = None
    new_username = "new-user"
    assert lambda_handler(
        mock_event(
            resource="/user",
            method="POST",
            username=new_username,
        ),
        {},
    ) == policy_response(username=new_username)
    mock_user_dao.get.assert_called_with(new_username)


@pytest.mark.parametrize(
    "user,method,allow",
    [
        (MOCK_ADMIN_USER, "DELETE", True),
        (MOCK_ADMIN_USER, "PUT", True),
        (MOCK_OWNER_USER, "DELETE", False),
        (MOCK_OWNER_USER, "PUT", False),
        (MOCK_USER, "DELETE", False),
        (MOCK_USER, "PUT", True),
    ],
    ids=[
        "admin_delete_user",
        "admin_update_user",
        "non_admin_delete_user",
        "non_admin_update_user",
        "user_delete_self",
        "user_update_self",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_user_management(mock_user_dao, user: UserModel, method: str, allow: bool):
    mock_user_dao.get.return_value = user
    assert lambda_handler(
        mock_event(
            user=user,
            resource=f"/user/{MOCK_USER.username}",
            method=method,
            path_params={"username": MOCK_USER.username},
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)


@pytest.mark.parametrize(
    "user,project_user,method,allow",
    [
        (MOCK_ADMIN_USER, None, "DELETE", True),
        (MOCK_ADMIN_USER, None, "PUT", True),
        (MOCK_ADMIN_USER, None, "GET", True),
        (MOCK_OWNER_USER, MOCK_OWNER_PROJECT_USER, "DELETE", True),
        (MOCK_OWNER_USER, MOCK_OWNER_PROJECT_USER, "PUT", True),
        (MOCK_OWNER_USER, MOCK_OWNER_PROJECT_USER, "GET", True),
        (MOCK_USER, None, "DELETE", False),
        (MOCK_USER, None, "PUT", False),
        (MOCK_USER, None, "GET", False),
        (MOCK_USER, MOCK_REGULAR_PROJECT_USER, "DELETE", False),
        (MOCK_USER, MOCK_REGULAR_PROJECT_USER, "PUT", False),
        (MOCK_USER, MOCK_REGULAR_PROJECT_USER, "GET", True),
    ],
    ids=[
        "admin_delete_project",
        "admin_update_project",
        "admin_get_project",
        "owner_delete_project",
        "owner_update_project",
        "owner_get_project",
        "non_member_delete_project",
        "non_member_update_project",
        "non_member_get_project",
        "member_delete_project",
        "member_update_project",
        "member_get_project",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_project_management(
    mock_user_dao,
    mock_project_user_dao,
    user: UserModel,
    project_user: ProjectUserModel,
    method: str,
    allow: bool,
):
    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = project_user

    assert lambda_handler(
        mock_event(
            user=user,
            resource=f"/project/{MOCK_PROJECT_NAME}",
            method=method,
            path_params={"projectName": MOCK_PROJECT_NAME},
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)


@pytest.mark.parametrize(
    "user,project_user,key,resource,allow",
    [
        (MOCK_USER, None, "global/datasets/test-dataset/example.txt", "presigned-url", True),
        (
            MOCK_ADMIN_USER,
            None,
            f"project/{MOCK_PROJECT_NAME}/test-dataset/example.txt",
            "presigned-url",
            True,
        ),
        (
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            f"project/{MOCK_PROJECT_NAME}/datasets/test-dataset/example.txt",
            "presigned-url",
            True,
        ),
        (
            MOCK_USER,
            None,
            f"project/{MOCK_PROJECT_NAME}/datasets/test-dataset/example.txt",
            "presigned-url",
            False,
        ),
        (
            MOCK_USER,
            None,
            f"private/{MOCK_USER.username}/datasets/test-dataset/example.txt",
            "presigned-url",
            True,
        ),
        (
            MOCK_USER,
            None,
            f"private/{MOCK_ADMIN_USER.username}/datasets/test-dataset/example.txt",
            "presigned-url",
            False,
        ),
        (MOCK_USER, None, "global/datasets/test-dataset/", "create", True),
        (
            MOCK_ADMIN_USER,
            None,
            f"project/{MOCK_PROJECT_NAME}/test-dataset/",
            "create",
            True,
        ),
        (
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            f"project/{MOCK_PROJECT_NAME}/datasets/test-dataset/",
            "create",
            True,
        ),
        (
            MOCK_USER,
            None,
            f"project/{MOCK_PROJECT_NAME}/datasets/test-dataset/",
            "create",
            False,
        ),
        (
            MOCK_USER,
            None,
            f"private/{MOCK_USER.username}/datasets/test-dataset/",
            "create",
            True,
        ),
        (
            MOCK_USER,
            None,
            f"private/{MOCK_ADMIN_USER.username}/datasets/test-dataset/",
            "create",
            False,
        ),
    ],
    ids=[
        "global_dataset_presigned_url",
        "project_dataset_admin_presigned_url",
        "project_dataset_member_presigned_url",
        "project_dataset_non_member_presigned_url",
        "private_same_user_presigned_url",
        "private_different_user_presigned_url",
        "global_dataset_create_dataset",
        "project_dataset_admin_create_dataset",
        "project_dataset_member_create_dataset",
        "project_dataset_non_member_create_dataset",
        "private_same_user_create_dataset",
        "private_different_user_create_dataset",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_generate_presigned_dataset_url(
    mock_user_dao,
    mock_project_user_dao,
    user: UserModel,
    project_user: ProjectUserModel,
    key: str,
    resource: str,
    allow: bool,
):
    mock_type = key.split("/")[0]
    mock_scope = key.split("/")[1]
    mock_user_dao.get.return_value = user
    if key.startswith("project") and user.username != MOCK_ADMIN_USER.username:
        mock_project_user_dao.get.return_value = project_user
    assert lambda_handler(
        mock_event(
            user=user,
            resource=f"/dataset/{resource}",
            method="POST",
            headers={
                "x-mlspace-dataset-type": mock_type,
                "x-mlspace-dataset-scope": mock_scope,
            },
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)
    if key.startswith("project") and user.username != MOCK_ADMIN_USER.username:
        mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)
    else:
        mock_project_user_dao.get.assert_not_called()


@pytest.mark.parametrize(
    "resource,user,project_user,allow",
    [
        ("/job/training", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/training", MOCK_USER, None, False),
        ("/job/training", MOCK_ADMIN_USER, None, False),
        ("/job/transform", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/transform", MOCK_USER, None, False),
        ("/job/transform", MOCK_ADMIN_USER, None, False),
        ("/job/hpo", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/hpo", MOCK_USER, None, False),
        ("/job/hpo", MOCK_ADMIN_USER, None, False),
        ("/job/labeling", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/labeling", MOCK_USER, None, False),
        ("/job/labeling", MOCK_ADMIN_USER, None, False),
        ("/emr", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/emr", MOCK_USER, None, False),
        ("/emr", MOCK_ADMIN_USER, None, False),
        ("/batch-translate", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/batch-translate", MOCK_USER, None, False),
        ("/notebook", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/notebook", MOCK_USER, None, False),
        ("/notebook", MOCK_ADMIN_USER, None, False),
        ("/model", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/model", MOCK_USER, None, False),
        ("/model", MOCK_ADMIN_USER, None, False),
        ("/endpoint-config", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/endpoint-config", MOCK_USER, None, False),
        ("/endpoint-config", MOCK_ADMIN_USER, None, False),
        ("/endpoint", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/endpoint", MOCK_USER, None, False),
        ("/endpoint", MOCK_ADMIN_USER, None, False),
    ],
    ids=[
        "training_job_project_user",
        "training_job_non_project_user",
        "training_job_non_project_admin",
        "transform_job_project_user",
        "transform_job_non_project_user",
        "transform_job_non_project_admin",
        "hpo_job_project_user",
        "hpo_job_non_project_user",
        "hpo_job_non_project_admin",
        "labeling_job_project_user",
        "labeling_job_non_project_user",
        "labeling_job_non_project_admin",
        "emr_project_user",
        "emr_non_project_user",
        "emr_non_project_admin",
        "batch-translate_project_user",
        "batch-translate_non_project_user",
        "notebook_project_user",
        "notebook_non_project_user",
        "notebook_non_project_admin",
        "model_project_user",
        "model_non_project_user",
        "model_non_project_admin",
        "endpoint_config_project_user",
        "endpoint_config_non_project_user",
        "endpoint_config_non_project_admin",
        "endpoint_project_user",
        "endpoint_non_project_user",
        "endpoint_non_project_admin",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_create_project_resource(
    mock_user_dao,
    mock_project_user_dao,
    resource: str,
    user: UserModel,
    project_user: ProjectUserModel,
    allow: bool,
):
    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = project_user
    assert lambda_handler(
        mock_event(
            user=user,
            resource=resource,
            method="POST",
            headers={"x-mlspace-project": MOCK_PROJECT_NAME},
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)


@pytest.mark.parametrize(
    "resource,path_param_key,user,project_user,allow",
    [
        ("/job/training/fakeResourceName", "jobName", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/training/fakeResourceName", "jobName", MOCK_USER, None, False),
        ("/job/training/fakeResourceName", "jobName", MOCK_ADMIN_USER, None, True),
        ("/job/training/fakeResourceName", "jobName", MOCK_OWNER_USER, None, False),
        (
            "/job/training/fakeResourceName",
            "jobName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/job/transform/fakeResourceName", "jobName", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/transform/fakeResourceName", "jobName", MOCK_USER, None, False),
        ("/job/transform/fakeResourceName", "jobName", MOCK_ADMIN_USER, None, True),
        ("/job/transform/fakeResourceName", "jobName", MOCK_OWNER_USER, None, False),
        (
            "/job/transform/fakeResourceName",
            "jobName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/job/hpo/fakeResourceName", "jobName", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/hpo/fakeResourceName", "jobName", MOCK_USER, None, False),
        ("/job/hpo/fakeResourceName", "jobName", MOCK_ADMIN_USER, None, True),
        ("/job/hpo/fakeResourceName", "jobName", MOCK_OWNER_USER, None, False),
        ("/job/hpo/fakeResourceName", "jobName", MOCK_OWNER_USER, MOCK_REGULAR_PROJECT_USER, True),
        (
            "/job/hpo/fakeResourceName/training-jobs",
            "jobName",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/job/hpo/fakeResourceName/training-jobs", "jobName", MOCK_USER, None, False),
        ("/job/hpo/fakeResourceName/training-jobs", "jobName", MOCK_ADMIN_USER, None, True),
        ("/job/hpo/fakeResourceName/training-jobs", "jobName", MOCK_OWNER_USER, None, False),
        (
            "/job/hpo/fakeResourceName/training-jobs",
            "jobName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/job/labeling/fakeResourceName", "jobName", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/labeling/fakeResourceName", "jobName", MOCK_USER, None, False),
        ("/job/labeling/fakeResourceName", "jobName", MOCK_ADMIN_USER, None, True),
        ("/job/labeling/fakeResourceName", "jobName", MOCK_OWNER_USER, None, False),
        (
            "/job/labeling/fakeResourceName",
            "jobName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/emr/fakeResourceName", "clusterId", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/emr/fakeResourceName", "clusterId", MOCK_USER, None, False),
        ("/emr/fakeResourceName", "clusterId", MOCK_ADMIN_USER, None, True),
        ("/emr/fakeResourceName", "clusterId", MOCK_OWNER_USER, None, False),
        ("/emr/fakeResourceName", "clusterId", MOCK_OWNER_USER, MOCK_REGULAR_PROJECT_USER, True),
        (
            "/emr/fakeResourceName/schedule",
            "clusterId",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
        ),
        ("/emr/fakeResourceName/schedule", "clusterId", MOCK_USER, None, False),
        ("/emr/fakeResourceName/schedule", "clusterId", MOCK_ADMIN_USER, None, True),
        ("/emr/fakeResourceName/schedule", "clusterId", MOCK_OWNER_USER, None, False),
        (
            "/emr/fakeResourceName/schedule",
            "clusterId",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/batch-translate/fakeJobId", "jobId", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/batch-translate/fakeJobId", "jobId", MOCK_USER, None, False),
        ("/batch-translate/fakeJobId", "jobId", MOCK_ADMIN_USER, None, True),
        ("/batch-translate/fakeJobId", "jobId", MOCK_OWNER_USER, None, False),
        ("/batch-translate/fakeJobId", "jobId", MOCK_OWNER_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/notebook/fakeResourceName", "notebookName", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/notebook/fakeResourceName", "notebookName", MOCK_USER, None, False),
        ("/notebook/fakeResourceName", "notebookName", MOCK_ADMIN_USER, None, True),
        ("/notebook/fakeResourceName", "notebookName", MOCK_OWNER_USER, None, False),
        (
            "/notebook/fakeResourceName",
            "notebookName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        (
            "/notebook/fakeResourceName/schedule",
            "notebookName",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
        ),
        ("/notebook/fakeResourceName/schedule", "notebookName", MOCK_USER, None, False),
        ("/notebook/fakeResourceName/schedule", "notebookName", MOCK_ADMIN_USER, None, True),
        ("/notebook/fakeResourceName/schedule", "notebookName", MOCK_OWNER_USER, None, False),
        (
            "/notebook/fakeResourceName/schedule",
            "notebookName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/model/fakeResourceName", "modelName", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/model/fakeResourceName", "modelName", MOCK_USER, None, False),
        ("/model/fakeResourceName", "modelName", MOCK_ADMIN_USER, None, True),
        ("/model/fakeResourceName", "modelName", MOCK_OWNER_USER, None, False),
        ("/model/fakeResourceName", "modelName", MOCK_OWNER_USER, MOCK_REGULAR_PROJECT_USER, True),
        (
            "/endpoint-config/fakeResourceName",
            "endpointConfigName",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/endpoint-config/fakeResourceName", "endpointConfigName", MOCK_USER, None, False),
        ("/endpoint-config/fakeResourceName", "endpointConfigName", MOCK_ADMIN_USER, None, True),
        ("/endpoint-config/fakeResourceName", "endpointConfigName", MOCK_OWNER_USER, None, False),
        (
            "/endpoint-config/fakeResourceName",
            "endpointConfigName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/endpoint/fakeResourceName", "endpointName", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/endpoint/fakeResourceName", "endpointName", MOCK_USER, None, False),
        ("/endpoint/fakeResourceName", "endpointName", MOCK_ADMIN_USER, None, True),
        ("/endpoint/fakeResourceName", "endpointName", MOCK_OWNER_USER, None, False),
        (
            "/endpoint/fakeResourceName",
            "endpointName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        (
            "/endpoint/fakeResourceName/schedule",
            "endpointName",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
        ),
        ("/endpoint/fakeResourceName/schedule", "endpointName", MOCK_USER, None, False),
        ("/endpoint/fakeResourceName/schedule", "endpointName", MOCK_ADMIN_USER, None, True),
        (
            "/endpoint/fakeResourceName/schedule",
            "endpointName",
            MOCK_OWNER_USER,
            None,
            False,
        ),
        (
            "/endpoint/fakeResourceName/schedule",
            "endpointName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        ("/job/labeling/fakeResourceName", "jobName", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        ("/job/labeling/fakeResourceName", "jobName", MOCK_USER, None, False),
        ("/job/labeling/fakeResourceName", "jobName", MOCK_ADMIN_USER, None, True),
        ("/job/labeling/fakeResourceName", "jobName", MOCK_OWNER_USER, None, False),
        (
            "/job/labeling/fakeResourceName",
            "jobName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
    ],
    ids=[
        "training_job_project_user",
        "training_job_non_project_user",
        "training_job_non_project_admin",
        "training_job_resource_owner_no_longer_in_project",
        "training_job_resource_owner",
        "transform_job_project_user",
        "transform_job_non_project_user",
        "transform_job_non_project_admin",
        "transform_job_resource_owner_no_longer_in_project",
        "transform_job_resource_owner",
        "hpo_job_project_user",
        "hpo_job_non_project_user",
        "hpo_job_non_project_admin",
        "hpo_job_resource_owner_no_longer_in_project",
        "hpo_job_resource_owner",
        "hpo_training_jobs_project_user",
        "hpo_training_jobs_non_project_user",
        "hpo_training_jobs_non_project_admin",
        "hpo_training_jobs_resource_owner_no_longer_in_project",
        "hpo_training_jobs_resource_owner",
        "labeling_job_project_user",
        "labeling_job_non_project_user",
        "labeling_job_non_project_admin",
        "labeling_job_resource_owner_no_longer_in_project",
        "labeling_job_resource_owner",
        "emr_project_user",
        "emr_non_project_user",
        "emr_non_project_admin",
        "emr_resource_owner_no_longer_in_project",
        "emr_resource_owner",
        "emr_termination_schedule_project_user",
        "emr_termination_schedule_non_project_user",
        "emr_termination_schedule_non_project_admin",
        "emr_termination_schedule_resource_owner_no_longer_in_project",
        "emr_termination_schedule_resource_owner",
        "batch_translate_project_user",
        "batch_translate_non_project_user",
        "batch_translate_non_project_admin",
        "batch_translate_resource_owner_no_longer_in_project",
        "batch_translate_resource_owner",
        "notebook_project_user",
        "notebook_non_project_user",
        "notebook_non_project_admin",
        "notebook_resource_owner_no_longer_in_project",
        "notebook_resource_owner",
        "notebook_termination_schedule_project_user",
        "notebook_termination_schedule_non_project_user",
        "notebook_termination_schedule_non_project_admin",
        "notebook_termination_schedule_resource_owner_no_longer_in_project",
        "notebook_termination_schedule_resource_owner",
        "model_project_user",
        "model_non_project_user",
        "model_non_project_admin",
        "model_resource_owner_no_longer_in_project",
        "model_resource_owner",
        "endpoint_config_project_user",
        "endpoint_config_non_project_user",
        "endpoint_config_non_project_admin",
        "endpoint_config_resource_owner_no_longer_in_project",
        "endpoint_config_resource_owner",
        "endpoint_project_user",
        "endpoint_non_project_user",
        "endpoint_non_project_admin",
        "endpoint_resource_owner_no_longer_in_project",
        "endpoint_resource_owner",
        "endpoint_termination_schedule_project_user",
        "endpoint_termination_schedule_non_project_user",
        "endpoint_termination_schedule_non_project_admin",
        "endpoint_termination_schedule_resource_owner_no_longer_in_project",
        "endpoint_termination_schedule_resource_owner",
        "labeling_job_project_user",
        "labeling_job_non_project_user",
        "labeling_job_non_project_admin",
        "labeling_job_resource_owner_no_longer_in_project",
        "labeling_job_resource_owner",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.resource_metadata_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_dao")
def test_get_project_sagemaker_resource(
    mock_project_dao,
    mock_user_dao,
    mock_project_user_dao,
    mock_resource_metadata_dao,
    resource: str,
    path_param_key: str,
    user: UserModel,
    project_user: ProjectUserModel,
    allow: bool,
):
    path_params = {}
    path_params[path_param_key] = "fakeResourceName"

    metadata_resource_type = None
    if path_param_key == "endpointName":
        metadata_resource_type = ResourceType.ENDPOINT
    elif path_param_key == "endpointConfigName":
        metadata_resource_type = ResourceType.ENDPOINT_CONFIG
    elif path_param_key == "modelName":
        metadata_resource_type = ResourceType.MODEL
    elif path_param_key == "notebookName":
        mock_project_dao.get.return_value = MOCK_PROJECT
        metadata_resource_type = ResourceType.NOTEBOOK
    elif path_param_key == "jobId":
        metadata_resource_type = ResourceType.BATCH_TRANSLATE_JOB
    elif path_param_key == "clusterId":
        metadata_resource_type = ResourceType.EMR_CLUSTER
    elif path_param_key == "jobName":
        if resource.startswith("/job/training/"):
            metadata_resource_type = ResourceType.TRAINING_JOB
        elif resource.startswith("/job/transform/"):
            metadata_resource_type = ResourceType.TRANSFORM_JOB
        elif resource.startswith("/job/hpo/"):
            metadata_resource_type = ResourceType.HPO_JOB
        elif resource.startswith("/job/labeling"):
            metadata_resource_type = ResourceType.LABELING_JOB

    if metadata_resource_type:
        mock_resource_metadata_dao.get.return_value = ResourceMetadataModel(
            path_params[path_param_key],
            metadata_resource_type,
            MOCK_OWNER_USER.username,
            MOCK_PROJECT_NAME,
            {},
        )

    mock_user_dao.get.return_value = user

    if user.username not in [MOCK_ADMIN_USER.username]:
        mock_project_user_dao.get.return_value = project_user

    project_in_context = False
    if (metadata_resource_type or resource.endswith("/schedule")) and (
        metadata_resource_type
        not in [
            ResourceType.HPO_JOB,
            ResourceType.TRAINING_JOB,
            ResourceType.TRANSFORM_JOB,
            ResourceType.BATCH_TRANSLATE_JOB,
            ResourceType.LABELING_JOB,
        ]
        or user.username != MOCK_ADMIN_USER.username
    ):
        project_in_context = True
    mock_method = "PUT" if resource.endswith("/schedule") else "GET"
    assert lambda_handler(
        mock_event(
            user=user,
            resource=resource,
            method=mock_method,
            path_params=path_params,
        ),
        {},
    ) == policy_response(
        allow=allow,
        user=user,
        project=MOCK_PROJECT if project_in_context else None,
    )

    mock_user_dao.get.assert_called_with(user.username)

    if user.username != MOCK_ADMIN_USER.username:
        mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)
    else:
        mock_project_user_dao.get.assert_not_called()

    if metadata_resource_type:
        if not (
            metadata_resource_type
            in [
                ResourceType.HPO_JOB,
                ResourceType.TRAINING_JOB,
                ResourceType.TRANSFORM_JOB,
                ResourceType.BATCH_TRANSLATE_JOB,
                ResourceType.LABELING_JOB,
                ResourceType.EMR_CLUSTER,
            ]
            and user.username == MOCK_ADMIN_USER.username
        ):
            mock_resource_metadata_dao.get.assert_called_with(path_params[path_param_key], metadata_resource_type)


@pytest.mark.parametrize(
    "method,resource,path_param_key,user,project_user,allow",
    [
        # Notebooks are a special snowflake and handled in separate tests below
        ("DELETE", "/model/fakeResourceName", "modelName", MOCK_USER, None, False),
        ("DELETE", "/model/fakeResourceName", "modelName", MOCK_ADMIN_USER, None, True),
        ("DELETE", "/model/fakeResourceName", "modelName", MOCK_OWNER_USER, None, False),
        (
            "DELETE",
            "/model/fakeResourceName",
            "modelName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        (
            "DELETE",
            "/model/fakeResourceName",
            "modelName",
            MOCK_USER,
            MOCK_OWNER_PROJECT_USER,
            True,
        ),
        (
            "DELETE",
            "/endpoint-config/fakeResourceName",
            "endpointConfigName",
            MOCK_USER,
            None,
            False,
        ),
        (
            "DELETE",
            "/endpoint-config/fakeResourceName",
            "endpointConfigName",
            MOCK_ADMIN_USER,
            None,
            True,
        ),
        (
            "DELETE",
            "/endpoint-config/fakeResourceName",
            "endpointConfigName",
            MOCK_OWNER_USER,
            None,
            False,
        ),
        (
            "DELETE",
            "/endpoint-config/fakeResourceName",
            "endpointConfigName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        (
            "DELETE",
            "/endpoint-config/fakeResourceName",
            "endpointConfigName",
            MOCK_USER,
            MOCK_OWNER_PROJECT_USER,
            True,
        ),
        ("DELETE", "/endpoint/fakeResourceName", "endpointName", MOCK_USER, None, False),
        ("DELETE", "/endpoint/fakeResourceName", "endpointName", MOCK_ADMIN_USER, None, True),
        ("DELETE", "/endpoint/fakeResourceName", "endpointName", MOCK_OWNER_USER, None, False),
        (
            "DELETE",
            "/endpoint/fakeResourceName",
            "endpointName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        (
            "DELETE",
            "/endpoint/fakeResourceName",
            "endpointName",
            MOCK_USER,
            MOCK_OWNER_PROJECT_USER,
            True,
        ),
        ("PUT", "/endpoint/fakeResourceName", "endpointName", MOCK_USER, None, False),
        ("PUT", "/endpoint/fakeResourceName", "endpointName", MOCK_ADMIN_USER, None, True),
        ("PUT", "/endpoint/fakeResourceName", "endpointName", MOCK_OWNER_USER, None, False),
        (
            "PUT",
            "/endpoint/fakeResourceName",
            "endpointName",
            MOCK_OWNER_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        (
            "PUT",
            "/endpoint/fakeResourceName",
            "endpointName",
            MOCK_USER,
            MOCK_OWNER_PROJECT_USER,
            True,
        ),
    ],
    ids=[
        "delete_model_non_project_user",
        "delete_model_non_project_admin",
        "delete_model_resource_owne_not_in_project",
        "delete_model_resource_owner",
        "delete_model_project_owner",
        "delete_endpoint_config_non_project_user",
        "delete_endpoint_config_non_project_admin",
        "delete_endpoint_config_resource_owner_not_in_project",
        "delete_endpoint_config_resource_owner",
        "delete_endpoint_config_project_owner",
        "delete_endpoint_non_project_user",
        "delete_endpoint_non_project_admin",
        "delete_endpoint_resource_owner_not_in_project",
        "delete_endpoint_resource_owner",
        "delete_endpoint_project_owner",
        "update_endpoint_non_project_user",
        "update_endpoint_non_project_admin",
        "update_endpoint_resource_owner_not_in_project",
        "update_endpoint_resource_owner",
        "update_endpoint_project_owner",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.resource_metadata_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_manage_project_sagemaker_resource(
    mock_user_dao,
    mock_project_user_dao,
    mock_resource_metadadata_dao,
    method: str,
    resource: str,
    path_param_key: str,
    user: UserModel,
    project_user: ProjectUserModel,
    allow: bool,
):
    metadata_resource_type = None
    if path_param_key == "modelName":
        metadata_resource_type = ResourceType.MODEL
    elif path_param_key == "endpointName":
        metadata_resource_type = ResourceType.ENDPOINT
    elif path_param_key == "endpointConfigName":
        metadata_resource_type = ResourceType.ENDPOINT_CONFIG

    mock_resource_metadadata_dao.get.return_value = ResourceMetadataModel(
        "fakeResourceName",
        metadata_resource_type,
        MOCK_OWNER_USER.username,
        MOCK_PROJECT_NAME,
        {},
    )

    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = project_user

    path_params = {}
    path_params[path_param_key] = "fakeResourceName"

    assert lambda_handler(
        mock_event(user=user, resource=resource, method=method, path_params=path_params),
        {},
    ) == policy_response(allow=allow, user=user, project=MOCK_PROJECT)

    mock_user_dao.get.assert_called_with(user.username)

    if user.username != MOCK_ADMIN_USER.username:
        mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)

    mock_resource_metadadata_dao.get.assert_called_with("fakeResourceName", metadata_resource_type)


@pytest.mark.parametrize(
    "resource,user,project_user,allow",
    [
        (f"/project/{MOCK_PROJECT_NAME}/jobs/training", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/training", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/training", MOCK_ADMIN_USER, None, True),
        (
            f"/project/{MOCK_PROJECT_NAME}/jobs/transform",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/transform", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/transform", MOCK_ADMIN_USER, None, True),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/hpo", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/hpo", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/hpo", MOCK_ADMIN_USER, None, True),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/labeling", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/labeling", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/labeling", MOCK_ADMIN_USER, None, True),
        (f"/project/{MOCK_PROJECT_NAME}/notebooks", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        (f"/project/{MOCK_PROJECT_NAME}/notebooks", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/notebooks", MOCK_ADMIN_USER, None, True),
        (f"/project/{MOCK_PROJECT_NAME}/models", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        (f"/project/{MOCK_PROJECT_NAME}/models", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/models", MOCK_ADMIN_USER, None, True),
        (f"/project/{MOCK_PROJECT_NAME}/endpoints", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        (f"/project/{MOCK_PROJECT_NAME}/endpoints", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/endpoints", MOCK_ADMIN_USER, None, True),
        (
            f"/project/{MOCK_PROJECT_NAME}/endpoint-configs",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
        ),
        (f"/project/{MOCK_PROJECT_NAME}/endpoint-configs", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/endpoint-configs", MOCK_ADMIN_USER, None, True),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/labeling", MOCK_USER, MOCK_REGULAR_PROJECT_USER, True),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/labeling", MOCK_USER, None, False),
        (f"/project/{MOCK_PROJECT_NAME}/jobs/labeling", MOCK_ADMIN_USER, None, True),
    ],
    ids=[
        "project_training_jobs_project_user",
        "project_training_jobs_non_project_user",
        "project_training_jobs_non_project_admin",
        "project_transform_jobs_project_user",
        "project_transform_jobs_non_project_user",
        "project_transform_jobs_non_project_admin",
        "project_hpo_jobs_project_user",
        "project_hpo_jobs_non_project_user",
        "project_hpo_jobs_non_project_admin",
        "project_labeling_jobs_project_user",
        "project_labeling_jobs_non_project_user",
        "project_labeling_jobs_non_project_admin",
        "project_notebooks_project_user",
        "project_notebooks_non_project_user",
        "project_notebooks_non_project_admin",
        "project_models_project_user",
        "project_models_non_project_user",
        "project_models_non_project_admin",
        "project_endpoints_project_user",
        "project_endpoints_non_project_user",
        "project_endpoints_non_project_admin",
        "project_endpoint_configs_project_user",
        "project_endpoint_configs_non_project_user",
        "project_endpoint_configs_non_project_admin",
        "project_labeling_jobs_project_user",
        "project_labeling_jobs_non_project_user",
        "project_labeling_jobs_non_project_admin",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_list_project_resources(
    mock_user_dao,
    mock_project_user_dao,
    resource: str,
    user: UserModel,
    project_user: ProjectUserModel,
    allow: bool,
):
    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = project_user

    assert lambda_handler(
        mock_event(
            user=user,
            resource=resource,
            method="GET",
            path_params={"projectName": MOCK_PROJECT_NAME},
        ),
        {},
    ) == policy_response(allow=allow, user=user)

    mock_user_dao.get.assert_called_with(user.username)
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)


@pytest.mark.parametrize(
    "resource,path_params,user",
    [
        ("/emr", None, MOCK_USER),
        ("/notebook", None, MOCK_USER),
        ("/dataset", None, MOCK_OWNER_USER),
        ("/current-user", None, MOCK_ADMIN_USER),
        ("/user", None, MOCK_USER),
        ("/model/images", None, MOCK_USER),
        ("/metadata/compute-types", None, MOCK_USER),
        ("/metadata/notebook-options", None, MOCK_USER),
        ("/metadata/subnets", None, MOCK_USER),
    ],
    ids=[
        "get_emr",
        "get_notebooks",
        "get_datasets",
        "get_current_user",
        "get_all_users",
        "get_model_images",
        "get_compute_types",
        "get_notebook_options",
        "get_subnets",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_unauthenticated_endpoint_get(
    mock_user_dao,
    mock_project_user_dao,
    resource: str,
    path_params: Dict[str, str],
    user: UserModel,
):
    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = MOCK_REGULAR_PROJECT_USER
    assert lambda_handler(
        mock_event(user=user, resource=resource, method="GET", path_params=path_params),
        {},
    ) == policy_response(user=user)
    mock_user_dao.get.assert_called_with(user.username)
    if path_params and "type" in path_params and path_params["type"] == "project":
        mock_project_user_dao.get.assert_called_with(path_params["scope"], user.username)
    else:
        mock_project_user_dao.get.assert_not_called()


@pytest.mark.parametrize(
    "resource,path_params,user",
    [
        ("/translate/realtime/text", None, MOCK_USER),
        ("/translate/realtime/document", None, MOCK_USER),
    ],
    ids=["post_translate_realtime_text", "post_translate_realtime_document"],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_unauthenticated_endpoint_post(mock_user_dao, resource: str, path_params: Dict[str, str], user: UserModel):
    mock_user_dao.get.return_value = user
    assert lambda_handler(
        mock_event(user=user, resource=resource, method="POST", path_params=path_params),
        {},
    ) == policy_response(user=user)
    mock_user_dao.get.assert_called_with(user.username)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_unhandled_route(mock_user_dao):
    mock_user_dao.get.return_value = MOCK_USER
    assert lambda_handler(mock_event(user=MOCK_USER, resource="/secret/super-backdoor"), {}) == policy_response(
        user=MOCK_USER, allow=False
    )
    mock_user_dao.get.assert_called_with(MOCK_USER.username)


@pytest.mark.parametrize(
    "user,action,project,project_user,allow",
    [
        (MOCK_ADMIN_USER, "start", MOCK_PROJECT, None, False),
        (MOCK_ADMIN_USER, "start", MOCK_SUSPENDED_PROJECT, None, False),
        (MOCK_ADMIN_USER, "start", None, None, False),
        (MOCK_ADMIN_USER, "url", MOCK_PROJECT, None, False),
        (MOCK_ADMIN_USER, "url", MOCK_SUSPENDED_PROJECT, None, False),
        (MOCK_ADMIN_USER, "url", None, None, False),
        (MOCK_ADMIN_USER, "update", None, None, True),
        (MOCK_OWNER_USER, "start", MOCK_PROJECT, MOCK_REGULAR_PROJECT_USER, True),
        (MOCK_OWNER_USER, "start", MOCK_SUSPENDED_PROJECT, MOCK_REGULAR_PROJECT_USER, False),
        (MOCK_OWNER_USER, "start", None, None, False),
        (MOCK_OWNER_USER, "start", MOCK_PROJECT, None, False),
        (MOCK_OWNER_USER, "url", MOCK_PROJECT, MOCK_REGULAR_PROJECT_USER, True),
        (MOCK_OWNER_USER, "url", MOCK_SUSPENDED_PROJECT, MOCK_REGULAR_PROJECT_USER, False),
        (MOCK_OWNER_USER, "url", None, None, False),
        (MOCK_OWNER_USER, "url", MOCK_PROJECT, None, False),
        (MOCK_OWNER_USER, "update", MOCK_PROJECT, MOCK_REGULAR_PROJECT_USER, True),
        (MOCK_OWNER_USER, "update", MOCK_SUSPENDED_PROJECT, MOCK_REGULAR_PROJECT_USER, False),
        (MOCK_USER, "start", MOCK_PROJECT, MOCK_REGULAR_PROJECT_USER, False),
        (MOCK_USER, "start", MOCK_SUSPENDED_PROJECT, MOCK_REGULAR_PROJECT_USER, False),
        (MOCK_USER, "start", None, None, False),
        (MOCK_USER, "url", MOCK_PROJECT, MOCK_REGULAR_PROJECT_USER, False),
        (MOCK_USER, "url", MOCK_SUSPENDED_PROJECT, MOCK_REGULAR_PROJECT_USER, False),
        (MOCK_USER, "url", None, None, False),
        (MOCK_USER, "update", None, None, False),
        (MOCK_USER, "update", MOCK_PROJECT, MOCK_OWNER_PROJECT_USER, True),
    ],
    ids=[
        "admin_start_non_suspended",
        "admin_start_suspended",
        "admin_start_no_project",
        "admin_url_non_suspended",
        "admin_url_suspended",
        "admin_url_no_project",
        "admin_update",
        "owner_start_non_suspended",
        "owner_start_suspended",
        "owner_start_no_project",
        "owner_start_project_not_a_member",
        "owner_url_non_suspended",
        "owner_url_suspended",
        "owner_url_no_project",
        "owner_start_project_not_a_member",
        "owner_update",
        "owner_update_suspended_project",
        "regular_user_start_non_suspended",
        "regular_user_start_suspended",
        "regular_user_start_no_project",
        "regular_user_url_non_suspended",
        "regular_user_url_suspended",
        "regular_user_url_no_project",
        "regular_user_update",
        "project_owner_non_notebook_owner_update",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.resource_metadata_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_dao")
def test_notebook_privileged(
    mock_project_dao,
    mock_user_dao,
    mock_project_user_dao,
    mock_resource_metadata_dao,
    user: UserModel,
    action: str,
    project: ProjectModel,
    project_user: ProjectUserModel,
    allow: bool,
):
    notebook_name = "fakeNotebook"
    mock_user_dao.get.return_value = user
    mock_project_dao.get.return_value = project
    test_project_name = project.name if project else MOCK_PROJECT_NAME

    mock_project_user_dao.get.return_value = project_user

    mock_resource_metadata_dao.get.return_value = ResourceMetadataModel(
        notebook_name,
        ResourceType.NOTEBOOK,
        MOCK_OWNER_USER.username,
        test_project_name,
        {"NotebookInstanceArn": "fakeArn"},
    )
    method = "GET"
    resource = f"/notebook/{notebook_name}"
    if action == "url":
        resource += "/url"
    if action == "start":
        resource += "/start"
        method = "POST"
    if action == "update":
        method = "PUT"

    assert lambda_handler(
        mock_event(
            user=user,
            resource=resource,
            method=method,
            path_params={"notebookName": notebook_name},
        ),
        {},
    ) == policy_response(allow=allow, user=user, project=project if project else MOCK_PROJECT)

    mock_resource_metadata_dao.get.assert_called_with(notebook_name, ResourceType.NOTEBOOK)
    mock_user_dao.get.assert_called_with(user.username)
    if action == "start" or (project_user and Permission.PROJECT_OWNER not in project_user.permissions):
        mock_project_dao.get.assert_called_with(test_project_name)

    # While owners are allowed to act on resources they must still be active members of the project
    # the resource is associated with
    if (user.username == MOCK_OWNER_USER.username and project and not project.suspended) or (
        action == "update" and user.username != MOCK_ADMIN_USER.username
    ):
        mock_project_user_dao.get.assert_called_with(test_project_name, user.username)
    else:
        mock_project_user_dao.get.assert_not_called()


@pytest.mark.parametrize(
    "user,method,scope,project_user,allow",
    [
        (MOCK_ADMIN_USER, "GET", DatasetType.GLOBAL.value, None, True),
        (MOCK_ADMIN_USER, "GET", MOCK_PROJECT_NAME, None, False),
        (MOCK_ADMIN_USER, "GET", MOCK_OWNER_USER.username, None, False),
        (MOCK_ADMIN_USER, "PUT", DatasetType.GLOBAL.value, None, False),
        (MOCK_ADMIN_USER, "PUT", MOCK_PROJECT_NAME, None, False),
        (MOCK_ADMIN_USER, "PUT", MOCK_OWNER_USER.username, None, False),
        (MOCK_ADMIN_USER, "DELETE", DatasetType.GLOBAL.value, None, False),
        (MOCK_ADMIN_USER, "DELETE", MOCK_PROJECT_NAME, None, False),
        (MOCK_ADMIN_USER, "DELETE", MOCK_OWNER_USER.username, None, False),
        (MOCK_USER, "GET", DatasetType.GLOBAL.value, None, True),
        (MOCK_USER, "GET", MOCK_PROJECT_NAME, None, False),
        (MOCK_USER, "GET", MOCK_OWNER_USER.username, None, False),
        (MOCK_USER, "PUT", DatasetType.GLOBAL.value, None, False),
        (MOCK_USER, "PUT", MOCK_PROJECT_NAME, None, False),
        (MOCK_USER, "PUT", MOCK_OWNER_USER.username, None, False),
        (MOCK_USER, "DELETE", DatasetType.GLOBAL.value, None, False),
        (MOCK_USER, "DELETE", MOCK_PROJECT_NAME, None, False),
        (MOCK_USER, "DELETE", MOCK_OWNER_USER.username, None, False),
        (MOCK_OWNER_USER, "GET", DatasetType.GLOBAL.value, None, True),
        (MOCK_OWNER_USER, "GET", MOCK_PROJECT_NAME, None, True),
        (MOCK_OWNER_USER, "GET", MOCK_OWNER_USER.username, None, True),
        (MOCK_OWNER_USER, "PUT", DatasetType.GLOBAL.value, None, True),
        (MOCK_OWNER_USER, "PUT", MOCK_PROJECT_NAME, None, True),
        (MOCK_OWNER_USER, "PUT", MOCK_OWNER_USER.username, None, True),
        (MOCK_OWNER_USER, "DELETE", DatasetType.GLOBAL.value, None, True),
        (MOCK_OWNER_USER, "DELETE", MOCK_PROJECT_NAME, None, True),
        (MOCK_OWNER_USER, "DELETE", MOCK_OWNER_USER.username, None, True),
        (MOCK_USER, "GET", MOCK_PROJECT_NAME, MOCK_REGULAR_PROJECT_USER, True),
        (MOCK_USER, "PUT", MOCK_PROJECT_NAME, MOCK_REGULAR_PROJECT_USER, False),
        (MOCK_USER, "DELETE", MOCK_PROJECT_NAME, MOCK_REGULAR_PROJECT_USER, False),
    ],
    ids=[
        "admin_get_global",
        "admin_get_project",
        "admin_get_private",
        "admin_update_global",
        "admin_update_project",
        "admin_update_private",
        "admin_delete_global",
        "admin_delete_project",
        "admin_delete_private",
        "user_get_global",
        "user_get_project",
        "user_get_private",
        "user_update_global",
        "user_update_project",
        "user_update_private",
        "user_delete_global",
        "user_delete_project",
        "user_delete_private",
        "owner_get_global",
        "owner_get_project",
        "owner_get_private",
        "owner_update_global",
        "owner_update_project",
        "owner_update_private",
        "owner_delete_global",
        "owner_delete_project",
        "owner_delete_private",
        "project_member_get_project",
        "project_member_update_project",
        "project_member_delete_project",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.dataset_dao")
def test_dataset_routes(
    mock_dataset_dao,
    mock_user_dao,
    mock_project_user_dao,
    user: UserModel,
    method: str,
    scope: str,
    project_user: ProjectUserModel,
    allow: bool,
):
    mock_dataset = DatasetModel(
        scope=scope,
        name="UnitTestDataset",
        description="For unit tests",
        location="s3://fake-location/",
        created_by=MOCK_OWNER_USER.username,
    )
    mock_dataset_dao.get.return_value = mock_dataset
    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = project_user

    assert lambda_handler(
        mock_event(
            user=user,
            resource=f"/dataset/{scope}/{mock_dataset.name}",
            method=method,
            path_params={"scope": scope, "datasetName": mock_dataset.name},
        ),
        {},
    ) == policy_response(allow=allow, user=user)

    mock_user_dao.get.assert_called_with(user.username)
    mock_dataset_dao.get.assert_called_with(scope, mock_dataset.name)
    # We'll only grab the project user if it's a GET, Project Dataset, and the user wasn't the owner
    if mock_dataset.type == DatasetType.PROJECT and method == "GET" and user.username != MOCK_OWNER_USER.username:
        mock_project_user_dao.get.assert_called_with(scope, user.username)
    else:
        mock_project_user_dao.get.assert_not_called()


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.dataset_dao")
def test_dataset_adversarial(mock_dataset_dao, mock_user_dao, mock_project_user_dao):
    method = "GET"
    allow = False

    # Adversarial example where project name equals private dataset owner
    # MOCK_USER is member of said project name
    project_name = MOCK_OWNER_USER.username

    mock_private_dataset = DatasetModel(
        scope=MOCK_OWNER_USER.username,
        name="UnitTestDataset",
        description="For unit tests",
        location="s3://fake-location/",
        created_by=MOCK_OWNER_USER.username,
    )
    assert mock_private_dataset.type == DatasetType.PRIVATE

    mock_dataset_dao.get.return_value = mock_private_dataset
    mock_user_dao.get.return_value = MOCK_USER
    mock_project_user_dao.get.return_value = MOCK_USER

    assert lambda_handler(
        mock_event(
            user=MOCK_USER,
            resource=f"/dataset/{project_name}/{mock_private_dataset.name}",
            method=method,
            path_params={"scope": project_name, "datasetName": mock_private_dataset.name},
        ),
        {},
    ) == policy_response(allow=allow, user=MOCK_USER)

    mock_user_dao.get.assert_called_with(MOCK_USER.username)
    mock_dataset_dao.get.assert_called_with(project_name, mock_private_dataset.name)

    mock_project_user_dao.get.assert_not_called()


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.dataset_dao")
def test_get_nonexistent_dataset(
    mock_dataset_dao,
    mock_user_dao,
    mock_project_user_dao,
):
    mock_scope = "fakeScope"
    mock_name = "fakeName"
    mock_dataset_dao.get.return_value = None
    mock_user_dao.get.return_value = MOCK_USER

    assert lambda_handler(
        mock_event(
            user=MOCK_USER,
            resource=f"/dataset/{mock_scope}/{mock_name}",
            path_params={"scope": mock_scope, "datasetName": mock_name},
        ),
        {},
    ) == policy_response(allow=False, user=MOCK_USER)

    mock_user_dao.get.assert_called_with(MOCK_USER.username)
    mock_dataset_dao.get.assert_called_with(mock_scope, mock_name)
    mock_project_user_dao.get.assert_not_called()


@pytest.mark.parametrize(
    "user,method,allow",
    [
        (MOCK_USER, "DELETE", False),
        (MOCK_USER, "PUT", True),
        (MOCK_USER, "POST", False),
        (MOCK_USER, "GET", False),
        (MOCK_SUSPENDED_USER, "PUT", True),
    ],
    ids=[
        "user_login_delete",
        "user_login_put",
        "user_login_post",
        "user_login_get",
        "suspended_user_login_put",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_login_routes(mock_user_dao, user: UserModel, method: str, allow: bool):
    mock_user_dao.get.return_value = user
    assert lambda_handler(
        mock_event(
            user=user,
            resource="/login",
            method=method,
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)


@pytest.mark.parametrize(
    "user,method,allow",
    [
        (MOCK_USER, "DELETE", False),
        (MOCK_USER, "PUT", False),
        (MOCK_USER, "POST", False),
        (MOCK_USER, "GET", False),
        (MOCK_ADMIN_USER, "DELETE", False),
        (MOCK_ADMIN_USER, "PUT", False),
        (MOCK_ADMIN_USER, "POST", False),
        (MOCK_ADMIN_USER, "GET", True),
    ],
    ids=[
        "user_config_delete",
        "user_config_put",
        "user_config_post",
        "user_config_get",
        "admin_config_delete",
        "admin_config_put",
        "admin_config_post",
        "admin_config_get",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_config_routes(mock_user_dao, user: UserModel, method: str, allow: bool):
    mock_user_dao.get.return_value = user
    assert lambda_handler(
        mock_event(
            user=user,
            resource="/config",
            method=method,
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)


@pytest.mark.parametrize(
    "user,project_user,method,path_params,allow",
    [
        (MOCK_USER, None, "POST", None, False),
        (MOCK_ADMIN_USER, None, "POST", None, True),
        (MOCK_USER, None, "GET", None, True),
        (MOCK_USER, MOCK_REGULAR_PROJECT_USER, "GET", {"projectName": MOCK_PROJECT_NAME}, True),
        (MOCK_USER, MOCK_REGULAR_PROJECT_USER, "POST", {"projectName": MOCK_PROJECT_NAME}, False),
        (MOCK_OWNER_USER, MOCK_OWNER_PROJECT_USER, "POST", {"projectName": MOCK_PROJECT_NAME}, True),
    ],
    ids=[
        "user_update_app_config",
        "admin_update_app_config",
        "user_get_app_config",
        "user_get_project_config",
        "user_update_project_config",
        "project_owner_update_project_config",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_app_config_routes(
    mock_user_dao,
    mock_project_user_dao,
    user: UserModel,
    project_user: ProjectUserModel,
    method: str,
    path_params: dict,
    allow: bool,
):
    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = project_user
    assert lambda_handler(
        mock_event(
            user=user,
            resource="/app-config",
            method=method,
            path_params=path_params,
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)


@pytest.mark.parametrize(
    "user,method,allow",
    [
        (MOCK_USER, "POST", False),
        (MOCK_ADMIN_USER, "POST", True),
    ],
    ids=[
        "user_sync_metadata",
        "admin_sync_metadata",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_migration_routes(mock_user_dao, user: UserModel, method: str, allow: bool):
    mock_user_dao.get.return_value = user
    assert lambda_handler(
        mock_event(
            user=user,
            resource="/admin/sync-metadata",
            method=method,
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)


@pytest.mark.parametrize(
    "user,method,allow",
    [
        (MOCK_USER, "DELETE", False),
        (MOCK_USER, "PUT", False),
        (MOCK_USER, "POST", False),
        (MOCK_USER, "GET", False),
        (MOCK_ADMIN_USER, "DELETE", True),
        (MOCK_ADMIN_USER, "PUT", False),
        (MOCK_ADMIN_USER, "POST", True),
        (MOCK_ADMIN_USER, "GET", True),
    ],
    ids=[
        "user_report_delete",
        "user_report_put",
        "user_report_post",
        "user_report_get",
        "admin_report_delete",
        "admin_report_put",
        "admin_report_post",
        "admin_report_get",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_report_routes(mock_user_dao, user: UserModel, method: str, allow: bool):
    mock_user_dao.get.return_value = user
    assert lambda_handler(
        mock_event(
            user=user,
            resource="/report",
            method=method,
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)


@pytest.mark.parametrize(
    "resource,method,user,project_user,allow,job_type",
    [
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "GET",
            MOCK_USER,
            MOCK_OWNER_PROJECT_USER,
            True,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "PUT",
            MOCK_USER,
            MOCK_OWNER_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "POST",
            MOCK_USER,
            MOCK_OWNER_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "DELETE",
            MOCK_USER,
            MOCK_OWNER_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "GET",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "PUT",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "POST",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "DELETE",
            MOCK_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "GET",
            MOCK_ADMIN_USER,
            MOCK_REGULAR_PROJECT_USER,
            True,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "PUT",
            MOCK_ADMIN_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "POST",
            MOCK_ADMIN_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "DELETE",
            MOCK_ADMIN_USER,
            MOCK_REGULAR_PROJECT_USER,
            False,
            "TrainingJobs",
        ),
        (
            f"/job/TrainingJobs/{MOCK_JOB_NAME}/logs",
            "GET",
            MOCK_USER,
            None,
            False,
            "TrainingJobs",
        ),
    ],
    ids=[
        "logs_training_owner_post",
        "logs_training_owner_put",
        "logs_training_owner_get",
        "logs_training_owner_delete",
        "logs_training_user_post",
        "logs_training_user_put",
        "logs_training_user_get",
        "logs_training_user_delete",
        "logs_training_admin_post",
        "logs_training_admin_put",
        "logs_training_admin_get",
        "logs_training_admin_delete",
        "logs_training_no_permissions_user_post",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.resource_metadata_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_logs_routes(
    mock_user_dao,
    mock_project_user_dao,
    mock_resource_metadata_dao,
    resource: str,
    method: str,
    user: UserModel,
    project_user: ProjectUserModel,
    allow: bool,
    job_type: str,
):
    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = project_user
    mock_resource_metadata_dao.get.return_value = ResourceMetadataModel(
        MOCK_JOB_NAME, ResourceType.TRAINING_JOB, user.username, MOCK_PROJECT_NAME, {}
    )

    assert lambda_handler(
        mock_event(
            user=user,
            resource=resource,
            method=method,
            path_params={"jobType": job_type, "jobName": MOCK_JOB_NAME},
        ),
        {},
    ) == policy_response(
        allow=allow,
        user=user,
        project=MOCK_PROJECT if user != MOCK_ADMIN_USER and method == "GET" else None,
    )

    mock_user_dao.get.assert_called_with(user.username)
    if method == "GET" and user != MOCK_ADMIN_USER:
        mock_resource_metadata_dao.get.assert_called_with(MOCK_JOB_NAME, ResourceType.TRAINING_JOB)
        mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)


@pytest.mark.parametrize(
    "user,admin_only,allow",
    [
        (MOCK_ADMIN_USER, True, True),
        (MOCK_USER, True, False),
        (MOCK_USER, False, True),
    ],
    ids=["admin_user_admin_only", "normal_user_admin_only", "normal_user_not_admin_only"],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.utils.app_config_utils.app_configuration_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_create_project(mock_user_dao, mock_app_configuration_dao, user: UserModel, admin_only: bool, allow: bool):
    mock_user_dao.get.return_value = user
    mock_app_configuration_dao.get.return_value = [generate_test_config(admin_only=admin_only)]
    get_app_config.cache_clear()
    assert lambda_handler(
        mock_event(
            user=user,
            resource="/project",
            method="POST",
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)
    if Permission.ADMIN in user.permissions:
        mock_app_configuration_dao.get.assert_not_called()
    else:
        mock_app_configuration_dao.get.assert_called_with(configScope="global", num_versions=1)


@pytest.mark.parametrize(
    "resource",
    [
        ("presigned-url"),
        ("create"),
    ],
    ids=[
        "missing_header_presigned_url",
        "missing_header_create_dataset",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_presigned_url_missing_headers(mock_user_dao, resource: str):
    mock_user_dao.get.return_value = MOCK_USER
    assert lambda_handler(
        mock_event(
            method="POST",
            user=MOCK_USER,
            resource=f"/dataset/{resource}",
        ),
        {},
    ) == policy_response(allow=False, user=MOCK_USER)
    mock_user_dao.get.assert_called_with(MOCK_USER.username)


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_stop_job_missing_header(mock_user_dao, mock_project_user_dao):
    mock_user_dao.get.return_value = MOCK_USER
    assert lambda_handler(
        mock_event(
            method="POST",
            user=MOCK_USER,
            resource=f"/job/transform/{MOCK_PROJECT_NAME}-job/stop",
        ),
        {},
    ) == policy_response(allow=False, user=MOCK_USER)
    mock_user_dao.get.assert_called_with(MOCK_USER.username)
    mock_project_user_dao.get.assert_not_called()


@pytest.mark.parametrize(
    "user,allow",
    [
        (MOCK_ADMIN_USER, True),
        (MOCK_OWNER_USER, True),
        (MOCK_USER, True),
        (UserModel("new_user", "example@amazon.com", "Doug Doe", False, []), False),
    ],
    ids=["admin_user_stop", "project_owner_stop", "job_owner_stop", "non_owner_stop"],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.resource_metadata_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_stop_batch_translate_job(
    mock_user_dao, mock_project_user_dao, mock_resource_metadata_dao, user: UserModel, allow: bool
):
    mock_job_id = "123abc"
    path_params = {}
    path_params["jobId"] = mock_job_id
    mock_user_dao.get.return_value = user
    if user == MOCK_OWNER_USER:
        mock_project_user_dao.get.return_value = MOCK_OWNER_PROJECT_USER
    else:
        mock_project_user_dao.get.return_value = MOCK_REGULAR_PROJECT_USER
    mock_resource_metadata_dao.get.return_value = ResourceMetadataModel(
        mock_job_id,
        ResourceType.BATCH_TRANSLATE_JOB,
        MOCK_USER.username,
        MOCK_PROJECT_NAME,
        {},
    )

    assert lambda_handler(
        mock_event(
            method="POST",
            user=user,
            resource="/batch-translate/fakeJobId",
            path_params=path_params,
        ),
        {},
    ) == policy_response(
        allow=allow,
        user=user,
        project=MOCK_PROJECT if user.username != MOCK_ADMIN_USER.username else None,
    )

    if user == MOCK_ADMIN_USER:
        mock_resource_metadata_dao.get.assert_not_called()
    else:
        mock_resource_metadata_dao.get.assert_called_with(mock_job_id, ResourceType.BATCH_TRANSLATE_JOB)
        mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)

    mock_user_dao.get.assert_called_with(user.username)


@mock.patch.dict("os.environ", MOCK_OIDC_ENV, clear=True)
@mock.patch("ml_space_lambda.utils.app_config_utils.app_configuration_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.http")
def test_verified_token(mock_http, mock_user_dao, mock_app_config, mock_well_known_config, mock_oidc_jwks_keys):
    mock_http.request.side_effect = [
        mock_well_known_config,
        mock_oidc_jwks_keys,
    ]
    mock_user_dao.get.return_value = MOCK_USER
    mock_app_config.get.return_value = [generate_test_config()]
    get_app_config.cache_clear()
    assert lambda_handler(mock_event(user=MOCK_USER, resource="/project", method="POST"), {}) == policy_response(
        allow=True, user=MOCK_USER
    )
    mock_user_dao.get.assert_called_with(MOCK_USER.username)
    mock_http.request.assert_has_calls(
        [
            mock.call("GET", "https://example-oidc.com/realms/mlspace/.well-known/openid-configuration"),
            mock.call("GET", "https://example-oidc.com/realms/mlspace/protocol/openid-connect/certs"),
        ]
    )


@mock.patch.dict("os.environ", MOCK_OIDC_ENV, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.http")
def test_verified_token_bad_well_known_config(mock_http, mock_user_dao, mock_oidc_jwks_keys):
    mock_http.request.side_effect = [
        mock_oidc_jwks_keys,
    ]
    mock_user_dao.get.return_value = MOCK_USER
    assert lambda_handler(
        mock_event(user=MOCK_USER, resource="/project", method="POST", kid="fake-cert-kid"), {}
    ) == policy_response(allow=False, valid_token=False)
    mock_user_dao.get.assert_not_called()
    mock_http.request.assert_called_once()
    mock_http.request.assert_called_with("GET", "https://example-oidc.com/realms/mlspace/.well-known/openid-configuration")


@mock.patch.dict("os.environ", MOCK_OIDC_ENV, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.http")
def test_verified_token_bad_unrecognized_key(mock_http, mock_user_dao, mock_well_known_config, mock_oidc_jwks_keys):
    mock_http.request.side_effect = [
        mock_well_known_config,
        mock_oidc_jwks_keys,
    ]
    mock_user_dao.get.return_value = MOCK_USER
    assert lambda_handler(
        mock_event(user=MOCK_USER, resource="/project", method="POST", kid="fake-cert-kid"), {}
    ) == policy_response(allow=False, valid_token=False)
    mock_user_dao.get.assert_not_called()
    mock_http.request.assert_has_calls(
        [
            mock.call("GET", "https://example-oidc.com/realms/mlspace/.well-known/openid-configuration"),
            mock.call("GET", "https://example-oidc.com/realms/mlspace/protocol/openid-connect/certs"),
        ]
    )


@mock.patch.dict(
    "os.environ",
    {"AWS_DEFAULT_REGION": "us-east-1", "OIDC_URL": "https://example-oidc.com/realms/mlspace"},
    clear=True,
)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.http")
def test_verified_token_missing_client_name(mock_http, mock_user_dao):
    mock_user_dao.get.return_value = MOCK_USER
    assert lambda_handler(
        mock_event(user=MOCK_USER, resource="/project", method="POST", kid="fake-cert-kid"), {}
    ) == policy_response(allow=False, valid_token=False)
    mock_user_dao.get.assert_not_called()
    mock_http.request.assert_not_called()


@mock.patch.dict(
    "os.environ",
    {"AWS_DEFAULT_REGION": "us-east-1", "OIDC_CLIENT_NAME": "web-client"},
    clear=True,
)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.http")
def test_verified_token_missing_oidc_endpoint(mock_http, mock_user_dao):
    mock_user_dao.get.return_value = MOCK_USER
    assert lambda_handler(
        mock_event(user=MOCK_USER, resource="/project", method="POST", kid="fake-cert-kid"), {}
    ) == policy_response(allow=False, valid_token=False)
    mock_user_dao.get.assert_not_called()
    mock_http.request.assert_not_called()


@pytest.mark.parametrize(
    "user,project_user,method,allow",
    [
        (MOCK_ADMIN_USER, None, "POST", True),
        (MOCK_ADMIN_USER, None, "DELETE", True),
        (MOCK_ADMIN_USER, None, "PUT", True),
        (MOCK_OWNER_USER, MOCK_OWNER_PROJECT_USER, "POST", True),
        (MOCK_OWNER_USER, MOCK_OWNER_PROJECT_USER, "DELETE", True),
        (MOCK_OWNER_USER, MOCK_OWNER_PROJECT_USER, "PUT", True),
        (MOCK_USER, None, "POST", False),
        (MOCK_USER, None, "DELETE", False),
        (MOCK_USER, None, "PUT", False),
        (MOCK_USER, MOCK_REGULAR_PROJECT_USER, "POST", False),
        (MOCK_USER, MOCK_REGULAR_PROJECT_USER, "DELETE", False),
        (MOCK_USER, MOCK_REGULAR_PROJECT_USER, "PUT", False),
    ],
    ids=[
        "admin_add_user",
        "admin_remove_user",
        "admin_update_user",
        "owner_add_user",
        "owner_remove_user",
        "owner_update_user",
        "non_member_add_user",
        "non_member_remove_user",
        "non_member_update_user",
        "member_add_user",
        "member_remove_user",
        "member_update_user",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_mange_project_users(
    mock_user_dao,
    mock_project_user_dao,
    user: UserModel,
    project_user: ProjectUserModel,
    method: str,
    allow: bool,
):
    mock_user_dao.get.return_value = user
    mock_project_user_dao.get.return_value = project_user
    resource = f"/project/{MOCK_PROJECT_NAME}/users"
    path_params = {"projectName": MOCK_PROJECT_NAME}
    if method != "POST":
        resource += "/fakeUser"
        path_params["username"] = "fakeUser"

    assert lambda_handler(
        mock_event(
            user=user,
            resource=resource,
            method=method,
            path_params=path_params,
        ),
        {},
    ) == policy_response(allow=allow, user=user)
    mock_user_dao.get.assert_called_with(user.username)
    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, user.username)


@pytest.mark.parametrize(
    "method,resource,path_param_key",
    [
        ("DELETE", "/notebook/fakeResourceName", "notebookName"),
        ("DELETE", "/model/fakeResourceName", "modelName"),
        ("DELETE", "/endpoint-config/fakeResourceName", "endpointConfigName"),
        ("DELETE", "/endpoint/fakeResourceName", "endpointName"),
        ("DELETE", "/dataset/global/fakeResourceName", "datasetName"),
        ("DELETE", "/emr/fakeResourceName", "clusterId"),
    ],
    ids=[
        "delete_notebook",
        "delete_model",
        "delete_endpoint_config",
        "delete_endpoint",
        "delete_dataset",
        "delete_emr_cluster",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.resource_metadata_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.project_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.dataset_dao")
def test_manage_project_sagemaker_resource_boto_error(
    mock_dataset_dao,
    mock_project_dao,
    mock_user_dao,
    mock_resource_metadata_dao,
    method: str,
    resource: str,
    path_param_key: str,
):
    path_params = {}
    path_params[path_param_key] = "fakeResourceName"

    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    mock_project_dao.get.return_value = MOCK_PROJECT
    if path_param_key in ["notebookName", "endpointName", "modelName", "endpointConfigName", "clusterId"]:
        mock_resource_metadata_dao.get.side_effect = ClientError(error_msg, "GetItem")
    if path_param_key == "datasetName":
        mock_dataset_dao.get.side_effect = ClientError(error_msg, "GetItem")
        path_params["scope"] = "global"

    mock_user_dao.get.return_value = MOCK_OWNER_USER

    assert lambda_handler(
        mock_event(user=MOCK_OWNER_USER, resource=resource, method=method, path_params=path_params),
        {},
    ) == policy_response(allow=False, user=MOCK_OWNER_USER)

    if path_param_key == "notebookName":
        mock_resource_metadata_dao.get.assert_called_with(path_params[path_param_key], ResourceType.NOTEBOOK)
    if path_param_key == "endpointName":
        mock_resource_metadata_dao.get.assert_called_with(path_params[path_param_key], ResourceType.ENDPOINT)
    if path_param_key == "modelName":
        mock_resource_metadata_dao.get.assert_called_with(path_params[path_param_key], ResourceType.MODEL)
    if path_param_key == "endpointConfigName":
        mock_resource_metadata_dao.get.assert_called_with(path_params[path_param_key], ResourceType.ENDPOINT_CONFIG)
    if path_param_key == "clusterId":
        mock_resource_metadata_dao.get.assert_called_with(path_params[path_param_key], ResourceType.EMR_CLUSTER)
    if path_param_key == "datasetName":
        mock_dataset_dao.get.assert_called_with("global", path_params[path_param_key])


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.resource_metadata_dao")
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_emr_cluster_missing_metadata_entry(mock_user_dao, mock_resource_metadata_dao):
    mock_cluster_id = "clusterId"
    mock_resource_metadata_dao.get.return_value = None

    mock_user_dao.get.return_value = MOCK_OWNER_USER
    path_params = {"clusterId": mock_cluster_id}

    assert lambda_handler(
        mock_event(
            user=MOCK_OWNER_USER,
            resource=f"/emr/{mock_cluster_id}",
            method="GET",
            path_params=path_params,
        ),
        {},
    ) == policy_response(allow=False, user=MOCK_OWNER_USER)

    mock_user_dao.get.assert_called_with(MOCK_OWNER_USER.username)
    mock_resource_metadata_dao.get.assert_called_with(mock_cluster_id, ResourceType.EMR_CLUSTER)


@pytest.mark.parametrize(
    "user,method,allow",
    [
        (
            UserModel(
                "CN=Before\0DAfter,OU=Test,DC=North America,DC=Fabrikam,DC=COM",
                "dn@amazon.com",
                "CN=Before\0DAfter,OU=Test,DC=North America,DC=Fabrikam,DC=COM",
                False,
                [],
            ),
            "DELETE",
            False,
        ),
        (
            UserModel(
                "CN=Before\0DAfter,OU=Test,DC=North America,DC=Fabrikam,DC=COM",
                "dn@amazon.com",
                "CN=Before\0DAfter,OU=Test,DC=North America,DC=Fabrikam,DC=COM",
                False,
                [],
            ),
            "PUT",
            True,
        ),
        (UserModel("email@gmail.com", "dn@amazon.com", "email@gmail.com", False, []), "DELETE", False),
        (UserModel("email@gmail.com", "dn@amazon.com", "email@gmail.com", False, []), "PUT", True),
    ],
    ids=[
        "DN_delete_user",
        "DN_update_user",
        "emails_delete_user",
        "emails_update_user",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
@mock.patch("ml_space_lambda.authorizer.lambda_function.user_dao")
def test_username_normalization(mock_user_dao, user: UserModel, method: str, allow: bool):
    mock_user_dao.get.return_value = user
    response_username = urllib.parse.unquote(user.username).replace(",", "-").replace("=", "-").replace(" ", "-")

    modified_policy_response = policy_response(allow=allow, user=user)
    modified_policy_response["principalId"] = response_username

    print(f"caca = {response_username}")
    assert (
        lambda_handler(
            mock_event(
                user=user,
                resource=f"/user/{urllib.parse.quote(user.username)}",
                method=method,
                path_params={"username": user.username},
            ),
            {},
        )
        == modified_policy_response
    )
    mock_user_dao.get.assert_called_with(response_username)
