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

# Testing for the list_emr_clusters Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}
mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.emr.lambda_functions import list_all

MOCK_PROJECT_NAME = "mock_project1"
FAKE_NEXT_TOKEN = "Fake-Next-Page-Marker"
# All fields of ClusterSummary object are optional
list_cluster_response = {
    "Clusters": [
        {
            "Name": f"{MOCK_PROJECT_NAME}-response1-cluster1",
        },
        {
            "Name": f"{MOCK_PROJECT_NAME}-response1-cluster2",
        },
        {
            "Name": "exclude-this-response1-cluster3",
        },
        {
            "Name": f"{MOCK_PROJECT_NAME}-response2-cluster1",
        },
        {
            "Name": "exclude-this-response2-cluster2",
        },
        {
            "Name": f"{MOCK_PROJECT_NAME}-response3-cluster1",
        },
    ],
    "Marker": FAKE_NEXT_TOKEN,
}

mock_response = [
    {
        "Name": f"{MOCK_PROJECT_NAME}-response1-cluster1",
    },
    {
        "Name": f"{MOCK_PROJECT_NAME}-response1-cluster2",
    },
    {
        "Name": f"{MOCK_PROJECT_NAME}-response2-cluster1",
    },
    {
        "Name": f"{MOCK_PROJECT_NAME}-response3-cluster1",
    },
]

mock_event = {"pathParameters": {"projectName": MOCK_PROJECT_NAME}}


@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_list_emr_clusters_success(mock_emr):
    mock_emr.list_clusters.return_value = list_cluster_response
    expected_response = generate_html_response(200, {"records": mock_response, "nextToken": FAKE_NEXT_TOKEN})

    assert list_all(mock_event, mock_context) == expected_response

    mock_emr.list_clusters.assert_called_with(
        ClusterStates=[
            "STARTING",
            "BOOTSTRAPPING",
            "RUNNING",
            "WAITING",
        ],
    )


@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_list_emr_clusters_paging_options(mock_emr):
    mock_emr.list_clusters.return_value = {"Clusters": [{"Name": f"{MOCK_PROJECT_NAME}-cluster9"}]}
    expected_response = generate_html_response(
        200,
        {
            "records": [
                {
                    "Name": f"{MOCK_PROJECT_NAME}-cluster9",
                }
            ]
        },
    )
    mock_initial_token = "mock_next_token1"
    assert (
        list_all(
            {
                "pathParameters": {"projectName": MOCK_PROJECT_NAME},
                "queryStringParameters": {
                    "nextToken": mock_initial_token,
                    "resourceStatus": "RUNNING",
                },
            },
            mock_context,
        )
        == expected_response
    )

    mock_emr.list_clusters.assert_called_with(ClusterStates=["RUNNING"], Marker=mock_initial_token)


@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_list_emr_clusters_client_error(mock_emr):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }

    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the ListClusters operation: Dummy error message.",
    )

    mock_emr.list_clusters.side_effect = ClientError(error_msg, "ListClusters")
    assert list_all(mock_event, mock_context) == expected_response
