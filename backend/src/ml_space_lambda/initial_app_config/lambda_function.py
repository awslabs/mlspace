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

# TODO: create a lambda handler. We accept the service type as an argument. We then map that service type to
# the instance type it needs when we call compute types. We parse out the instances from compute types,
# put those in a big list, and then use those to make a PUT call to the app config table
import json
import logging

import boto3
from dynamodb_json import json_util as dynamodb_json

from ml_space_lambda.data_access_objects.dynamo_data_store import DynamoDBObjectStore
from ml_space_lambda.enums import ServiceType
from ml_space_lambda.metadata.lambda_functions import get_compute_types
from ml_space_lambda.utils.mlspace_config import get_environment_variables, retry_config

log = logging.getLogger(__name__)
ddb = boto3.client("dynamodb", config=retry_config)


def lambda_handler(event, context):
    instances = get_compute_types()
    initial_config_dao = InitialConfigDAO()
    resp = initial_config_dao.get("global", 1)
    config = resp[0]["configuration"]

    config["EnabledInstanceTypes"][ServiceType.NOTEBOOK.value] = instances["InstanceTypes"]["InstanceType"]
    config["EnabledInstanceTypes"][ServiceType.TRAINING_JOB.value] = instances["InstanceTypes"]["TrainingInstanceType"]
    config["EnabledInstanceTypes"][ServiceType.TRANSFORM_JOB.value] = instances["InstanceTypes"]["TransformInstanceType"]
    config["EnabledInstanceTypes"][ServiceType.ENDPOINT.value] = instances["InstanceTypes"]["ProductionVariantInstanceType"]

    initial_config_dao.update(config)


class InitialConfigDAO(DynamoDBObjectStore):
    def __init__(self):
        self.env_vars = get_environment_variables()
        table_name = self.env_vars["APP_CONFIGURATION_TABLE"]
        DynamoDBObjectStore.__init__(self, table_name=table_name)

    def get(self, configScope: str, num_versions: int):
        json_response = self._query(
            key_condition_expression="#s = :configScope",
            expression_names={"#s": "configScope"},
            expression_values=json.loads(dynamodb_json.dumps({":configScope": configScope})),
            limit=num_versions,
            page_response=True,
            scan_index_forward=False,
        ).records
        return json_response

    def update(self, config: dict) -> None:
        json_key = {"configScope": "global", "versionId": 0}
        update_exp = "SET configuration = :config"
        exp_values = json.loads(dynamodb_json.dumps({":config": config}))
        self._update(
            json_key=json_key,
            update_expression=update_exp,
            expression_values=exp_values,
        )
