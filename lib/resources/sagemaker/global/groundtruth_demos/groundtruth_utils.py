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

_account_map = {
    "us-east-1": "432418664414",
    "us-east-2": "266458841044",
    "us-west-2": "081040173940",
    "eu-west-1": "568282634449",
    "ap-northeast-1": "477331159723",
    "ap-southeast-2": "454466003867",
    "ap-south-1": "565803892007",
    "eu-central-1": "203001061592",
    "ap-northeast-2": "845288260483",
    "eu-west-2": "487402164563",
    "ap-southeast-1": "377565633583",
    "ca-central-1": "918755190332",
    "us-iso-east-1": "403361949736",
    "us-isob-east-1": "492044955883"
}

_assets_domain_map = {
    "us-iso-east-1": "crowd-html-elements-us-iso-east-1.s3.us-iso-east-1.c2s.ic.gov",
    "us-isob-east-1": "crowd-html-elements-us-isob-east-1.s3.us-isob-east-1.sc2s.sgov.gov"
}

_documentation_domain_map = {
    "aws-iso": "docs.c2shome.ic.gov",
    "aws-iso-b": "docs.sc2shome.sgov.gov"
}

_lambda_types = ["ACS", "PRE"]

_task_types = [
    "BoundingBox",
    "ImageMultiClass",
    "ImageMultiClassMultiLabel",
    "SemanticSegmentation",
    "TextMultiClass",
    "TextMultiClassMultiLabel",
    "NamedEntityRecognition",
    "VideoMultiClass",
    "VideoObjectDetection",
    "VideoObjectTracking",
    "3DPointCloudObjectDetection",
    "3DPointCloudObjectTracking",
    "3DPointCloudSemanticSegmentation",
    "AdjustmentSemanticSegmentation",
    "VerificationSemanticSegmentation",
    "AdjustmentBoundingBox",
    "VerificationBoundingBox",
    "AdjustmentVideoObjectDetection",
    "AdjustmentVideoObjectTracking",
    "Adjustment3DPointCloudObjectDetection",
    "Adjustment3DPointCloudObjectTracking",
    "Adjustment3DPointCloudSemanticSegmentation"
]


def get_documentation_domain(partition):
    return _documentation_domain_map.get(partition, "docs.aws.amazon.com")


def get_groundtruth_assets_domain(region):
    return _assets_domain_map.get(region, "assets.crowd.aws")


def get_groundtruth_lambda_arn(lambda_type, task_type, boto_session):
    """
    Helper function for retrieving Ground Truth Lambda ARNs specified in the GT API documentation for built-in tasks.
        Ground Truth does not provide an API to programmatically retrieve these ARNs
    :param lambda_type: Must be one of ["ACS", "PRE"] to specify if the Lambda is for AnnotationConsolidation (ACS)
        or for PreHumanTask (PRE)
    :param task_type: Must be one of the built-in task types defined in the Ground Truth documentation.
    :param boto_session: Boto3 session for retrieving region and partition information to construct an ARN
    :return: Lambda ARN for the specified Lambda and Task types in the current region
    """
    region = boto_session.region_name
    arn_partition = boto_session.get_partition_for_region(region)
    account = _account_map[region]

    # Validate parameters
    if lambda_type not in _lambda_types:
        raise RuntimeError(f"'lambda_type' must be one of {_lambda_types}")
    if task_type not in _task_types:
        raise RuntimeError(f"'task_type' must be one of {_task_types}")

    return f"arn:{arn_partition}:lambda:{region}:{account}:function:{lambda_type}-{task_type}"

