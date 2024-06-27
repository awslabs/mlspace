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

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.utils.instances import abbreviated_instance_union, kms_unsupported_instances


@mock.patch("ml_space_lambda.utils.instances.ec2")
def test_kms_unsupported_instances(mock_ec2):
    paginator = mock.Mock()
    mock_ec2.get_paginator.return_value = paginator

    instance_types = [
        {"InstanceType": "g4.large"},
        {"InstanceType": "g4.xlarge"},
        {"InstanceType": "g4.2xlarge"},
        {"InstanceType": "g4.4xlarge"},
    ]

    paginator.paginate.return_value = [{"InstanceTypes": instance_types[:2]}, {"InstanceTypes": instance_types[2:]}]
    instances = kms_unsupported_instances()
    assert len(instances) == 4


def test_abbreviated_instance_union():
    s1_instances = [
        # common among both lists
        "g5.large",
        "g5.xlarge",
        "g5.2xlarge",
        # shouldn't be in final list
        "g5s1.large",
        # s1 imperfect match
        "g5cs1.large",
        "g5cs1.xlarge",
        # s1 imperfect match
        "g5cs2.large",
    ]

    s2_instances = [
        # common among both lists
        "g5.large",
        "g5.xlarge",
        "g5.2xlarge",
        # no match
        "g5s2.large",
        # g5cs1 subset
        "g5cs1.large",
        # g5cs2 superset
        "g5cs2.large",
        "g5cs2.xlarge",
    ]

    abbreviated_union = abbreviated_instance_union(s1_instances, s2_instances)

    assert len(abbreviated_union) == 3
    assert "g5.*" in abbreviated_union
    assert "g5cs1.large" in abbreviated_union
    assert "g5cs2.*" in abbreviated_union
