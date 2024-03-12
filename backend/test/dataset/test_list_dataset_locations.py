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

import ml_space_lambda.utils.mlspace_config as mlspace_config
from ml_space_lambda.data_access_objects.dataset import DatasetModel
from ml_space_lambda.enums import DatasetType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "DATA_BUCKET": "mlspace-data-bucket"}

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.dataset.lambda_functions import list_locations as lambda_handler

mock_event = {
    "pathParameters": {"scope": DatasetType.GLOBAL.value, "type": DatasetType.GLOBAL.value}
}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_dataset_locations_success(mock_dataset_dao, mock_global_dataset):
    # clear out global config if set to make lambda tests independent of each other
    mlspace_config.env_variables = {}
    locations = [
        {
            "name": mock_global_dataset.name,
            "location": mock_global_dataset.location,
        },
        {
            "name": "example_dataset_2",
            "location": f"s3://{TEST_ENV_CONFIG['DATA_BUCKET']}/global/datasets/example_dataset_2",
        },
        {
            "name": "example_dataset_3",
            "location": f"s3://{TEST_ENV_CONFIG['DATA_BUCKET']}/global/datasets/example_dataset_3",
        },
    ]
    base_ds = mock_global_dataset.to_dict()
    expected_response = generate_html_response(
        200,
        {
            "bucket": f"s3://{TEST_ENV_CONFIG['DATA_BUCKET']}",
            "locations": locations,
        },
    )

    mock_dataset_dao.get_all_for_scope.return_value = [
        mock_global_dataset,
        DatasetModel.from_dict({**base_ds, **locations[1]}),
        DatasetModel.from_dict({**base_ds, **locations[2]}),
    ]

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_dataset_dao.get_all_for_scope.assert_called_with(
        DatasetType.GLOBAL, DatasetType.GLOBAL.value
    )


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_dataset_locations_client_error(mock_dataset_dao):
    error_msg = {
        "Error": {"Code": "ThrottlingException", "Message": "Dummy error message."},
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    expected_response = generate_html_response(
        400,
        "An error occurred (ThrottlingException) when calling the Query operation: Dummy error message.",
    )
    mock_dataset_dao.get_all_for_scope.side_effect = ClientError(error_msg, "Query")

    assert lambda_handler(mock_event, mock_context) == expected_response

    mock_dataset_dao.get_all_for_scope.assert_called_with(
        DatasetType.GLOBAL, DatasetType.GLOBAL.value
    )


@mock.patch("ml_space_lambda.dataset.lambda_functions.dataset_dao")
def test_list_dataset_locations_missing_parameters(mock_dataset_dao):
    expected_response = generate_html_response(400, "Missing event parameter: 'pathParameters'")
    assert lambda_handler({}, mock_context) == expected_response
    mock_dataset_dao.get_all_for_scope.assert_not_called()
