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

import logging

# The sagemaker SDK isn't directly compatible with Lambda
# https://github.com/aws/sagemaker-python-sdk/issues/1200
# To get around this we just grabbed the single file of the SDK that we need in order to generate
# image URIs
from ml_space_lambda.utils.image_uris import retrieve

logger = logging.getLogger(__name__)

IMAGE_TO_FRAMEWORK_NAME_CONVERSIONS = {"sagemaker-xgboost": "xgboost"}


def _repository_name_to_framework(framework) -> str:
    if framework in IMAGE_TO_FRAMEWORK_NAME_CONVERSIONS:
        return IMAGE_TO_FRAMEWORK_NAME_CONVERSIONS[framework]
    else:
        return framework


def _get_image_components(image_uri) -> dict:
    split = image_uri.split("/")
    region_info_split = split[0].split(".")
    repository_info_split = split[1].split(":")
    return {
        "region": region_info_split[3],
        "framework": _repository_name_to_framework(repository_info_split[0]),
        "version": repository_info_split[1],
    }


def delete_metric_definition_for_builtin_algorithms(algorithm_specifications) -> bool:
    # If the image is a known AWS built-in container
    image_components = _get_image_components(algorithm_specifications["TrainingImage"])
    try:
        # If the retrieve is successful, then the image/framework is a built-in algorithm
        retrieve(
            image_components["framework"], image_components["region"], version=image_components["version"], image_scope=None
        )
        del algorithm_specifications["MetricDefinitions"]
        return True
    except IOError:
        # An exception occurs if the image/framework is not a detected built-in
        return False
