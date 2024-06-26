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

from ml_space_lambda.enums import ServiceType

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}

mock_context = mock.Mock()
mock_event = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.initial_app_config.lambda_function import lambda_handler


def generate_config(notebook_list=[], endpoint_list=[], training_list=[], transform_list=[]):
    return {
        "configScope": "global",
        "versionId": 0,
        "changeReason": "Testing",
        "createdAt": 1,
        "configuration": {
            "EnabledInstanceTypes": {
                ServiceType.NOTEBOOK.value: notebook_list,
                ServiceType.ENDPOINT.value: endpoint_list,
                ServiceType.TRAINING_JOB.value: training_list,
                ServiceType.TRANSFORM_JOB.value: transform_list,
            },
        },
    }


MOCK_COMPUTE_TYPES = {
    "InstanceTypes": {
        "InstanceType": "ml.t2.medium",
        "TrainingInstanceType": "ml.t3.medium",
        "TransformInstanceType": "ml.t4.medium",
        "ProductionVariantInstanceType": "ml.t5.medium",
    }
}


@mock.patch("ml_space_lambda.initial_app_config.lambda_function.update_dynamic_roles_with_notebook_policies")
@mock.patch("ml_space_lambda.initial_app_config.lambda_function.get_compute_types")
@mock.patch("ml_space_lambda.initial_app_config.lambda_function.update_instance_constraint_policies")
@mock.patch("ml_space_lambda.initial_app_config.lambda_function.app_configuration_dao")
def test_initial_config_success(
    mock_app_config_dao,
    mock_update_instance_constraint_policies,
    mock_compute_types,
    update_dynamic_roles_with_notebook_policies,
):
    mock_app_config_dao.get.return_value = [generate_config()]
    mock_app_config_dao.update.return_value = None
    mock_compute_types.return_value = MOCK_COMPUTE_TYPES

    lambda_handler(mock_event, mock_context)

    generated_config = generate_config(
        notebook_list=MOCK_COMPUTE_TYPES["InstanceTypes"]["InstanceType"],
        endpoint_list=MOCK_COMPUTE_TYPES["InstanceTypes"]["ProductionVariantInstanceType"],
        training_list=MOCK_COMPUTE_TYPES["InstanceTypes"]["TrainingInstanceType"],
        transform_list=MOCK_COMPUTE_TYPES["InstanceTypes"]["TransformInstanceType"],
    )

    # The outgoing config should now contain the instance types for each service
    mock_app_config_dao.update.assert_called_with(generated_config)

    mock_update_instance_constraint_policies.assert_called_with(generated_config, mock_context)
