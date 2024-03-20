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

from typing import List, Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.enums import Permission, ResourceType
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "MANAGE_IAM_ROLES": "True",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import remove_user as lambda_handler

MOCK_USERNAME = "jdoe@amazon.com"
MOCK_PROJECT_NAME = "example_project"

MOCK_MO_USER = ProjectUserModel(
    project_name=MOCK_PROJECT_NAME,
    username=MOCK_USERNAME,
    permissions=[Permission.PROJECT_OWNER],
)
MOCK_CO_USER = ProjectUserModel(
    project_name=MOCK_PROJECT_NAME,
    username="jane-doe",
    permissions=[Permission.COLLABORATOR],
    role="co-role",
)

mock_event = {"pathParameters": {"projectName": MOCK_PROJECT_NAME, "username": MOCK_USERNAME}}
mock_context = mock.Mock()


def _get_all_by_project_side_effect(
    notebook_results: Optional[List[ResourceMetadataModel]] = None,
    endpoint_results: Optional[List[ResourceMetadataModel]] = None,
    translate_results: Optional[List[ResourceMetadataModel]] = None,
):
    def _side_effect(*args, **kwargs):
        if args[0] == MOCK_PROJECT_NAME and args[1] == ResourceType.NOTEBOOK:
            return PagedMetadataResults(notebook_results)
        if args[0] == MOCK_PROJECT_NAME and args[1] == ResourceType.ENDPOINT:
            return PagedMetadataResults(endpoint_results)
        if args[0] == MOCK_PROJECT_NAME and args[1] == ResourceType.BATCH_TRANSLATE_JOB:
            return PagedMetadataResults(translate_results)
        return PagedMetadataResults()

    return _side_effect


def mock_describe_cluster(ClusterId: Optional[str]):  # noqa: N803
    if ClusterId:
        if ClusterId == "Cluster1":
            return {
                "Cluster": {
                    "Tags": [
                        {"Key": "project", "Value": MOCK_PROJECT_NAME},
                        {"Key": "user", "Value": MOCK_CO_USER.user},
                    ]
                }
            }
        return {
            "Cluster": {
                "Tags": [
                    {"Key": "project", "Value": MOCK_PROJECT_NAME},
                    {"Key": "user", "Value": MOCK_USERNAME},
                ]
            }
        }
    return {}


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.list_clusters_for_project")
@mock.patch("ml_space_lambda.project.lambda_functions.translate")
@mock.patch("ml_space_lambda.project.lambda_functions.emr")
@mock.patch("ml_space_lambda.project.lambda_functions.sagemaker")
def test_remove_user_from_project_success_not_owner(
    mock_sagemaker,
    mock_emr,
    mock_translate,
    mock_project_clusters,
    mock_project_user_dao,
    mock_iam_manager,
    mock_resource_metadata_dao,
):
    user_notebook_name = "demo"
    mock_translate_job_id = "translate1"
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully removed {MOCK_CO_USER.user} from {MOCK_PROJECT_NAME}")
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = _get_all_by_project_side_effect(
        notebook_results=[
            ResourceMetadataModel(
                "paper-analytics",
                ResourceType.NOTEBOOK,
                MOCK_USERNAME,
                MOCK_PROJECT_NAME,
                {"NotebookInstanceStatus": "InService"},
            ),
            ResourceMetadataModel(
                user_notebook_name,
                ResourceType.NOTEBOOK,
                MOCK_CO_USER.user,
                MOCK_PROJECT_NAME,
                {"NotebookInstanceStatus": "InService"},
            ),
            ResourceMetadataModel(
                "mxboost-nist",
                ResourceType.NOTEBOOK,
                MOCK_CO_USER.user,
                MOCK_PROJECT_NAME,
                {"NotebookInstanceStatus": "Stopped"},
            ),
            ResourceMetadataModel(
                "parts",
                ResourceType.NOTEBOOK,
                MOCK_USERNAME,
                MOCK_PROJECT_NAME,
                {"NotebookInstanceStatus": "Stopped"},
            ),
        ],
        translate_results=[
            ResourceMetadataModel(
                mock_translate_job_id,
                ResourceType.BATCH_TRANSLATE_JOB,
                MOCK_CO_USER.user,
                MOCK_PROJECT_NAME,
                {
                    "JobName": "batch-translate-job",
                },
            )
        ],
    )

    mock_project_clusters.return_value = {
        "records": [
            {"Id": "Cluster1", "Name": f"{MOCK_PROJECT_NAME}-cluster-1"},
            {"Id": "Cluster2", "Name": f"{MOCK_PROJECT_NAME}-cluster-2"},
        ]
    }
    mock_emr.describe_cluster.side_effect = mock_describe_cluster
    mock_project_user_dao.get.return_value = MOCK_CO_USER
    mock_iam_manager.remove_project_user_roles.return_value = None

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True"}):
        assert (
            lambda_handler(
                {
                    "pathParameters": {
                        "projectName": MOCK_PROJECT_NAME,
                        "username": MOCK_CO_USER.user,
                    }
                },
                mock_context,
            )
            == expected_response
        )

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_CO_USER.user)
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_iam_manager.remove_project_user_roles.assert_called_with([MOCK_CO_USER.role])
    mock_project_user_dao.delete.assert_called_with(MOCK_PROJECT_NAME, MOCK_CO_USER.user)
    mock_project_clusters.assert_called_with(mock_emr, MOCK_PROJECT_NAME, fetch_all=True)
    mock_emr.set_termination_protection.assert_called_with(JobFlowIds=["Cluster1"], TerminationProtected=False)
    mock_emr.terminate_job_flows.assert_called_with(JobFlowIds=["Cluster1"])
    mock_sagemaker.stop_notebook_instance.assert_called_with(NotebookInstanceName=user_notebook_name)
    mock_translate.stop_text_translation_job.assert_called_with(JobId=mock_translate_job_id)
    mock_resource_metadata_dao.get_all_for_project_by_type.asset_has_calls(
        [
            mock.call(MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.BATCH_TRANSLATE_JOB, fetch_all=True),
        ]
    )


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.list_clusters_for_project")
@mock.patch("ml_space_lambda.project.lambda_functions.translate")
@mock.patch("ml_space_lambda.project.lambda_functions.emr")
@mock.patch("ml_space_lambda.project.lambda_functions.sagemaker")
def test_remove_user_from_project_success_multiple_owners(
    mock_sagemaker,
    mock_emr,
    mock_translate,
    mock_project_clusters,
    mock_project_user_dao,
    mock_iam_manager,
    mock_resource_metadata_dao,
):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(200, f"Successfully removed {MOCK_USERNAME} from {MOCK_PROJECT_NAME}")

    mock_project_clusters.return_value = {"records": []}
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults()
    mock_project_user_dao.get.return_value = MOCK_MO_USER
    mock_project_user_dao.get_users_for_project.return_value = [
        MOCK_CO_USER,
        MOCK_MO_USER,
        ProjectUserModel(
            username="tshelby@example.com",
            project_name=MOCK_PROJECT_NAME,
            permissions=[Permission.PROJECT_OWNER],
        ),
    ]

    with mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": ""}):
        assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_called_with(MOCK_PROJECT_NAME)
    mock_iam_manager.remove_project_user_roles.assert_not_called()
    mock_project_user_dao.delete.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_clusters.assert_called_with(mock_emr, MOCK_PROJECT_NAME, fetch_all=True)
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [
            mock.call(MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.BATCH_TRANSLATE_JOB, fetch_all=True),
        ]
    )
    mock_emr.terminate_job_flows.assert_not_called()
    mock_sagemaker.stop_notebook_instance.assert_not_called()
    mock_translate.stop_text_translation_job.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_remove_user_from_project_failure_only_owner(mock_project_user_dao):
    expected_response = generate_html_response(400, "Bad Request: You cannot delete the last owner of a project")

    mock_project_user_dao.get.return_value = MOCK_MO_USER
    mock_project_user_dao.get_users_for_project.return_value.scan.return_value = [
        MOCK_CO_USER,
        MOCK_MO_USER,
    ]

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_user_dao.delete.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_remove_user_from_project_failure_not_in_project(mock_project_user_dao):
    expected_response = generate_html_response(400, f"Bad Request: {MOCK_USERNAME} is not a member of {MOCK_PROJECT_NAME}")
    mock_project_user_dao.get.return_value = None

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_project_user_dao.delete.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_remove_user_from_project_client_error(mock_project_user_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the GetItem operation: Dummy error message.",
    )
    mock_project_user_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_user_dao.get.assert_called_with(MOCK_PROJECT_NAME, MOCK_USERNAME)
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_project_user_dao.delete.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
def test_remove_user_from_project_missing_parameters(mock_project_user_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_project_user_dao.get.assert_not_called()
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_project_user_dao.delete.assert_not_called()
