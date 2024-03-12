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
import json
import time
from unittest import mock

from ml_space_lambda.enums import ResourceType
from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.resource_scheduler.lambda_functions import (
        set_resource_termination as lambda_handler,
    )

MOCK_PROJECT_NAME = "UnitTestProject"

mock_event = {
    "requestContext": {
        "authorizer": {"principalId": "some_username", "projectName": MOCK_PROJECT_NAME}
    },
    "body": json.dumps(
        {
            "resourceId": "resource-id",
            "terminationTime": 1669931346,
            "project": MOCK_PROJECT_NAME,
        }
    ),
}
mock_body = json.loads(mock_event["body"])
mock_context = mock.Mock()


class TestResourceSchedulerSetTimeout:
    @mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
    def test_set_resource_termination_cluster(self, mock_resource_scheduler_dao):
        cluster_id = "j-37DVLOLOIVI8H"
        mock_event_emr = copy.deepcopy(mock_event)
        mock_event_emr["pathParameters"] = {"clusterId": cluster_id}
        expected_response = generate_html_response(200, None)

        assert lambda_handler(event=mock_event_emr, context=mock_context) == expected_response

        mock_resource_scheduler_dao.update_termination_time.assert_called_with(
            resource_id=cluster_id,
            resource_type=ResourceType.EMR_CLUSTER,
            new_termination_time=mock_body["terminationTime"],
            project=MOCK_PROJECT_NAME,
        )

    @mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.get_notebook_stop_time")
    @mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
    def test_set_resource_termination_notebook(
        self, mock_resource_scheduler_dao, mock_get_notebook_stop_time
    ):
        notebook_name = "Jack"
        mock_event_notebook = copy.deepcopy(mock_event)
        mock_event_notebook["pathParameters"] = {"notebookName": notebook_name}
        mock_get_notebook_stop_time.return_value = mock_body["terminationTime"]
        expected_response = generate_html_response(200, None)

        assert lambda_handler(event=mock_event_notebook, context=mock_context) == expected_response

        mock_get_notebook_stop_time.assert_called_with(
            time.strftime("%H:%M", time.gmtime(mock_body["terminationTime"]))
        )
        mock_resource_scheduler_dao.update_termination_time.assert_called_with(
            resource_id=notebook_name,
            resource_type=ResourceType.NOTEBOOK,
            new_termination_time=mock_body["terminationTime"],
            project=MOCK_PROJECT_NAME,
        )

    @mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.get_notebook_stop_time")
    @mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
    def test_set_resource_termination_no_termination_notebook(
        self, mock_resource_scheduler_dao, mock_get_notebook_stop_time
    ):
        notebook_name = "Jack"
        mock_event_notebook = copy.deepcopy(mock_event)
        mock_event_notebook["pathParameters"] = {"notebookName": notebook_name}
        mock_event_notebook["body"] = json.dumps(
            {
                "resourceId": "resource-id",
                "project": MOCK_PROJECT_NAME,
            }
        )
        expected_response = generate_html_response(200, None)

        assert lambda_handler(event=mock_event_notebook, context=mock_context) == expected_response

        mock_get_notebook_stop_time.assert_not_called()
        mock_resource_scheduler_dao.delete.assert_called_with(
            resource_id=notebook_name, resource_type=ResourceType.NOTEBOOK
        )

    @mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
    def test_set_resource_termination_endpoint(self, mock_resource_scheduler_dao):
        endpoint_name = "Jill"
        mock_event_endpoint = copy.deepcopy(mock_event)
        mock_event_endpoint["pathParameters"] = {"endpointName": endpoint_name}
        expected_response = generate_html_response(200, None)

        assert lambda_handler(event=mock_event_endpoint, context=mock_context) == expected_response

        mock_resource_scheduler_dao.update_termination_time.assert_called_with(
            resource_id=endpoint_name,
            resource_type=ResourceType.ENDPOINT,
            new_termination_time=mock_body["terminationTime"],
            project=MOCK_PROJECT_NAME,
        )

    @mock.patch("ml_space_lambda.resource_scheduler.lambda_functions.resource_scheduler_dao")
    def test_set_resource_termination_no_termtime_set(self, mock_resource_scheduler_dao):
        endpoint_name = "Bob"
        new_mock_event = {
            "requestContext": {
                "authorizer": {"principalId": "some_username", "projectName": MOCK_PROJECT_NAME}
            },
            "pathParameters": {"endpointName": endpoint_name},
            "body": json.dumps(
                {
                    "resourceId": "resource-id",
                    "resourceType": "resource-type",
                    "project": MOCK_PROJECT_NAME,
                }
            ),
        }
        expected_response = generate_html_response(200, None)
        assert lambda_handler(event=new_mock_event, context=mock_context) == expected_response

        mock_resource_scheduler_dao.delete.assert_called_with(
            resource_id=endpoint_name, resource_type=ResourceType.ENDPOINT
        )

    def test_set_resource_termination_unknown_service(self):
        mock_event["pathParameters"] = {"unknownService": "unknown"}

        expected_response = generate_html_response(
            400,
            "Bad Request: Unable to determine which resource termination time to update.",
        )

        assert expected_response == lambda_handler(event=mock_event, context=mock_context)
