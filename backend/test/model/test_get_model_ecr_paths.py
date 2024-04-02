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


# The sagemaker SDK isn't directly compatible with Lambda
# https://github.com/aws/sagemaker-python-sdk/issues/1200
from unittest import mock

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1", "LAMBDA_TASK_ROOT": "./src/"}
mock_context = mock.Mock()
expected_images = {
    "blazingtext": "811284229777.dkr.ecr.us-east-1.amazonaws.com/blazingtext:1",
    "factorization-machines": "382416733822.dkr.ecr.us-east-1.amazonaws.com/factorization-machines:1",
    "forecasting-deepar": "522234722520.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:1",
    "image-classification": "811284229777.dkr.ecr.us-east-1.amazonaws.com/image-classification:1",
    "linear-learner": "382416733822.dkr.ecr.us-east-1.amazonaws.com/linear-learner:1",
    "kmeans": "382416733822.dkr.ecr.us-east-1.amazonaws.com/kmeans:1",
    "knn": "382416733822.dkr.ecr.us-east-1.amazonaws.com/knn:1",
    "object2vec": "382416733822.dkr.ecr.us-east-1.amazonaws.com/object2vec:1",
    "pca": "382416733822.dkr.ecr.us-east-1.amazonaws.com/pca:1",
    "xgboost": "811284229777.dkr.ecr.us-east-1.amazonaws.com/xgboost:latest",
    "semantic-segmentation": "811284229777.dkr.ecr.us-east-1.amazonaws.com/semantic-segmentation:1",
    "object-detection": "811284229777.dkr.ecr.us-east-1.amazonaws.com/object-detection:1",
}

# Need to mock the region in order to do the import......
with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.model.lambda_functions import list_images as lambda_handler


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_get_models_ecr_paths_success():
    expected_response = generate_html_response(200, expected_images)

    assert lambda_handler({}, mock_context) == expected_response


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_get_training_models_ecr_paths_success():
    expected_response = generate_html_response(200, expected_images)

    assert lambda_handler({"queryStringParameters": {"imageScope": "training"}}, mock_context) == expected_response


@mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True)
def test_get_invalid_models_ecr_paths_success():
    bad_scope = "invalid"
    expected_response = generate_html_response(
        400,
        f"Bad Request: Unsupported image scope: {bad_scope}. You may need to upgrade your SDK version (pip install -U sagemaker) for newer image scopes. Supported image scope(s): inference, training.",
    )

    assert lambda_handler({"queryStringParameters": {"imageScope": bad_scope}}, mock_context) == expected_response
