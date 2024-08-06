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

from ml_space_lambda.data_access_objects.group import GroupModel
from ml_space_lambda.data_access_objects.user import UserModel
from ml_space_lambda.utils import mlspace_config
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.group.lambda_functions import create as lambda_handler

MOCK_GROUP_NAME = "UnitTestGroup"
MOCK_TIMESTAMP = 1669931346
MOCK_USERNAME = "jdoe@example.com"
MOCK_USER = UserModel(MOCK_USERNAME, MOCK_USERNAME, "John Doe", False, [])

mock_context = mock.Mock()


def _mock_event(group_name: str = MOCK_GROUP_NAME):
    return {
        "requestContext": {"authorizer": {"principalId": MOCK_USERNAME}},
        "body": json.dumps({"name": group_name, "description": "Group for unit tests"}),
    }


@mock.patch("ml_space_lambda.data_access_objects.group.time")
@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_create_group(mock_group_dao, mock_time):
    mlspace_config.env_variables = {}
    mock_group_dao.get.return_value = None
    expected_response = generate_html_response(200, f"Successfully created group '{MOCK_GROUP_NAME}'")

    mock_time.time.return_value = MOCK_TIMESTAMP

    assert lambda_handler(_mock_event(), mock_context) == expected_response
    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)

    mock_group_dao.create.assert_called_once()
    assert (
        mock_group_dao.create.call_args.args[0].to_dict()
        == GroupModel(
            name=MOCK_GROUP_NAME,
            description="Group for unit tests",
            created_by=MOCK_USERNAME,
        ).to_dict()
    )


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_create_group_invalid_characters(mock_group_dao):
    expected_response = generate_html_response(400, "Bad Request: Group name contains invalid character.")

    assert lambda_handler(_mock_event("Crazy!NameFor $$$"), mock_context) == expected_response
    mock_group_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_create_group_long_name(mock_group_dao):
    expected_response = generate_html_response(400, "Bad Request: Group name exceeded the maximum allowable length of 24.")

    assert lambda_handler(_mock_event("ThisIsAVeryLongGroupName_TooLongInFact"), mock_context) == expected_response
    mock_group_dao.get.assert_not_called()


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_create_group_name_not_unique(mock_group_dao):
    mock_group_dao.get.return_value = GroupModel(
        name=MOCK_GROUP_NAME,
        description="Nothing here",
        created_by="matt@example.com",
    )

    expected_response = generate_html_response(
        400,
        "Bad Request: Group name already exists.",
    )

    assert lambda_handler(_mock_event(), mock_context) == expected_response
    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_create_group_client_error(mock_group_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling" " the GetItem operation: Dummy error message.",
    )

    mock_group_dao.get.side_effect = ClientError(error_msg, "GetItem")

    assert lambda_handler(_mock_event(), mock_context) == expected_response
    mock_group_dao.get.assert_called_with(MOCK_GROUP_NAME)


@mock.patch("ml_space_lambda.group.lambda_functions.group_dao")
def test_create_group_bad_request(mock_group_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'requestContext'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_group_dao.create.assert_not_called()
