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

from ml_space_lambda.utils.image_uris import check_algorithm_specifications_for_builtin

TEST_ENV_CONFIG = {"LAMBDA_TASK_ROOT": "./src/"}


def _get_test_algorithm_specification(image_uri: str):
    return {
        "TrainingImage": image_uri,
        "TrainingInputMode": "example_training_input_mode",
        "EnableSageMakerMetricsTimeSeries": True,
        "MetricDefinitions": [
            {
                "Name": "custom_metric",
                "Regex": "test:custom",
            },
            {
                "Name": "custom_metric_2",
                "Regex": "validation:custom",
            },
        ],
    }


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_check_algorithm_specification_for_builtin_not_builtin():
    assert (
        check_algorithm_specifications_for_builtin(
            _get_test_algorithm_specification("123456789012.dkr.ecr.us-east-1.amazonaws.com/example_training_image:1")
        )
        is False
    )


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_check_algorithm_specification_for_builtin_is_builtin():
    assert check_algorithm_specifications_for_builtin(
        _get_test_algorithm_specification("123456789012.dkr.ecr.us-east-1.amazonaws.com/xgboost:1")
    )
