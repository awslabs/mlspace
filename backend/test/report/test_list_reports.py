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

from datetime import datetime
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}
mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.report.lambda_functions import list

MOCK_DATE_FROM_S3 = datetime(2022, 12, 21, 20, 14, 3)
MOCK_MODIFIED_DATE = "2022-12-21 20:14:03 GMT"

paginate_response = [
    {
        "Contents": [
            {
                "Key": "mlspace-report/response1-file1",
                "LastModified": MOCK_DATE_FROM_S3,
            },
            {
                "Key": "mlspace-report/response1-file2",
                "LastModified": MOCK_DATE_FROM_S3,
            },
            {
                "Key": "mlspace-report/response1-file3",
                "LastModified": MOCK_DATE_FROM_S3,
            },
        ]
    },
    {
        "Contents": [
            {
                "Key": "mlspace-report/response2-file1",
                "LastModified": MOCK_DATE_FROM_S3,
            },
            {
                "Key": "mlspace-report/response2-file2",
                "LastModified": MOCK_DATE_FROM_S3,
            },
        ],
    },
    {
        "Contents": [
            {
                "Key": "mlspace-report/response3-file1",
                "LastModified": MOCK_DATE_FROM_S3,
            },
        ],
    },
    {
        "IsTruncated": False,
    },
]

mock_response = [
    {
        "Name": "response1-file1",
        "LastModified": MOCK_MODIFIED_DATE,
    },
    {
        "Name": "response1-file2",
        "LastModified": MOCK_MODIFIED_DATE,
    },
    {
        "Name": "response1-file3",
        "LastModified": MOCK_MODIFIED_DATE,
    },
    {
        "Name": "response2-file1",
        "LastModified": MOCK_MODIFIED_DATE,
    },
    {
        "Name": "response2-file2",
        "LastModified": MOCK_MODIFIED_DATE,
    },
    {
        "Name": "response3-file1",
        "LastModified": MOCK_MODIFIED_DATE,
    },
]


@mock.patch("ml_space_lambda.report.lambda_functions.s3")
def test_list_reports_success(mock_s3):
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = paginate_response
    mock_s3.get_paginator.return_value = mock_paginator

    mock_s3.list_reports.return_value = mock_response

    expected_response = generate_html_response(200, mock_response)

    assert list({}, mock_context) == expected_response

    mock_paginator.paginate.assert_called_with(
        Bucket="mlspace-data-bucket", Prefix="mlspace-report"
    )


@mock.patch("ml_space_lambda.report.lambda_functions.s3")
def test_list_reports_client_error(mock_s3):
    error_msg = {
        "Error": {"Code": "MissingParameter", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": "400"},
    }

    expected_response = generate_html_response(
        "400",
        "An error occurred (MissingParameter) when calling the GetPaginator operation: Dummy error message.",
    )

    mock_s3.get_paginator.side_effect = ClientError(error_msg, "GetPaginator")
    assert list({}, mock_context) == expected_response
