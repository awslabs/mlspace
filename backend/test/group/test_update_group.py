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
import time
from typing import Any, Dict, Optional
from unittest import mock

from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import update as lambda_handler

mock_context = mock.Mock()

MOCK_GROUP_NAME = "UnitTestGroup"
now = time.time()


def _mock_event(
    description: Optional[str] = None,
) -> Dict[str, Any]:
    body: Dict[str, Any] = {}
    if description:
        body["description"] = description
    return {
        "requestContext": {"authorizer": {"principalId": "jdoe@example.com"}},
        "pathParameters": {"groupName": MOCK_GROUP_NAME},
        "body": json.dumps(body),
    }


def mock_group(
    description: Optional[str] = None,
) -> GroupModel:
    return GroupModel(
        name=MOCK_GROUP_NAME,
        description="Group for unit tests" if not description else description,
        created_by="jdoe@example.com",
        created_at=now,
        last_updated_at=now,
    )


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_update_group_description(mock_group_dao):
    expected_response = generate_html_response(200, f"Successfully updated {MOCK_GROUP_NAME}")
    updated_desc = "This is a newly updated description"
    mock_group_dao.get.return_value = mock_group()

    assert lambda_handler(_mock_event(updated_desc), mock_context) == expected_response

    expected_group = mock_group().to_dict()
    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)
    # The create arg is the GroupModel, we can't do a normal assert_called_with
    # because the arg is a class so the comparison will fail due to pointer issues
    mock_group_dao.update.assert_called_once()
    assert mock_group_dao.update.call_args.args[0] == MOCK_GROUP_NAME
    actual = mock_group_dao.update.call_args.args[1].to_dict()
    assert actual["name"] == expected_group["name"]
    assert actual["description"] == updated_desc
    assert actual["createdBy"] == expected_group["createdBy"]
    assert actual["createdAt"] <= actual["lastUpdatedAt"]
    assert actual["lastUpdatedAt"] >= expected_group["lastUpdatedAt"]


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_update_group_nonexistent(mock_group_dao):
    expected_response = generate_html_response(
        400,
        "Bad Request: Specified group does not exist",
    )
    mock_group_dao.get.return_value = None
    assert lambda_handler(_mock_event(), mock_context) == expected_response

    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)
    mock_group_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_update_group_client_error(mock_group_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the GetItem operation: Dummy error message.",
    )
    mock_group_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(_mock_event(), mock_context) == expected_response

    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)
    mock_group_dao.update.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_update_group_missing_param(mock_group_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_group_dao.get.assert_not_called()
    mock_group_dao.update.assert_not_called()
