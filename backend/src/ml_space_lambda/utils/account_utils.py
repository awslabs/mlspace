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

import boto3

from ml_space_lambda.utils.common_functions import retry_config

sts_client = boto3.client("sts", config=retry_config)
aws_partition = boto3.Session().get_partition_for_region(boto3.Session().region_name)
aws_account = sts_client.get_caller_identity()["Account"]


def get_account_id() -> str:
    return aws_account


def get_partition() -> str:
    return aws_partition


def get_account_arn(service: str, resource: str, region: str = "") -> str:
    return f"arn:{aws_partition}:{service}:{region}:{aws_account}:{resource}"
