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

# Testing for the list_transform_jobs Lambda function.
from typing import Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
MOCK_USERNAME = "jdoe@amazon.com"

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.transform_job.lambda_functions import list_resources as lambda_handler

project_name = "example_transform_project_name"

mock_event = {"pathParameters": {"projectName": project_name}}
mock_context = mock.Mock()


def _mock_job_metadata(
    identifier: str, status: Optional[str] = "Completed", username: Optional[str] = MOCK_USERNAME
) -> ResourceMetadataModel:
    return ResourceMetadataModel(
        identifier,
        ResourceType.TRANSFORM_JOB,
        username,
        project_name,
        {
            "TransformJobArn": f"arn:aws:us-east-1:sagemaker:transform-job/{identifier}",
            "TransformJobStatus": status,
            "FailureReason": "Something bad happened" if status == "Failed" else None,
            "CreationTime": "2023-10-04 13:46:22.554000+00:00",
            "LastModifiedTime": "2023-10-04 13:46:57.478000+00:00",
            "TransformStartTime": "2023-10-04 13:46:26.229000+00:00",
            "TransformEndTime": "2023-10-04 13:46:53.326000+00:00" if status == "Completed" else None,
        },
    )


@mock.patch("ml_space_lambda.transform_job.lambda_functions.resource_metadata_dao")
def test_list_transform_jobs_success(mock_resource_metadata_dao):
    mock_jobs_metadata = [
        _mock_job_metadata("job-1"),
        _mock_job_metadata("job-2", "InProgress", "jeff@amazon.com"),
        _mock_job_metadata("job-3", "InProgress"),
        _mock_job_metadata("job-1", "Failed", "jeff@amazon.com"),
    ]
    mock_resource_metadata_dao.get_all_for_project_by_type.return_value = PagedMetadataResults(
        mock_jobs_metadata,
        "fakeToken",
    )
    expected_response = generate_html_response(
        200,
        {
            "records": [job.to_dict() for job in mock_jobs_metadata],
            "nextToken": "fakeToken",
        },
    )

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        project_name,
        ResourceType.TRANSFORM_JOB,
        limit=100,
        next_token=None,
    )


@mock.patch("ml_space_lambda.transform_job.lambda_functions.resource_metadata_dao")
def test_list_transform_jobs_client_error(mock_resource_metadata_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    exception_response = ClientError(error_msg, "Query")
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the Query operation: Dummy error message.",
    )

    mock_resource_metadata_dao.get_all_for_project_by_type.side_effect = exception_response

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_resource_metadata_dao.get_all_for_project_by_type.assert_called_with(
        project_name,
        ResourceType.TRANSFORM_JOB,
        limit=100,
        next_token=None,
    )


@mock.patch("ml_space_lambda.transform_job.lambda_functions.resource_metadata_dao")
def test_list_transform_jobs_missing_parameters(mock_resource_metadata_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_resource_metadata_dao.get_all_for_project_by_type.assert_not_called()
