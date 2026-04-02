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

import unittest
from unittest import mock

from ml_space_lambda.utils.groundtruth_utils import generate_custom_ui_template


class GenerateCustomUITemplateTest(unittest.TestCase):
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_with_asset_js_replacement(self, mock_s3, mock_boto3):
        """Test that {ASSET_JS} placeholder is replaced with correct assets domain URL"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = '<script src="{ASSET_JS}"></script>\n<div>Test</div>'

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="Full Instructions",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
        )

        # Verify S3 put_object was called
        mock_s3.put_object.assert_called_once()
        call_args = mock_s3.put_object.call_args

        # Check the uploaded content contains the replaced asset URL
        uploaded_content = call_args[1]["Body"]
        assert "https://assets.crowd.aws/crowd-html-elements.js" in uploaded_content
        assert "{ASSET_JS}" not in uploaded_content

        # Check return value
        assert result == "s3://test-bucket/output-dir/test-job/annotation-tool/template.liquid"

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_with_full_instructions_marker(self, mock_s3, mock_boto3):
        """Test that full instructions are added after the full-instructions start marker"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = """<div>
<!-- full-instructions start marker -->
<!-- full-instructions end marker -->
</div>"""

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="<p>These are the full instructions</p>",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
        )

        # Verify the full instructions were inserted
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        assert "<!-- full-instructions start marker -->" in uploaded_content
        assert "<p>These are the full instructions</p>" in uploaded_content
        # Verify the instruction appears after the marker
        marker_pos = uploaded_content.index("<!-- full-instructions start marker -->")
        instruction_pos = uploaded_content.index("<p>These are the full instructions</p>")
        assert instruction_pos > marker_pos

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_with_short_instructions_marker(self, mock_s3, mock_boto3):
        """Test that short instructions are added after the short-instructions start marker"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = """<div>
<!-- short-instructions start marker -->
<!-- short-instructions end marker -->
</div>"""

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="Full Instructions",
            short_instructions="<p>Brief instructions here</p>",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
        )

        # Verify the short instructions were inserted
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        assert "<!-- short-instructions start marker -->" in uploaded_content
        assert "<p>Brief instructions here</p>" in uploaded_content
        # Verify the instruction appears after the marker
        marker_pos = uploaded_content.index("<!-- short-instructions start marker -->")
        instruction_pos = uploaded_content.index("<p>Brief instructions here</p>")
        assert instruction_pos > marker_pos

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_with_description_stub(self, mock_s3, mock_boto3):
        """Test that DESCRIPTION_STUB is replaced with actual description"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = '<div header="DESCRIPTION_STUB">Content</div>'

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Custom Task Description",
            full_instructions="Full Instructions",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
        )

        # Verify the description was replaced
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        assert "Custom Task Description" in uploaded_content
        assert "DESCRIPTION_STUB" not in uploaded_content

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_with_label_attribute_name(self, mock_s3, mock_boto3):
        """Test that label-attribute-name-from-prior-job is replaced when label_attribute_name is provided"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = '<crowd-verification name="label-attribute-name-from-prior-job">Content</crowd-verification>'

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="Full Instructions",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
            label_attribute_name="my-label-attribute",
        )

        # Verify the label attribute name was replaced
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        assert "my-label-attribute" in uploaded_content
        assert "label-attribute-name-from-prior-job" not in uploaded_content

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_without_label_attribute_name(self, mock_s3, mock_boto3):
        """Test that label-attribute-name-from-prior-job is NOT replaced when label_attribute_name is None"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = '<crowd-verification name="label-attribute-name-from-prior-job">Content</crowd-verification>'

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="Full Instructions",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
            label_attribute_name=None,
        )

        # Verify the label attribute name was NOT replaced
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        assert "label-attribute-name-from-prior-job" in uploaded_content

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_with_all_replacements(self, mock_s3, mock_boto3):
        """Test complete template with all possible replacements"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = """<script src="{ASSET_JS}"></script>
<crowd-form>
    <crowd-verification
        name="label-attribute-name-from-prior-job"
        src="{{ task.input.taskObject | grant_read_access }}"
        header="DESCRIPTION_STUB"
    >
        <full-instructions header="Instructions">
        <!-- full-instructions start marker -->
        <!-- full-instructions end marker -->
        </full-instructions>

        <short-instructions>
        <!-- short-instructions start marker -->
        <!-- short-instructions end marker -->
        </short-instructions>
    </crowd-verification>
</crowd-form>"""

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="verification-job",
            description="Verify the bounding boxes",
            full_instructions="<p>Carefully review each bounding box</p>",
            short_instructions="<p>Click approve or reject</p>",
            data_bucket_name="my-bucket",
            output_dir_key="my-output",
            label_attribute_name="previous-job-label",
        )

        # Verify all replacements were made
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        # Check all replacements occurred
        assert "https://assets.crowd.aws/crowd-html-elements.js" in uploaded_content
        assert "previous-job-label" in uploaded_content
        assert "Verify the bounding boxes" in uploaded_content
        assert "<p>Carefully review each bounding box</p>" in uploaded_content
        assert "<p>Click approve or reject</p>" in uploaded_content

        # Check original placeholders are gone
        assert "{ASSET_JS}" not in uploaded_content
        assert "label-attribute-name-from-prior-job" not in uploaded_content
        assert "DESCRIPTION_STUB" not in uploaded_content

        # Check S3 key and return value
        assert call_args[1]["Key"] == "my-output/verification-job/annotation-tool/template.liquid"
        assert result == "s3://my-bucket/my-output/verification-job/annotation-tool/template.liquid"

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_iso_region(self, mock_s3, mock_boto3):
        """Test that ISO regions use correct assets domain"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-iso-east-1"

        custom_template_html = '<script src="{ASSET_JS}"></script>'

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="Full Instructions",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
        )

        # Verify ISO region assets domain is used
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        assert "crowd-html-elements-us-iso-east-1.s3.us-iso-east-1.c2s.ic.gov" in uploaded_content

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_with_trailing_slash(self, mock_s3, mock_boto3):
        """Test that output_dir_key with trailing slash is handled correctly"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = "<div>Test</div>"

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="Full Instructions",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir/",
        )

        # Verify S3 key is correct even with trailing slash
        call_args = mock_s3.put_object.call_args
        s3_key = call_args[1]["Key"]

        # Should still produce valid path
        assert s3_key == "output-dir/test-job/annotation-tool/template.liquid"

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_with_multiple_asset_js_references(self, mock_s3, mock_boto3):
        """Test that multiple {ASSET_JS} placeholders are all replaced"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = """<script src="{ASSET_JS}"></script>
<script src="{ASSET_JS}"></script>"""

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="Full Instructions",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
        )

        # Verify all instances were replaced
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        assert uploaded_content.count("https://assets.crowd.aws/crowd-html-elements.js") == 2
        assert "{ASSET_JS}" not in uploaded_content

    @mock.patch("ml_space_lambda.utils.groundtruth_utils.boto3")
    @mock.patch("ml_space_lambda.utils.groundtruth_utils.s3")
    def test_generate_custom_ui_template_preserves_unmatched_lines(self, mock_s3, mock_boto3):
        """Test that lines without placeholders are preserved as-is"""
        mock_session = mock_boto3.session.Session()
        mock_session.region_name = "us-east-1"

        custom_template_html = """<div>Regular content</div>
<p>Another line without placeholders</p>
<span>{{ task.input.data }}</span>"""

        result = generate_custom_ui_template(
            custom_template_html=custom_template_html,
            job_name="test-job",
            description="Test Description",
            full_instructions="Full Instructions",
            short_instructions="Short Instructions",
            data_bucket_name="test-bucket",
            output_dir_key="output-dir",
        )

        # Verify original content is preserved
        call_args = mock_s3.put_object.call_args
        uploaded_content = call_args[1]["Body"]

        assert "<div>Regular content</div>" in uploaded_content
        assert "<p>Another line without placeholders</p>" in uploaded_content
        assert "<span>{{ task.input.data }}</span>" in uploaded_content
