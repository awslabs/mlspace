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

from ml_space_lambda.data_access_objects.resource_metadata import PagedMetadataResults, ResourceMetadataModel
from ml_space_lambda.enums import ResourceType

TEST_ENV_CONFIG = {"AWS_DEFAULT_REGION": "us-east-1"}
TEST_ID = "test-id"

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    from ml_space_lambda.utils.resource_utils import (
        delete_emr_cluster,
        stop_batch_translate_job,
        stop_labeling_job,
        suspend_all_of_type,
    )


@mock.patch("ml_space_lambda.utils.resource_utils.translate")
def test_stop_batch_translate_job(mock_translate):
    stop_batch_translate_job(TEST_ID)
    mock_translate.stop_text_translation_job.assert_called_with(JobId=TEST_ID)


@mock.patch("ml_space_lambda.utils.resource_utils.sagemaker")
def test_stop_labeling_job(mock_sagemaker):
    stop_labeling_job(TEST_ID)
    mock_sagemaker.stop_labeling_job.assert_called_with(LabelingJobName=TEST_ID)


@mock.patch("ml_space_lambda.utils.resource_utils.emr")
def test_delete_emr_cluster(mock_emr):
    delete_emr_cluster(TEST_ID)
    mock_emr.set_termination_protection.assert_called_with(JobFlowIds=[TEST_ID], TerminationProtected=False)
    mock_emr.terminate_job_flows.assert_called_with(JobFlowIds=[TEST_ID])


@mock.patch("ml_space_lambda.utils.resource_utils.resource_metadata_dao")
@mock.patch("ml_space_lambda.utils.resource_utils.translate")
def test_suspend_all_of_type_success(mock_translate, mock_resource_md_dao):
    records = [ResourceMetadataModel(TEST_ID, ResourceType.BATCH_TRANSLATE_JOB, "bob", "tempProject", {})]

    mock_resource_md_dao.get_all_of_type_with_filters.return_value = PagedMetadataResults(records)
    suspend_all_of_type(ResourceType.BATCH_TRANSLATE_JOB)
    mock_translate.stop_text_translation_job.assert_called_with(JobId=TEST_ID)


@mock.patch("ml_space_lambda.utils.resource_utils.resource_metadata_dao")
@mock.patch("ml_space_lambda.utils.resource_utils.translate")
def test_suspend_all_of_type_success2(mock_translate, mock_resource_md_dao):
    records = [ResourceMetadataModel(TEST_ID, ResourceType.BATCH_TRANSLATE_JOB, "bob", "tempProject", {})]

    mock_resource_md_dao.get_all_of_type_with_filters.return_value = PagedMetadataResults(records)
    suspend_all_of_type(ResourceType.BATCH_TRANSLATE_JOB, "bob")
    mock_translate.stop_text_translation_job.assert_called_with(JobId=TEST_ID)


@mock.patch("ml_space_lambda.utils.resource_utils.resource_metadata_dao")
@mock.patch("ml_space_lambda.utils.resource_utils.log")
def test_suspend_all_of_type_empty(mock_log, mock_resource_md_dao):
    mock_resource_md_dao.get_all_of_type_with_filters.return_value = PagedMetadataResults([])
    suspend_all_of_type(ResourceType.BATCH_TRANSLATE_JOB)
    mock_log.info.assert_called_with(f"No matching records for {ResourceType.BATCH_TRANSLATE_JOB} were found")


@mock.patch("ml_space_lambda.utils.resource_utils.resource_metadata_dao")
@mock.patch("ml_space_lambda.utils.resource_utils.log")
def test_suspend_all_of_type_invalid_type(mock_log, mock_resource_md_dao):
    invalid_resource_type = "not-a-resource-type"
    mock_resource_md_dao.get_all_of_type_with_filters.return_value = PagedMetadataResults([])
    suspend_all_of_type(invalid_resource_type)
    mock_log.warning.assert_called_with(
        f"Attempted to suspend resources for a service without handling: {invalid_resource_type}"
    )
