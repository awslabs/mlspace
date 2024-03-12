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
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}
# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.model.lambda_functions import describe as lambda_handler

describe_mock_response = {
    "Containers": [],
    "ModelArn": "example_arn",
    "ModelName": "example_model",
    "PrimaryContainer": {
        "Mode": "example_mode",
        "ModelPackageName": "example_model_package",
    },
    "ResponseMetadata": {"HTTPStatusCode": "400"},
}
username = "jdoe@amazon.com"

tags = {"Tags": generate_tags(username, "example_project", "example_tag")}
mock_event = {"pathParameters": {"modelName": "example_model"}}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
def test_describe_model_success(mock_sagemaker):
    lambda_response = copy.deepcopy(describe_mock_response)
    lambda_response.pop("ResponseMetadata", None)
    lambda_response["Owner"] = username

    final_response = generate_html_response(200, lambda_response)

    mock_sagemaker.describe_model.return_value = describe_mock_response
    mock_sagemaker.list_tags.return_value = tags

    assert lambda_handler(mock_event, mock_context) == final_response
    mock_sagemaker.describe_model.assert_called_with(ModelName="example_model")
    mock_sagemaker.list_tags.assert_called_with(ResourceArn="example_arn")


@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
def test_describe_model_describe_model_error(mock_sagemaker):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the DescribeModel operation: Dummy error message.",
    )

    mock_sagemaker.describe_model.side_effect = ClientError(error_msg, "DescribeModel")

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.describe_model.assert_called_with(ModelName="example_model")


@mock.patch("ml_space_lambda.model.lambda_functions.sagemaker")
def test_describe_model_list_tags_error(mock_sagemaker):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the ListTags operation: Dummy error message.",
    )

    mock_sagemaker.describe_model.return_value = describe_mock_response
    mock_sagemaker.list_tags.side_effect = ClientError(error_msg, "ListTags")

    assert lambda_handler(mock_event, mock_context) == expected_response
    mock_sagemaker.describe_model.assert_called_with(ModelName="example_model")
    mock_sagemaker.list_tags.assert_called_with(ResourceArn="example_arn")


def test_describe_model_generic_error():
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
