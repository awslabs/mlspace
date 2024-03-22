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

# Testing for the list_emr_clusters Lambda function.
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}
mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.emr.lambda_functions import list_all

MOCK_PROJECT_NAME = "mock_project1"
MOCK_USERNAME = "jdoe@amazon.com"
FAKE_NEXT_TOKEN = "Fake-Next-Page-Marker"


def _mock_emr_metadata(identifier: str, username: Optional[str] = MOCK_USERNAME) -> ResourceMetadataModel:
    return ResourceMetadataModel(
        identifier,
        ResourceType.EMR_CLUSTER,
        username,
        MOCK_PROJECT_NAME,
        {
            "CreationTime": "today",
            "Status": "WAITING",
            "ReleaseVersion": "emr-6.2.0",
            "Name": f"cluster{identifier}",
            "NormalizedInstanceHours": 5,
        },
    )


mock_event = {"pathParameters": {"projectName": MOCK_PROJECT_NAME}}


@mock.patch("ml_space_lambda.emr.lambda_functions.resource_metadata_dao")
def test_list_emr_clusters_success(mock_resource_metadata_dao):
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults(
        [
            _mock_emr_metadata("one"),
            _mock_emr_metadata("two"),
            _mock_emr_metadata("three"),
            _mock_emr_metadata("four", "test@amazon.com"),
            _mock_emr_metadata("five", "test@amazon.com"),
        ],
        "fakeToken",
    )
    expected_response = generate_html_response(
        200,
        {
            "records": [
                _mock_emr_metadata("one").to_dict(),
                _mock_emr_metadata("two").to_dict(),
                _mock_emr_metadata("three").to_dict(),
                _mock_emr_metadata("four", "test@amazon.com").to_dict(),
                _mock_emr_metadata("five", "test@amazon.com").to_dict(),
            ],
            "nextToken": "fakeToken",
        },
    )
    assert list_all(mock_event, mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.EMR_CLUSTER, limit=100, next_token=None
    )


@mock.patch("ml_space_lambda.emr.lambda_functions.resource_metadata_dao")
def test_list_emr_clusters_client_error(mock_resource_metadata_dao):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    operation = "ListClusters"
    expected_response = generate_html_response(
        "400",
        f"An error occurred (MissingParameter) when calling the {operation} operation: Dummy error message.",
    )
    exception_response = ClientError(error_msg, operation)
    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = exception_response

    assert list_all(mock_event, mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        MOCK_PROJECT_NAME, ResourceType.EMR_CLUSTER, limit=100, next_token=None
    )
