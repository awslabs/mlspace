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

import json
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.enums import DatasetType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "DATA_BUCKET": "mlspace-data-bucket"}

mock_context = mock.Mock()

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import presigned_url as lambda_handler


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_get_presigned_url_get_success(mock_s3):
    mock_event = {
        "body": json.dumps({"key": "private/jdoe/datasets/example_dataset/file1.txt"}),
        "headers": {"x-mlspace-dataset-type": "private", "x-mlspace-dataset-scope": "jdoe"},
    }

    expected_url = (
        f"https://{TEST_ENV_CONFIG['DATA_BUCKET']}.s3.amazonaws.com/private/jdoe/datasets/example_dataset/"
        "file1.txt?AWSAccessKeyId=mockaccesskey&Signature=mocksignature&Expires=1666388740"
    )

    expected_response = generate_html_response(200, expected_url)

    mock_s3.generate_presigned_url.return_value = expected_url
    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_s3.generate_presigned_url.assert_called_with(
        ClientMethod="get_object",
        Params={
            "Bucket": TEST_ENV_CONFIG["DATA_BUCKET"],
            "Key": "private/jdoe/datasets/example_dataset/file1.txt",
        },
        ExpiresIn=3600,
    )


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_get_presigned_url_post_success(mock_s3):
    expected_s3_tags = "<Tagging><TagSet><Tag><Key>dataset-description</Key><Value>example description</Value></Tag><Tag><Key>user</Key><Value>jdoe@amazon.com</Value></Tag><Tag><Key>dataset-name</Key><Value>example_dataset</Value></Tag><Tag><Key>dataset-scope</Key><Value>global</Value></Tag></TagSet></Tagging>"
    mock_fields = {
        "x-amz-meta-dataset-description": "example description",
    }
    mock_final_fields = {
        "x-amz-meta-dataset-description": "example description",
        "x-amz-meta-user": "jdoe@amazon.com",
        "x-amz-meta-dataset-name": "example_dataset",
        "x-amz-meta-dataset-scope": DatasetType.GLOBAL,
        "tagging": expected_s3_tags,
    }
    mock_conditions = [
        {
            "x-amz-meta-dataset-description": "example description",
        },
        {},
    ]
    mock_final_conditions = [
        {
            "x-amz-meta-dataset-description": "example description",
        },
        {},
        {
            "x-amz-meta-user": "jdoe@amazon.com",
        },
        {
            "x-amz-meta-dataset-name": "example_dataset",
        },
        {
            "x-amz-meta-dataset-scope": DatasetType.GLOBAL,
        },
        {
            "tagging": expected_s3_tags,
        },
    ]

    mock_event = {
        "requestContext": {"authorizer": {"principalId": "jdoe@amazon.com"}},
        "body": json.dumps(
            {
                "key": "global/datasets/example_dataset/file1.txt",
                "isUpload": True,
                "fields": mock_fields,
                "conditions": mock_conditions,
            }
        ),
        "headers": {"x-mlspace-dataset-type": "global", "x-mlspace-dataset-scope": "datasets"},
    }

    expected_url = """
        {
            "url":"https://mlspace-data-bucket.s3.amazonaws.com/",
            "fields":{
            "x-amz-meta-user":"jdoe@amazon.com",
            "x-amz-meta-dataset-name":"example_dataset",
            "x-amz-meta-dataset-scope":"global",
            "x-amz-meta-dataset-description":"example description",
            "tagging":[
                {
                    "Key":"user",
                    "Value":"jdoe@amazon.com"
                },
                {
                    "Key":"project",
                    "Value":"example_project"
                },
                {
                    "Key":"system",
                    "Value":"MLSpace"
                },
            ],
            "key":"global/datasets/example_dataset/file1.txt",
            "AWSAccessKeyId":"AAAA1AAAAAA1AAAAAAAA",
            "policy":"mock_policy",
            "signature":"mock_signature"
            }
        }
    """

    expected_response = generate_html_response(200, expected_url)

    mock_s3.generate_presigned_post.return_value = expected_url

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_s3.generate_presigned_post.assert_called_with(
        Bucket=TEST_ENV_CONFIG["DATA_BUCKET"],
        Key="global/datasets/example_dataset/file1.txt",
        Fields=mock_final_fields,
        Conditions=mock_final_conditions,
        ExpiresIn=3600,
    )


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_get_presigned_url_client_error(mock_s3):
    mock_event = {
        "body": json.dumps({"key": "global/datasets/example_dataset/file1.txt"}),
        "headers": {"x-mlspace-dataset-type": "global", "x-mlspace-dataset-scope": "datasets"},
    }

    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }

    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the GeneratePresignedUrl operation: " "Dummy error message.",
    )

    mock_s3.generate_presigned_url.side_effect = ClientError(error_msg, "GeneratePresignedUrl")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_s3.generate_presigned_url.assert_called_with(
        ClientMethod="get_object",
        Params={
            "Bucket": TEST_ENV_CONFIG["DATA_BUCKET"],
            "Key": "global/datasets/example_dataset/file1.txt",
        },
        ExpiresIn=3600,
    )


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_get_presigned_url_generic_error(mock_s3):
    expected_response = generate_html_response(400, "Missing event parameter: 'body'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_s3.generate_presigned_post.assert_not_called()
    mock_s3.generate_presigned_url.assert_not_called()


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_get_presigned_url_manipulated_type(mock_s3):
    mock_event = {
        "headers": {"x-mlspace-dataset-type": "private", "x-mlspace-dataset-scope": "datasets"},
        "body": json.dumps({"key": "global/datasets/example_dataset/file1.txt"}),
    }

    expected_response = generate_html_response(400, "Bad Request: Dataset headers do not match expected type and scope.")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_s3.generate_presigned_url.assert_not_called()


@mock.patch("ml_space_lambda.dataset.lambda_functions.s3")
def test_get_presigned_url_manipulated_scope(mock_s3):
    mock_event = {
        "headers": {"x-mlspace-dataset-type": "private", "x-mlspace-dataset-scope": "jdoe"},
        "body": json.dumps({"key": "private/admin/example_dataset/file1.txt"}),
    }

    expected_response = generate_html_response(400, "Bad Request: Dataset headers do not match expected type and scope.")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_s3.generate_presigned_url.assert_not_called()
