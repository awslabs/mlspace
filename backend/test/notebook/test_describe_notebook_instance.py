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

# Testing for the describe_notebook_instance Lambda function
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.resource_scheduler import ResourceSchedulerModel
from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.notebook.lambda_functions import describe as lambda_handler

mock_context = mock.Mock()


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_describe_notebook_instance_success(mock_sagemaker, mock_dao_scheduler):
    mock_user = "jdoe@amazon.com"
    mock_arn = "fakeArn"
    mock_name = "example_notebook_instance"
    mock_event = {"pathParameters": {"notebookName": mock_name}}
    mock_response = {
        "NotebookInstanceArn": mock_arn,
        "NotebookInstanceName": mock_name,
        "NotebookStatus": "Pending",
    }
    term_time = 1234567890
    mock_dao_scheduler.get.return_value = ResourceSchedulerModel(
        resource_id="some-id",
        resource_type=ResourceType.NOTEBOOK,
        termination_time=term_time,
        project="some-project",
    )
    mock_sagemaker.list_tags.side_effect = [
        {
            "Tags": [
                {
                    "Key": "user",
                    "Value": mock_user,
                },
                {
                    "Key": "project",
                    "Value": "test-project",
                },
            ],
            "NextToken": "mock_next_token",
        },
        {
            "Tags": [
                {
                    "Key": "SecondPageTag",
                    "Value": "UnitTest",
                },
            ],
        },
    ]
    mock_sagemaker.describe_notebook_instance.return_value = mock_response
    expected_response = generate_html_response(
        200,
        {
            "NotebookInstanceArn": mock_arn,
            "NotebookInstanceName": mock_name,
            "NotebookStatus": "Pending",
            "NotebookDailyStopTime": term_time,
            "Owner": mock_user,
            "Project": "test-project",
        },
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.describe_notebook_instance.assert_called_with(NotebookInstanceName=mock_name)
    mock_sagemaker.list_tags.assert_called_with(ResourceArn=mock_arn)


@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_describe_notebook_instance_client_error(mock_sagemaker):
    mock_event = {"pathParameters": {"notebookName": "example_notebook_instance"}}
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }

    mock_sagemaker.describe_notebook_instance.side_effect = ClientError(
        error_msg, "DescribeNotebookInstance"
    )
    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the DescribeNotebookInstance operation: Dummy error message.",
    )

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.describe_notebook_instance.assert_called_with(
        NotebookInstanceName="example_notebook_instance"
    )


@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_describe_notebook_instance_missing_parameters(mock_sagemaker):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.describe_notebook_instance.assert_not_called()
