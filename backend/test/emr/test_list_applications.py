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

from ml_space_lambda.utils.common_functions import generate_html_response

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

mock_context = mock.Mock()

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.emr import lambda_functions as emr_handler


MOCK_APPLICATION_LIST = [
    "Python",
    "Scala",
    "Delta",
    "Flink",
    "Ganglia",
    "HBase",
    "HCatalog",
    "Hadoop",
    "Hive",
    "Hudi",
    "Hue",
    "JupyterHub",
    "Livy",
    "MXNet",
    "Oozie",
    "Phoenix",
    "Presto",
    "Spark",
    "Tensorflow",
    "Tez",
    "Zeppelin",
    "Zookeeper",
]


def test_list_applications():
    expected_response = generate_html_response(200, MOCK_APPLICATION_LIST)
    assert emr_handler.list_applications({}, mock_context) == expected_response
