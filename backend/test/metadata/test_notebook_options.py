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

# Testing for the list_endpoint Lambda function
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-iso-east-1",
}

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.metadata.lambda_functions import notebook_options as lambda_handler

mock_context = mock.Mock()

mock_response = {
    "NotebookInstanceLifecycleConfigs": [
        {
            "NotebookInstanceLifecycleConfigName": "example-1",
        },
        {
            "NotebookInstanceLifecycleConfigName": "example-2",
        },
        {
            "NotebookInstanceLifecycleConfigName": "example-3",
        },
    ]
}


@mock.patch("ml_space_lambda.metadata.lambda_functions.sagemaker")
def test_get_notebook_instance_additional_options_success(mock_sagemaker):
    expected_body = {
        "lifecycleConfigs": [
            "No configuration",
            "example-1",
            "example-2",
            "example-3",
        ],
    }
    expected_response = generate_html_response(200, expected_body)
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [mock_response]
    mock_sagemaker.get_paginator.return_value = mock_paginator
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called()


@mock.patch("ml_space_lambda.metadata.lambda_functions.sagemaker")
def test_get_notebook_instance_additional_options_client_error(mock_sagemaker):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    expected_error = ClientError(error_msg, "ListNotebookInstanceLifecycleConfigurations")
    mock_paginator = mock.Mock()
    mock_paginator.paginate.side_effect = expected_error
    mock_sagemaker.get_paginator.return_value = mock_paginator
    expected_response = generate_html_response(
        "400",
        " ".join(
            (
                "An error occurred (MissingParameter) when calling the",
                "ListNotebookInstanceLifecycleConfigurations operation:",
                "Dummy error message.",
            )
        ),
    )
    response = lambda_handler({}, mock_context)
    assert response == expected_response
    mock_sagemaker.get_paginator.assert_called()
