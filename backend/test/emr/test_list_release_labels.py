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

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}
mock_context = mock.Mock()
MOCK_RELEASE_LABEL_LIST = ["emr-6.15.0", "emr-6.14.0", "emr-6.13.0"]

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.emr.lambda_functions import list_release_labels


@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_list_emr_clusters_success(mock_emr):
    mock_emr.list_release_labels.return_value = {"ReleaseLabels": MOCK_RELEASE_LABEL_LIST}
    expected_response = generate_html_response(
        200,
        {"ReleaseLabels": MOCK_RELEASE_LABEL_LIST},
    )
    assert list_release_labels({}, mock_context) == expected_response
    mock_emr.list_release_labels.assert_called_with(
        Filters={
            "Prefix": "emr-6",
        }
    )


@mock.patch("ml_space_lambda.emr.lambda_functions.emr")
def test_list_release_labels_client_error(mock_emr):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }
    operation = "ListReleaseLabels"
    expected_response = generate_html_response(
        "400",
        f"An error occurred (MissingParameter) when calling the {operation} operation: Dummy error message.",
    )
    exception_response = ClientError(error_msg, operation)
    mock_emr.list_release_labels.side_effect = exception_response

    assert list_release_labels({}, mock_context) == expected_response
    mock_emr.list_release_labels.assert_called_with(
        Filters={
            "Prefix": "emr-6",
        }
    )
