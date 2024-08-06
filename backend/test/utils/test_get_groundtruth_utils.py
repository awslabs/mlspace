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
import unittest
from unittest import mock

from ml_space_lambda.utils.groundtruth_utils import (
    LambdaTypes,
    TaskTypes,
    _assets_domain_map,
    _auto_labeling_task_arn_map,
    generate_labels_configuration_file,
    generate_ui_template,
    get_auto_labeling_arn,
    get_groundtruth_assets_domain,
    get_groundtruth_lambda_arn,
)


class GroundTruthUtilsTest(unittest.TestCase):
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    def test_get_groundtruth_lambda_arn(self, mock_boto3):
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"
        assert mock_session.region_name == "us-east-1"
        mock_session.get_partition_for_region.return_value = "aws"

        for lambda_type in LambdaTypes:
            for task_type in TaskTypes:
                assert (
                    get_groundtruth_lambda_arn(lambda_type, task_type)
                    == f"arn:aws:lambda:us-east-1:432418664414:function:{lambda_type.name}-{task_type.name}"
                )

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    def test_get_auto_labeling_arn(self, mock_boto3):
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"
        assert mock_session.region_name == "us-east-1"
        mock_session.get_partition_for_region.return_value = "aws"

        for task_type in TaskTypes:
            assert (
                get_auto_labeling_arn(task_type)
                == f"arn:aws:sagemaker:us-east-1:432418664414:labeling-job-algorithm-specification/{_auto_labeling_task_arn_map[task_type]}"
            )

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_labels_configuration_file(self, mock_s3):
        bucket_name = "bucketName"
        job_name = "JobName"
        output_dir = "outputDir"
        s3_key = f"{output_dir}/{job_name}/annotation-tool/data.json"
        labels = [{"Key": "Value"}]
        assert generate_labels_configuration_file(labels, job_name, bucket_name, "outputDir") == f"s3://{bucket_name}/{s3_key}"
        mock_s3.put_object.assert_called_with(
            Bucket=bucket_name,
            Key=s3_key,
            Body=json.dumps({"document-version": "2018-11-28", "labels": labels}),
        )

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_labels_configuration_file_with_trialing_slash(self, mock_s3):
        bucket_name = "bucketName"
        job_name = "JobName"
        output_dir = "outputDir"
        s3_key = f"{output_dir}/{job_name}/annotation-tool/data.json"
        labels = [{"Key": "Value"}]
        assert (
            generate_labels_configuration_file(labels, job_name, bucket_name, "outputDir/") == f"s3://{bucket_name}/{s3_key}"
        )
        mock_s3.put_object.assert_called_with(
            Bucket=bucket_name,
            Key=s3_key,
            Body=json.dumps({"document-version": "2018-11-28", "labels": labels}),
        )

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    def test_get_groundtruth_assets_domain(self, mock_boto3):
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"
        get_groundtruth_assets_domain() == "assets.crowd.aws"

        for key in _assets_domain_map:
            mock_session.region_name = key
            get_groundtruth_assets_domain() == _assets_domain_map[key]

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.os.path.isfile")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.os.path.abspath")
    def test_generate_ui_template(self, mock_abspath, mock_isfile, mock_s3, mock_boto3):
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"
        mock_abspath.return_value = "."
        mock_isfile.return_value = True

        file_text = """
        <script src="{ASSET_JS}"></script>
        <crowd-form>
        <crowd-bounding-box
            name="boundingBox"
            src="{{ task.input.taskObject | grant_read_access }}"
            header="DESCRIPTION_STUB"
            labels="{{ task.input.labels | to_json | escape }}"
        >
            <full-instructions header="Bounding box instructions">
            <!-- full-instructions start marker -->
            <!-- full-instructions end marker -->
            </full-instructions>

            <short-instructions>
            <!-- short-instructions start marker -->
            <!-- short-instructions end marker -->
            </short-instructions>
        </crowd-bounding-box>
        </crowd-form>
        """

        with mock.patch("builtins.open", mock.mock_open(read_data=file_text)):
            kwargs = {
                "job_name": "job_name",
                "task_type": TaskTypes.BoundingBox,
                "description": "description",
                "full_instructions": "full_instructions",
                "short_instructions": "short_instructions",
                "data_bucket_name": "data_bucket_name",
                "output_dir_key": "output_dir_key",
            }
            generate_ui_template(**kwargs)
            mock_s3.put_object.asset_called()

            mock_isfile.return_value = False
            self.assertRaises(Exception, generate_ui_template, **kwargs)
