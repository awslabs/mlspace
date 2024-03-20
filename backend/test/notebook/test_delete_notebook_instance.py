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

from botocore.exceptions import ClientError

from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.notebook.lambda_functions import delete as lambda_handler

mock_context = mock.Mock()
mock_notebook_name = "example_notebook_instance"


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_delete_notebook_instance_success(mock_sagemaker, mock_dao_scheduler):
    mock_event = {"pathParameters": {"notebookName": mock_notebook_name}}

    mock_sagemaker.delete_notebook_instance.return_value = "Successfully deleted example_notebook_instance"
    expected_response = generate_html_response(200, "Successfully deleted example_notebook_instance")

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.delete_notebook_instance.assert_called_with(NotebookInstanceName="example_notebook_instance")
    mock_dao_scheduler.delete.assert_called_with(resource_id=mock_notebook_name, resource_type=ResourceType.NOTEBOOK)


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_delete_notebook_instance_client_error(mock_sagemaker, mock_dao_scheduler):
    mock_event = {"pathParameters": {"notebookName": mock_notebook_name}}

    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    mock_sagemaker.delete_notebook_instance.side_effect = ClientError(error_msg, "DeleteNotebookInstance")
    expected_response = generate_html_response(
        400,
        "An error occurred (MissingParameter) when calling the DeleteNotebookInstance operation: Dummy error message.",
    )
    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.delete_notebook_instance.assert_called_with(NotebookInstanceName="example_notebook_instance")
    mock_dao_scheduler.delete.assert_not_called()


@mock.patch("ml_space_lambda.notebook.lambda_functions.resource_scheduler_dao")
@mock.patch("ml_space_lambda.notebook.lambda_functions.sagemaker")
def test_delete_notebook_instance_generic_error(mock_sagemaker, mock_dao_scheduler):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_sagemaker.delete_notebook_instance.assert_not_called()
    mock_dao_scheduler.delete.assert_not_called()
