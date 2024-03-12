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

import json
import os
from enum import auto, Enum

import boto3
from botocore.config import Config

s3 = boto3.client(
    "s3",
    config=Config(
        retries={
            "max_attempts": 3,
            "mode": "standard",
        },
        signature_version="s3v4",
    ),
)


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
    "us-isob-east-1": "492044955883",
}

_assets_domain_map = {
    "us-iso-east-1": "crowd-html-elements-us-iso-east-1.s3.us-iso-east-1.c2s.ic.gov",
    "us-isob-east-1": "crowd-html-elements-us-isob-east-1.s3.us-isob-east-1.sc2s.sgov.gov",
}


class LambdaTypes(str, Enum):
    ACS = auto()
    PRE = auto()


class TaskTypes(str, Enum):
    BoundingBox = auto()
    ImageMultiClass = auto()
    ImageMultiClassMultiLabel = auto()
    SemanticSegmentation = auto()
    LabelVerification = auto()
    TextMultiClass = auto()
    TextMultiClassMultiLabel = auto()
    NamedEntityRecognition = auto()


_auto_labeling_task_arn_map = {
    TaskTypes.BoundingBox: "image-classification",
    TaskTypes.ImageMultiClass: "image-classification",
    TaskTypes.ImageMultiClassMultiLabel: "image-classification",
    TaskTypes.SemanticSegmentation: "semantic-segmentation",
    TaskTypes.LabelVerification: "image-classification",
    TaskTypes.TextMultiClass: "text-classification",
    TaskTypes.TextMultiClassMultiLabel: "text-classification",
    TaskTypes.NamedEntityRecognition: "text-classification",
}


def get_groundtruth_assets_domain():
    session = boto3.session.Session()
    region = session.region_name

    return _assets_domain_map.get(region, "assets.crowd.aws")


def get_groundtruth_lambda_arn(lambda_type: LambdaTypes, task_type: TaskTypes):
    """
    Helper function for retrieving Ground Truth Lambda ARNs specified in the GT API documentation for built-in tasks.
        Ground Truth does not provide an API to programmatically retrieve these ARNs
    :param lambda_type: Must be one of ["ACS", "PRE"] to specify if the Lambda is for AnnotationConsolidation (ACS)
        or for PreHumanTask (PRE)
    :param task_type: Must be one of the built-in task types defined in the Ground Truth documentation.
    :param boto_session: Boto3 session for retrieving region and partition information to construct an ARN
    :return: Lambda ARN for the specified Lambda and Task types in the current region
    """
    session = boto3.session.Session()
    region = session.region_name
    arn_partition = session.get_partition_for_region(region)
    account = _account_map[region]

    return f"arn:{arn_partition}:lambda:{region}:{account}:function:{lambda_type.name}-{task_type.name}"


def get_auto_labeling_arn(task_type: TaskTypes):
    session = boto3.session.Session()
    region = session.region_name
    arn_partition = session.get_partition_for_region(region)
    account = _account_map[region]

    return f"arn:{arn_partition}:sagemaker:{region}:{account}:labeling-job-algorithm-specification/{_auto_labeling_task_arn_map[task_type]}"


def generate_labels_configuration_file(
    labels: list, job_name: str, data_bucket_name: str, output_dir_key: str
) -> str:
    labels_config = {"document-version": "2018-11-28", "labels": labels}
    s3_key = f"{output_dir_key}/{job_name}/annotation-tool/data.json"
    s3.put_object(Bucket=data_bucket_name, Key=s3_key, Body=json.dumps(labels_config))
    return f"s3://{data_bucket_name}/{s3_key}"


def generate_ui_template(
    job_name: str,
    task_type: TaskTypes,
    description: str,
    full_instructions: str,
    short_instructions: str,
    data_bucket_name: str,
    output_dir_key: str,
) -> str:
    template_key = None
    template_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "labeling_job_templates",
        f"{task_type.name}.html",
    )
    if os.path.isfile(template_path):
        file_content: list[str] = []
        with open(template_path, "r") as template_file:
            for line in template_file.readlines():
                if "{ASSET_JS}" in line:
                    file_content.append(
                        line.replace(
                            "{ASSET_JS}",
                            f"https://{get_groundtruth_assets_domain()}/crowd-html-elements.js",
                        )
                    )
                elif "<!-- full-instructions start marker -->" in line:
                    file_content.append(line)
                    file_content.append(full_instructions)
                elif "<!-- short-instructions start marker -->" in line:
                    file_content.append(line)
                    file_content.append(short_instructions)
                elif "DESCRIPTION_STUB" in line:
                    file_content.append(line.replace("DESCRIPTION_STUB", description))
                else:
                    file_content.append(line)
        template_key = f"{output_dir_key}/{job_name}/annotation-tool/template.liquid"
        s3.put_object(Bucket=data_bucket_name, Key=template_key, Body="\n".join(file_content))
    else:
        raise Exception(f"Labeling job template for {template_path} does not exist.")
    return f"s3://{data_bucket_name}/{template_key}" if template_key is not None else None
