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

import pytest

from ml_space_lambda.utils.image_uri_utils import (
    IMAGE_TO_FRAMEWORK_NAME_CONVERSIONS,
    _repository_name_to_framework,
    delete_metric_definition_for_builtin_algorithms,
)

TEST_ENV_CONFIG = {"LAMBDA_TASK_ROOT": "./src/"}


def test_repository_name_to_framework():
    assert _repository_name_to_framework("noop") == "noop"
    for key in IMAGE_TO_FRAMEWORK_NAME_CONVERSIONS.keys():
        _repository_name_to_framework(key) == IMAGE_TO_FRAMEWORK_NAME_CONVERSIONS[key]


def _get_test_algorithm_specification(image_uri: str, include_metrics_def: bool = True):
    base_specification = {
        "TrainingImage": image_uri,
        "TrainingInputMode": "example_training_input_mode",
        "EnableSageMakerMetricsTimeSeries": True,
    }
    if include_metrics_def:
        base_specification["MetricDefinitions"] = [
            {
                "Name": "custom_metric",
                "Regex": "test:custom",
            },
            {
                "Name": "custom_metric_2",
                "Regex": "validation:custom",
            },
        ]
    return base_specification


@pytest.mark.parametrize(
    "image_uri,include_metrics_def,is_builtin",
    [
        ("123456789012.dkr.ecr.us-east-1.amazonaws.com/example_training_image:1", True, False),
        ("123456789012.dkr.ecr.us-east-1.amazonaws.com/xgboost:1", True, True),
        ("123456789012.dkr.ecr.us-east-1.amazonaws.com/example_training_image:1", False, False),
        ("123456789012.dkr.ecr.us-east-1.amazonaws.com/xgboost:1", False, True),
    ],
    ids=[
        "not_builtin_included_metrics",
        "builtin_included_metrics",
        "not_builtin_no_included_metrics",
        "builtin_no_included_metrics",
    ],
)
@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_check_algorithm_specification_for_builtin(image_uri: str, include_metrics_def: bool, is_builtin: bool):
    assert (
        delete_metric_definition_for_builtin_algorithms(_get_test_algorithm_specification(image_uri, include_metrics_def))
        is is_builtin
    )
