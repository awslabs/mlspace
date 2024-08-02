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

from typing import Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.data_access_objects.group_user import GroupUserModel
from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.data_access_objects.project_group import ProjectGroupModel
from ml_space_lambda.data_access_objects.project_user import ProjectUserModel
from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.enums import DatasetType, EnvVariable, Permission, ResourceType
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response
from ml_space_lambda.utils.mlspace_config import get_environment_variables

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.project.lambda_functions import delete as lambda_handler

MOCK_PROJECT_NAME = "UnitTestProject"


mock_event = {
    "requestContext": {"authorizer": {"principalId": "jdoe@example.com"}},
    "pathParameters": {"projectName": MOCK_PROJECT_NAME},
}
mock_context = mock.Mock()

paginated_cluster_response = [
    {
        "Clusters": [
            {"Name": f"{MOCK_PROJECT_NAME}-response1-cluster1", "Id": "Cluster1"},
            {"Name": f"{MOCK_PROJECT_NAME}-response1-cluster2", "Id": "Cluster2"},
            {"Name": "exclude-this-response1-cluster3", "Id": "Cluster3"},
        ]
    },
    {
        "Clusters": [
            {"Name": f"{MOCK_PROJECT_NAME}-response2-cluster1", "Id": "Cluster4"},
            {"Name": "exclude-this-response2-cluster2", "Id": "Cluster5"},
        ],
    },
    {
        "Clusters": [
            {"Name": f"{MOCK_PROJECT_NAME}-response3-cluster1", "Id": "Cluster6"},
        ],
    },
    {},
]


def mock_project(suspened: Optional[bool] = True) -> ProjectModel:
    return ProjectModel(
        name=MOCK_PROJECT_NAME,
        description="Project for unit tests",
        suspended=suspened,
        created_by="jdoe@example.com",
    )


@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.emr")
@mock.patch("ml_space_lambda.project.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.project.lambda_functions.s3")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.dataset_dao")
def test_delete_project(
    mock_dataset_dao,
    mock_project_dao,
    mock_project_user_dao,
    mock_s3,
    mock_sagemaker,
    mock_emr,
    mock_resource_metadata_dao,
    mock_project_group_dao,
    mock_group_user_dao,
    mock_iam_manager,
):
    mlspace_config.env_variables = {}
    env_vars = get_environment_variables()
    expected_response = generate_html_response(200, f"Successfully deleted {MOCK_PROJECT_NAME} and its associated resources.")
    mock_project_dao.get.return_value = mock_project()
    project_name = mock_project().name
    group_name = "my_group"
    username = "my_username"
    fake_role_arn = "arn:aws::012345678910:iam:role/fakeRole"
    mock_project_group_dao.get_groups_for_project.return_value = [ProjectGroupModel(group_name, mock_project().name)]
    mock_group_user_dao.get_users_for_group.return_value = [GroupUserModel(username, group_name)]
    mock_iam_manager.get_iam_role_arn.return_value = fake_role_arn
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = [
        PagedMetadataResults(
            [
                ResourceMetadataModel(
                    "TestModel",
                    ResourceType.MODEL,
                    "jdoe@example.com",
                    MOCK_PROJECT_NAME,
                    {"ModelName": "ModelName"},
                )
            ]
        ),
        PagedMetadataResults(
            [
                ResourceMetadataModel(
                    "TestEndpoint",
                    ResourceType.ENDPOINT,
                    "jdoe@example.com",
                    MOCK_PROJECT_NAME,
                    {"EndpointStatus": "InService"},
                )
            ]
        ),
        PagedMetadataResults(
            [
                ResourceMetadataModel(
                    "TestEndpointConfig",
                    ResourceType.ENDPOINT_CONFIG,
                    "jdoe@example.com",
                    MOCK_PROJECT_NAME,
                    {"EndpointConfigArn": "fakeArn:TestEndpointConfig"},
                )
            ]
        ),
        PagedMetadataResults(
            [
                ResourceMetadataModel(
                    "TestNotebook",
                    ResourceType.NOTEBOOK,
                    "jdoe@example.com",
                    MOCK_PROJECT_NAME,
                    {"NotebookInstanceStatus": "Stopped"},
                )
            ]
        ),
        PagedMetadataResults(
            [
                ResourceMetadataModel(
                    "Cluster1",
                    ResourceType.EMR_CLUSTER,
                    "jdoe@example.com",
                    MOCK_PROJECT_NAME,
                    {"Status": "WAITING"},
                )
            ]
        ),
    ]
    mock_dataset_dao.get_all_for_scope.return_value = [
        DatasetModel(
            name="TestDataset",
            type=DatasetType.PROJECT,
            scope=MOCK_PROJECT_NAME,
            description="Dataset for unit test",
            created_by="jdoe@example.com",
            location=f"s3://{env_vars['DATA_BUCKET']}/project/{MOCK_PROJECT_NAME}/datasets/TestDataset",
        )
    ]
    mock_dataset_dao.delete.return_value = None
    mock_s3.list_objects_v2.return_value = {"Contents": [{"Key": "TestObjectKey"}]}
    mock_s3.delete_object.return_value = None
    mock_project_user_dao.get_users_for_project.return_value = [
        ProjectUserModel(
            username="jdoe@example.com",
            project_name=MOCK_PROJECT_NAME,
            permissions=[Permission.PROJECT_OWNER],
        )
    ]
    mock_project_user_dao.delete.return_value = None

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_group_dao.get_groups_for_project.assert_called_with(project_name)
    mock_group_user_dao.get_users_for_group.assert_called_with(group_name)
    mock_iam_manager.get_iam_role_arn.assert_called_with(project_name, username)
    mock_iam_manager.remove_project_user_roles.assert_called_with([fake_role_arn])
    mock_project_group_dao.delete.assert_called_with(project_name, group_name)
    mock_project_dao.delete.assert_called_with(MOCK_PROJECT_NAME)
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [
            mock.call(MOCK_PROJECT_NAME, ResourceType.MODEL, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.ENDPOINT, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.ENDPOINT_CONFIG, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.EMR_CLUSTER, fetch_all=True),
        ]
    )
    mock_dataset_dao.get_all_for_scope.assert_called_with(DatasetType.PROJECT, MOCK_PROJECT_NAME)
    mock_project_user_dao.get_users_for_project.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_user_dao.delete.assert_called_with(MOCK_PROJECT_NAME, "jdoe@example.com")
    mock_s3.list_objects_v2.assert_called_with(
        Bucket=env_vars[EnvVariable.DATA_BUCKET], Prefix=f"project/{MOCK_PROJECT_NAME}/datasets/TestDataset/"
    )
    mock_s3.delete_object.assert_called_with(Bucket=env_vars[EnvVariable.DATA_BUCKET], Key="TestObjectKey")
    mock_dataset_dao.delete.assert_called_with(MOCK_PROJECT_NAME, "TestDataset")
    mock_sagemaker.delete_model.assert_called_with(ModelName="TestModel")
    mock_sagemaker.delete_endpoint.assert_called_with(EndpointName="TestEndpoint")
    mock_sagemaker.delete_endpoint_config.assert_called_with(EndpointConfigName="TestEndpointConfig")
    mock_sagemaker.delete_notebook_instance.assert_called_with(NotebookInstanceName="TestNotebook")
    mock_emr.set_termination_protection.assert_called_with(JobFlowIds=["Cluster1"], TerminationProtected=False)
    mock_emr.terminate_job_flows.assert_called_with(JobFlowIds=["Cluster1"])


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_delete_project_not_suspended(mock_project_dao, mock_resource_metadata_dao):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(
        400,
        "Bad Request: Specified project is not suspended. Please suspend the project and try again.",
    )
    mock_project_dao.get.return_value = mock_project(False)

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_not_called()
    mock_project_dao.delete.assert_not_called()


@mock.patch.dict("os.environ", {"MANAGE_IAM_ROLES": "True"})
@mock.patch("ml_space_lambda.project.lambda_functions.group_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_group_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.iam_manager")
@mock.patch("ml_space_lambda.project.lambda_functions.emr")
@mock.patch("ml_space_lambda.project.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.project.lambda_functions.s3")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.dataset_dao")
def test_delete_project_external_iam(
    mock_dataset_dao,
    mock_project_dao,
    mock_project_user_dao,
    mock_s3,
    mock_sagemaker,
    mock_emr,
    mock_iam_manager,
    mock_resource_metadata_dao,
    mock_project_group_dao,
    mock_group_user_dao,
):
    mlspace_config.env_variables = {}
    env_vars = get_environment_variables()
    expected_response = generate_html_response(200, f"Successfully deleted {MOCK_PROJECT_NAME} and its associated resources.")
    mock_project_dao.get.return_value = mock_project()
    mock_dataset_dao.get_all_for_scope.return_value = []
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = [
        # Models
        PagedMetadataResults([]),
        # Endpoionts
        PagedMetadataResults([]),
        # Endpoint Configs
        PagedMetadataResults([]),
        # Notebooks
        PagedMetadataResults([]),
        # EMR Clusters
        PagedMetadataResults([]),
    ]
    mock_dataset_dao.get_all_for_scope.return_value = [
        DatasetModel(
            name="TestDataset",
            type=DatasetType.PROJECT,
            scope=MOCK_PROJECT_NAME,
            description="Dataset for unit test",
            created_by="jdoe@example.com",
            location=f"s3://{env_vars['DATA_BUCKET']}/project/{MOCK_PROJECT_NAME}/datasets/TestDataset",
        )
    ]
    mock_dataset_dao.delete.return_value = None
    mock_s3.list_objects_v2.return_value = {}
    mock_project_user_dao.get_users_for_project.return_value = [
        ProjectUserModel(
            username="jdoe@example.com",
            project_name=MOCK_PROJECT_NAME,
            permissions=[Permission.PROJECT_OWNER],
            role="jdoe-role",
        ),
        ProjectUserModel(
            username="matt@example.com",
            project_name=MOCK_PROJECT_NAME,
            permissions=[Permission.COLLABORATOR],
            role="matt-role",
        ),
    ]
    mock_project_user_dao.delete.return_value = None

    mock_project_group_dao.get_groups_for_project.return_value = [
        ProjectGroupModel(
            group_name="TestGroup1",
            project_name=MOCK_PROJECT_NAME,
            permissions=[Permission.PROJECT_OWNER],
        ),
        ProjectGroupModel(
            group_name="TestGroup2",
            project_name=MOCK_PROJECT_NAME,
            permissions=[Permission.COLLABORATOR],
        ),
    ]

    mock_group_user_dao.get_users_for_group.side_effect = [
        [
            GroupUserModel(
                username="jdoe@example.com",
                group_name="TestGroup1",
                permissions=[Permission.COLLABORATOR],
            ),
            GroupUserModel(
                username="foo@example.com",
                group_name="TestGroup1",
                permissions=[Permission.COLLABORATOR],
            ),
        ],
        [
            GroupUserModel(
                username="bar@example.com",
                group_name="TestGroup2",
                permissions=[Permission.COLLABORATOR],
            ),
        ],
    ]

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [
            mock.call(MOCK_PROJECT_NAME, ResourceType.MODEL, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.ENDPOINT, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.ENDPOINT_CONFIG, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.EMR_CLUSTER, fetch_all=True),
        ]
    )
    mock_dataset_dao.get_all_for_scope.assert_called_with(DatasetType.PROJECT, MOCK_PROJECT_NAME)

    # Mocking an s3 bucket that's now empty
    mock_s3.list_objects_v2.assert_called_with(
        Bucket=env_vars[EnvVariable.DATA_BUCKET], Prefix=f"project/{MOCK_PROJECT_NAME}/datasets/TestDataset/"
    )
    mock_s3.delete_object.assert_not_called()
    mock_dataset_dao.delete.assert_called_with(MOCK_PROJECT_NAME, "TestDataset")
    # Not mocking any models/endpoints/configs
    mock_sagemaker.delete_model.assert_not_called()
    mock_sagemaker.delete_endpoint.assert_not_called()
    mock_sagemaker.delete_endpoint_config.assert_not_called()
    mock_sagemaker.delete_notebook_instance.assert_not_called()
    mock_emr.set_termination_protection.assert_not_called()
    mock_emr.terminate_job_flows.assert_not_called()
    # Expected cleanup
    mock_project_user_dao.get_users_for_project.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_user_dao.delete.assert_has_calls(
        [
            mock.call(MOCK_PROJECT_NAME, "jdoe@example.com"),
            mock.call(MOCK_PROJECT_NAME, "matt@example.com"),
        ]
    )
    mock_project_dao.delete.assert_called_with(MOCK_PROJECT_NAME)

    # Expected external iam cleanup
    mock_iam_manager.remove_project_user_roles.assert_called_with(["jdoe-role", "matt-role"], project=MOCK_PROJECT_NAME)


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_delete_project_nonexistent(mock_project_dao):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(
        400,
        "Bad Request: Specified project does not exist",
    )
    mock_project_dao.get.return_value = None
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_dao.delete.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.project.lambda_functions.s3")
@mock.patch("ml_space_lambda.project.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.project.lambda_functions.dataset_dao")
def test_delete_project_pending_notebook(
    mock_dataset_dao,
    mock_project_dao,
    mock_project_user_dao,
    mock_s3,
    mock_sagemaker,
    mock_resource_metadata_dao,
):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(
        400,
        "Bad Request: All Notebooks need to be Stopped to delete a project, all other "
        "sagemaker resources have been deleted.",
    )
    mock_project_dao.get.return_value = mock_project()
    mock_dataset_dao.get_all_for_scope.return_value = []

    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = [
        # Models call
        PagedMetadataResults(),
        # Endpoints call
        PagedMetadataResults(),
        # Endpoint configs call
        PagedMetadataResults(),
        # Notebooks call
        PagedMetadataResults(
            [
                ResourceMetadataModel(
                    "TestNotebook",
                    ResourceType.NOTEBOOK,
                    "jdoe@amazon.com",
                    MOCK_PROJECT_NAME,
                    {"NotebookInstanceStatus": "Pending"},
                )
            ]
        ),
    ]

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)

    mock_resource_metadata_dao.get_all_for_project_by_type.assert_has_calls(
        [
            mock.call(MOCK_PROJECT_NAME, ResourceType.MODEL, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.ENDPOINT, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.ENDPOINT_CONFIG, fetch_all=True),
            mock.call(MOCK_PROJECT_NAME, ResourceType.NOTEBOOK, fetch_all=True),
        ]
    )
    mock_dataset_dao.get_all_for_scope.assert_called_with(DatasetType.PROJECT, MOCK_PROJECT_NAME)

    # Not mocking any datasets so no s3 calls
    mock_s3.list_objects_v2.assert_not_called()
    mock_s3.delete_object.assert_not_called()
    mock_dataset_dao.delete.assert_not_called()
    # Not mocking any models/endpoints/configs
    mock_sagemaker.delete_model.assert_not_called()
    mock_sagemaker.delete_endpoint.assert_not_called()
    mock_sagemaker.delete_endpoint_config.assert_not_called()
    # Can't delete a pending notebook
    mock_sagemaker.delete_notebook_instance.assert_not_called()
    # Can't delete a project or project users with a pending notebook
    mock_project_user_dao.get_users_for_project.assert_not_called()
    mock_project_user_dao.delete.assert_not_called()
    mock_project_dao.delete.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_delete_project_client_error(mock_project_dao):
    mlspace_config.env_variables = {}
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    mock_project_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_project_dao.get.assert_called_with(MOCK_PROJECT_NAME)
    mock_project_dao.delete.assert_not_called()


@mock.patch("ml_space_lambda.project.lambda_functions.project_dao")
def test_delete_project_missing_param(mock_project_dao):
    mlspace_config.env_variables = {}
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_project_dao.get.assert_not_called()
    mock_project_dao.delete.assert_not_called()
