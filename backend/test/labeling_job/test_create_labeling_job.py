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

# Testing for the describe_labeling_job Lambda function.
from unittest import mock

from ml_space_lambda.utils.common_functions import generate_html_response, generate_tags

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.labeling_job.lambda_functions import create as lambda_handler

labeling_job_name = "example_labeling_job_name"
data_bucket_name = "mlspace-data-012345678910"

mock_event = {"pathParameters": {"jobName": f"{labeling_job_name}"}}
mock_context = mock.Mock()


@mock.patch("ml_space_lambda.labeling_job.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.labeling_job.lambda_functions.project_user_dao")
@mock.patch("ml_space_lambda.labeling_job.lambda_functions.pull_config_from_s3")
@mock.patch("ml_space_lambda.labeling_job.lambda_functions.get_groundtruth_lambda_arn")
@mock.patch("ml_space_lambda.labeling_job.lambda_functions.get_auto_labeling_arn")
@mock.patch("ml_space_lambda.labeling_job.lambda_functions.generate_ui_template")
@mock.patch("ml_space_lambda.labeling_job.lambda_functions.generate_labels_configuration_file")
@mock.patch("ml_space_lambda.labeling_job.lambda_functions.get_environment_variables")
@mock.patch("ml_space_lambda.labeling_job.lambda_functions.sagemaker")
def test_create_labeling_job(
    mock_sagemaker,
    mock_get_environment_variables,
    mock_generate_labels_configuration_file,
    mock_generate_ui_template,
    mock_get_auto_labeling_arn,
    mock_get_groundtruth_lambda_arn,
    mock_pull_config_from_s3,
    mock_project_user_dao,
    resource_metadata_dao,
):
    mock_get_environment_variables.return_value = {
        "MANAGE_IAM_ROLES": "True",
        "SYSTEM_TAG": "mlspace",
    }

    mock_pull_config_from_s3.return_value = {
        "pSMSDataBucketName": data_bucket_name,
        "pSMSRoleARN": "arn:aws:iam::012345678910:role/MyAppRole",
        "pSMSSubnetIds": "subnet-1,subnet-2",
        "pSMSSecurityGroupId": "securitygroupid",
    }

    mock_response = {"LabelingJobArn": "arn:aws:sagemaker:us-east-1:012345678910:labeling-job/my-labeling-job"}

    mock_project_user_dao.get().role = "arn:aws:iam::012345678910:role/MyUserRole"
    mock_generate_ui_template.return_value = "s3://bucket/path/to/template.liquid"
    mock_get_groundtruth_lambda_arn.side_effect = [
        "arn:aws:lambda::012345678910:PRE-SemanticSegmentation",
        "arn:aws:lambda::012345678910:ACS-SemanticSegmentation",
    ]
    mock_get_auto_labeling_arn.return_value = (
        "arn:sagemaker:us-east-1:012345678910:labeling-job-algorithm-speicfication/image-classification"
    )
    mock_sagemaker.create_labeling_job.return_value = mock_response
    mock_generate_labels_configuration_file.return_value = "s3://bucket/path/to/output/myjob/annotation-tool/data.json"

    # check the happy path
    expected_response = generate_html_response(200, mock_response)
    assert lambda_handler(create_create_event(), mock_context) == expected_response

    args = {
        "ui_template_s3_uri": "s3://bucket/path/to/template.liquid",
        "annotation_consolidation_lambda_arn": "arn:aws:lambda::012345678910:ACS-SemanticSegmentation",
        "s3_output_path": "/path/to/output",
        "labeling_job_algorithm_specification_arn": "arn:sagemaker:us-east-1:012345678910:labeling-job-algorithm-speicfication/image-classification",
        "security_group_ids": "securitygroupid",
        "subnets": ["subnet-1"],
        "label_category_config_s3_uri": "s3://bucket/path/to/output/myjob/annotation-tool/data.json",
        "role_arn": "arn:aws:iam::012345678910:role/MyUserRole",
        "pre_human_task_lambda_arn": "arn:aws:lambda::012345678910:PRE-SemanticSegmentation",
        "tags": generate_tags("auser", "myproject", "mlspace"),
    }
    mock_sagemaker.create_labeling_job.assert_called_with(**create_labeling_job(**args))
    mock_generate_labels_configuration_file.assert_called_with([], "myjob", data_bucket_name, "path/to/output")

    # check happy path with app role
    mock_get_environment_variables.return_value = {
        "MANAGE_IAM_ROLES": "",
        "SYSTEM_TAG": "mlspace",
    }
    mock_get_groundtruth_lambda_arn.side_effect = [
        "arn:aws:lambda::012345678910:PRE-SemanticSegmentation",
        "arn:aws:lambda::012345678910:ACS-SemanticSegmentation",
    ]
    lambda_handler(
        create_create_event(
            labeling_job_algorithms_config=False,
        ),
        mock_context,
    )
    args["role_arn"] = "arn:aws:iam::012345678910:role/MyAppRole"
    args["labeling_job_algorithms_config"] = False
    mock_sagemaker.create_labeling_job.assert_called_with(**create_labeling_job(**args))

    # # check error path
    mock_generate_ui_template.return_value = None
    mock_get_groundtruth_lambda_arn.side_effect = [
        "arn:aws:lambda::012345678910:PRE-SemanticSegmentation",
        "arn:aws:lambda::012345678910:ACS-SemanticSegmentation",
    ]
    expected_response = generate_html_response(400, "Bad Request: Unable to create task template")
    assert lambda_handler(create_create_event(), mock_context) == expected_response


def create_create_event(task_type: str = "SemanticSegmentation", *args, **kwargs):
    return {
        "body": json.dumps(
            {
                "TaskType": task_type,
                "JobDefinition": create_labeling_job(*args, **kwargs),
                "FullInstruction": "",
                "ShortInstruction": "",
                "Labels": [],
            }
        ),
        "requestContext": {"authorizer": {"principalId": "auser"}},
        "headers": {"x-mlspace-project": "myproject"},
    }


def create_labeling_job(
    labeling_job_name: str = "myjob",
    label_attribute_name: str = "myjob-ref",
    ui_template_s3_uri: str = "",
    pre_human_task_lambda_arn: str = "",
    labeling_job_algorithms_config: bool = True,
    annotation_consolidation_lambda_arn: str = "",
    s3_output_path: str = "/path/to/output",
    labeling_job_algorithm_specification_arn: str = "",
    security_group_ids: str = "",
    subnets: [str] = [],
    tags: [dict] = [],
    label_category_config_s3_uri: str = "",
    role_arn: str = "",
):
    job_definition = {
        "LabelingJobName": labeling_job_name,
        "LabelAttributeName": label_attribute_name,
        "HumanTaskConfig": {
            "UiConfig": {"UiTemplateS3Uri": ui_template_s3_uri},
            "TaskDescription": "",
            "PreHumanTaskLambdaArn": pre_human_task_lambda_arn,
            "AnnotationConsolidationConfig": {"AnnotationConsolidationLambdaArn": annotation_consolidation_lambda_arn},
        },
        "OutputConfig": {"S3OutputPath": f"s3://mybucket{s3_output_path}"},
        "Tags": tags,
        "LabelCategoryConfigS3Uri": label_category_config_s3_uri,
        "RoleArn": role_arn,
    }

    if labeling_job_algorithms_config:
        job_definition["LabelingJobAlgorithmsConfig"] = {
            "LabelingJobAlgorithmSpecificationArn": labeling_job_algorithm_specification_arn,
            "LabelingJobResourceConfig": {"VpcConfig": {"SecurityGroupIds": security_group_ids, "Subnets": subnets}},
        }

    return job_definition
