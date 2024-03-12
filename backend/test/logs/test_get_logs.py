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

from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
mock_context = mock.Mock()

# Need to mock the region in order to do the import...
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.logs.lambda_functions import get

MOCK_JOB_NAME = "MockTestJobName"
MOCK_ENDPOINT_NAME = "MockTestEndpointName"
MOCK_NOTEBOOK_NAME = "MockTestNotebookName"


mock_endpoint_event = {
    "resource": f"/endpoint/{MOCK_ENDPOINT_NAME}/logs",
    "pathParameters": {"endpointName": MOCK_ENDPOINT_NAME},
    "queryStringParameters": {
        "startTime": 0,
        "endTime": 1674060211048,
        "variantName": "variant-name-1",
    },
}

mock_endpoint_event_no_variant = {
    "resource": f"/endpoint/{MOCK_ENDPOINT_NAME}/logs",
    "pathParameters": {"endpointName": MOCK_ENDPOINT_NAME},
    "queryStringParameters": {
        "startTime": 0,
        "endTime": 1674060211048,
    },
}

mock_notebook_event = {
    "resource": f"/notebook/{MOCK_NOTEBOOK_NAME}/logs",
    "pathParameters": {
        "notebookName": MOCK_NOTEBOOK_NAME,
    },
    "queryStringParameters": {},
}

mock_cloudwatch_response = {
    "events": [
        {
            "logStreamName": "/aws/sagemaker",
            "timestamp": "12346",
            "message": "Message 2",
        }
    ],
    "nextToken": "token1",
}


def mock_job_event(job_type: str):
    return {
        "resource": f"/job/{job_type}/{MOCK_JOB_NAME}/logs",
        "pathParameters": {"jobName": MOCK_JOB_NAME, "jobType": job_type},
        "queryStringParameters": {
            "startTime": 0,
            "endTime": 1674060211048,
            "nextToken": "mockTokenValue",
        },
    }


@pytest.mark.parametrize(
    "mock_event,expected_params",
    [
        (
            mock_job_event("TrainingJobs"),
            {
                "logGroupName": "/aws/sagemaker/TrainingJobs",
                "logStreamNamePrefix": MOCK_JOB_NAME,
                "startTime": 0,
                "endTime": 1674060211048,
                "nextToken": "mockTokenValue",
            },
        ),
        (
            mock_job_event("LabelingJobs"),
            {
                "logGroupName": "/aws/sagemaker/LabelingJobs",
                "logStreamNamePrefix": MOCK_JOB_NAME,
                "startTime": 0,
                "endTime": 1674060211048,
                "nextToken": "mockTokenValue",
            },
        ),
        (
            mock_notebook_event,
            {
                "logGroupName": "/aws/sagemaker/NotebookInstances",
                "logStreamNamePrefix": MOCK_NOTEBOOK_NAME,
            },
        ),
        (
            mock_endpoint_event,
            {
                "logGroupName": f"/aws/sagemaker/Endpoints/{MOCK_ENDPOINT_NAME}",
                "logStreamNamePrefix": "variant-name-1",
                "startTime": 0,
                "endTime": 1674060211048,
            },
        ),
        (
            mock_endpoint_event_no_variant,
            {
                "logGroupName": f"/aws/sagemaker/Endpoints/{MOCK_ENDPOINT_NAME}",
                "startTime": 0,
                "endTime": 1674060211048,
            },
        ),
    ],
    ids=[
        "training_job_logs",
        "labeling_job_logs",
        "notebook_logs",
        "endpoint_logs",
        "endpoint_logs_no_variant",
    ],
)
@mock.patch("ml_space_lambda.logs.lambda_functions.cloudwatch")
def test_get_logs_success(mock_cloudwatch, mock_event, expected_params):
    mock_cloudwatch.filter_log_events.return_value = mock_cloudwatch_response
    expected_response = generate_html_response(200, mock_cloudwatch_response)

    assert get(mock_event, mock_context) == expected_response
    mock_cloudwatch.filter_log_events.assert_called_with(**expected_params)


@mock.patch("ml_space_lambda.logs.lambda_functions.cloudwatch")
def test_get_logs_log_group_doesnt_exist(mock_cloudwatch):
    error_msg = {
        "Error": {"Code": "ResourceNotFoundException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    expected_response = generate_html_response(200, {})

    mock_cloudwatch.filter_log_events.side_effect = ClientError(error_msg, "FilterLogEvents")
    assert get(mock_job_event("TrainingJobs"), mock_context) == expected_response


@mock.patch("ml_space_lambda.logs.lambda_functions.cloudwatch")
def test_get_logs_client_error(mock_cloudwatch):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the FilterLogEvents operation: Dummy error message.",
    )

    mock_cloudwatch.filter_log_events.side_effect = ClientError(error_msg, "FilterLogEvents")
    assert get(mock_job_event("TrainingJobs"), mock_context) == expected_response


def test_unsupported_resource():
    assert get(
        {
            "resource": "fakeResource",
            "queryStringParameters": {},
            "pathParameters": {},
        },
        mock_context,
    ) == generate_html_response(400, "Bad Request: Unsupported resource.")


@mock.patch("ml_space_lambda.logs.lambda_functions.cloudwatch")
def test_get_logs_missing_parameters(mock_cloudwatch):
    mock_cloudwatch.filter_log_events.return_value = mock_cloudwatch_response

    expected_response = generate_html_response(
        400,
        "Missing event parameter: 'pathParameters'",
    )

    assert get({}, mock_context) == expected_response
