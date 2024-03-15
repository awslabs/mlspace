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

import copy
from unittest import mock

import pytest
from botocore.exceptions import ClientError

from ml_space_lambda.data_access_objects.project import ProjectModel
from ml_space_lambda.enums import ResourceType

TEST_ENV_CONFIG = {
    "AWS_DEFAULT_REGION": "us-east-1",
}

with mock.patch.dict("os.environ", TEST_ENV_CONFIG, clear=True):
    import ml_space_lambda.resource_metadata.lambda_functions as resource_metadata_lambda
    from ml_space_lambda.resource_metadata.lambda_functions import process_event


MOCK_PROJECT_NAME = "UnitTestProject"
MOCK_USERNAME = "jdoe@amazon.com"

# Notebook Test data
MOCK_NOTEBOOK_NAME = "Unit-Test-Notebook"
mock_notebook_event = {
    "version": "0",
    "id": "0bd8a0dc-eb4f-78e6-8d3c-23b73c95428f",
    "detail-type": "SageMaker Notebook Instance State Change",
    "source": "aws.sagemaker",
    "account": "123456789000",
    "time": "2023-09-28T14:49:12Z",
    "region": "us-east-1",
    "resources": [f"arn:aws:sagemaker:us-east-1:123456789000:notebook-instance/{MOCK_NOTEBOOK_NAME}"],
    "detail": {
        "NotebookInstanceArn": f"arn:aws:sagemaker:us-east-1:123456789000:notebook-instance/{MOCK_NOTEBOOK_NAME}",
        "NotebookInstanceName": MOCK_NOTEBOOK_NAME,
        "NotebookInstanceStatus": "InService",
        "FailureReason": "Fake failure reason",
        "InstanceType": "ml.t2.medium",
        "LastModifiedTime": 1695912523501,
        "CreationTime": 1691593432277,
        "NotebookInstanceLifecycleConfigName": "mlspace-notebook-lifecycle-config",
        "Tags": {"project": MOCK_PROJECT_NAME, "user": MOCK_USERNAME, "system": "MLSpace"},
    },
}
expected_notebook_metadata = {
    "NotebookInstanceArn": mock_notebook_event["detail"]["NotebookInstanceArn"],
    "CreationTime": "2023-08-09 15:03:52.277000+00:00",
    "LastModifiedTime": "2023-09-28 14:48:43.501000+00:00",
    "FailureReason": mock_notebook_event["detail"]["FailureReason"],
    "InstanceType": mock_notebook_event["detail"]["InstanceType"],
    "NotebookInstanceLifecycleConfigName": mock_notebook_event["detail"]["NotebookInstanceLifecycleConfigName"],
    "NotebookInstanceStatus": mock_notebook_event["detail"]["NotebookInstanceStatus"],
}

# Endpoint test data
MOCK_ENDPOINT_NAME = "UnitTestEndpoint"
mock_endpoint_event = {
    "version": "0",
    "id": "1bab497e-fb1d-85a7-0285-460244b11a57",
    "detail-type": "SageMaker Endpoint State Change",
    "source": "aws.sagemaker",
    "account": "123456789000",
    "time": "2023-10-04T14:06:37Z",
    "region": "us-east-1",
    "resources": [f"arn:aws:sagemaker:us-east-1:123456789000:endpoint/{MOCK_ENDPOINT_NAME}"],
    "detail": {
        "EndpointName": MOCK_ENDPOINT_NAME,
        "EndpointArn": f"arn:aws:sagemaker:us-east-1:123456789000:endpoint/{MOCK_ENDPOINT_NAME}",
        "EndpointStatus": "IN_SERVICE",
        "FailureReason": None,
        "CreationTime": 1696427470120,
        "Tags": {
            "project": MOCK_PROJECT_NAME,
            "system": "MLSpace",
            "user": MOCK_USERNAME,
        },
    },
}
expected_endpoint_metadata = {
    "CreationTime": "2023-10-04 13:51:10.120000+00:00",
    "EndpointArn": mock_endpoint_event["detail"]["EndpointArn"],
    "EndpointStatus": mock_endpoint_event["detail"]["EndpointStatus"],
    "FailureReason": mock_endpoint_event["detail"]["FailureReason"],
    "LastModifiedTime": None,
}

# Model test data
MOCK_MODEL_NAME = "UnitTestModel"
mock_model_event = {
    "version": "0",
    "id": "2aaa16e9-90e8-2a4e-0754-f7d77fe36a4f",
    "detail-type": "SageMaker Model State Change",
    "source": "aws.sagemaker",
    "account": "123456789000",
    "time": "2023-09-27T01:26:27Z",
    "region": "us-east-1",
    "resources": [f"arn:aws:sagemaker:us-east-1:123456789000:model/{MOCK_ENDPOINT_NAME}"],
    "detail": {
        "ModelName": MOCK_MODEL_NAME,
        "PrimaryContainer": {
            "ContainerHostname": None,
            "Image": "382416733822.dkr.ecr.us-east-1.amazonaws.com/kmeans:1",
        },
        "Containers": None,
        "ExecutionRoleArn": "arn:aws:iam::123456789000:role/MLSpace-Demo",
        "CreationTime": 1696427470120,
        "ModelArn": f"arn:aws:sagemaker:us-east-1:123456789000:model/{MOCK_ENDPOINT_NAME}",
        "Tags": {
            "project": MOCK_PROJECT_NAME,
            "system": "MLSpace",
            "user": MOCK_USERNAME,
        },
    },
}

expected_model_metadata = {
    "CreationTime": "2023-10-04 13:51:10.120000+00:00",
    "ModelArn": mock_model_event["detail"]["ModelArn"],
}

# Training Job test Data
MOCK_TRAINING_JOB_NAME = "UnitTestTrainingJob"
mock_training_job_event = {
    "version": "0",
    "id": "29f939a9-3cce-a8e1-24c7-3d8db2861245",
    "detail-type": "SageMaker Training Job State Change",
    "source": "aws.sagemaker",
    "account": "123456789000",
    "time": "2023-10-04T13:46:47Z",
    "region": "us-east-1",
    "resources": [f"arn:aws:sagemaker:us-east-1:123456789000:training-job/{MOCK_TRAINING_JOB_NAME}"],
    "detail": {
        "TrainingJobName": MOCK_TRAINING_JOB_NAME,
        "TrainingJobArn": f"arn:aws:sagemaker:us-east-1:123456789000:training-job/{MOCK_TRAINING_JOB_NAME}",
        "TuningJobArn": "arn:aws:sagemaker:us-east-1:123456789000:hyper-parameter-tuning-job/LatestFun-hpoxgb-20231004",
        "TrainingJobStatus": "InProgress",
        "FailureReason": None,
        "CreationTime": 1696427182554,
        "TrainingStartTime": 1696427186229,
        "TrainingEndTime": None,
        "LastModifiedTime": 1696427207435,
        "Tags": {
            "project": MOCK_PROJECT_NAME,
            "system": "MLSpace",
            "user": MOCK_USERNAME,
        },
    },
}

expected_training_job_metadata = {
    "CreationTime": "2023-10-04 13:46:22.554000+00:00",
    "TrainingJobArn": mock_training_job_event["detail"]["TrainingJobArn"],
    "TrainingJobStatus": mock_training_job_event["detail"]["TrainingJobStatus"],
    "FailureReason": None,
    "LastModifiedTime": "2023-10-04 13:46:47.435000+00:00",
    "TrainingStartTime": "2023-10-04 13:46:26.229000+00:00",
    "TrainingEndTime": None,
}

# Transform Job test Data
MOCK_TRANSFORM_JOB_NAME = "UnitTestTransformJob"
mock_transform_job_event = {
    "version": "0",
    "id": "29f939a9-3cce-a8e1-24c7-3d8db2861245",
    "detail-type": "SageMaker Transform Job State Change",
    "source": "aws.sagemaker",
    "account": "123456789000",
    "time": "2023-10-04T13:46:47Z",
    "region": "us-east-1",
    "resources": [f"arn:aws:sagemaker:us-east-1:123456789000:transform-job/{MOCK_TRANSFORM_JOB_NAME}"],
    "detail": {
        "TransformJobName": MOCK_TRANSFORM_JOB_NAME,
        "TransformJobArn": f"arn:aws:sagemaker:us-east-1:123456789000:transform-job/{MOCK_TRANSFORM_JOB_NAME}",
        "TransformJobStatus": "InProgress",
        "FailureReason": None,
        "CreationTime": 1696427182554,
        "TransformStartTime": 1696427186229,
        "TransformEndTime": None,
        "Tags": {
            "project": MOCK_PROJECT_NAME,
            "system": "MLSpace",
            "user": MOCK_USERNAME,
        },
    },
}

expected_transform_job_metadata = {
    "CreationTime": "2023-10-04 13:46:22.554000+00:00",
    "TransformJobArn": mock_transform_job_event["detail"]["TransformJobArn"],
    "TransformJobStatus": mock_transform_job_event["detail"]["TransformJobStatus"],
    "FailureReason": None,
    "TransformStartTime": "2023-10-04 13:46:26.229000+00:00",
    "TransformEndTime": None,
}

# Endpoint config test data
MOCK_CONFIG_NAME = "UnitTestEndpointConfig"
mock_config_event = {
    "version": "0",
    "id": "4ab9b98b-d479-9e49-dc27-97b3d3402169",
    "detail-type": "SageMaker Endpoint Config State Change",
    "source": "aws.sagemaker",
    "account": "123456789000",
    "time": "2023-10-17T18:05:53Z",
    "region": "us-east-1",
    "resources": [f"arn:aws:sagemaker:us-east-1:123456789000:endpoint-config/{MOCK_CONFIG_NAME}"],
    "detail": {
        "EndpointConfigName": MOCK_CONFIG_NAME,
        "EndpointConfigArn": f"arn:aws:sagemaker:us-east-1:123456789000:endpoint-config/{MOCK_CONFIG_NAME}",
        "ProductionVariants": [
            {
                "VariantName": "variant-name-1",
                "ModelName": MOCK_MODEL_NAME,
                "InitialInstanceCount": 1,
                "InstanceType": "ml.m4.xlarge",
                "InitialVariantWeight": 1,
                "AcceleratorType": None,
                "CoreDumpConfig": None,
                "ServerlessConfig": None,
                "VolumeSizeInGB": None,
                "ModelDataDownloadTimeoutInSeconds": None,
                "ContainerStartupHealthCheckTimeoutInSeconds": None,
                "EnableSSMAccess": None,
            }
        ],
        "DataCaptureConfig": None,
        "KmsKeyId": None,
        "CreationTime": 1697562590816,
        "AsyncInferenceConfig": None,
        "ExplainerConfig": None,
        "ShadowProductionVariants": None,
        "Tags": {
            "project": MOCK_PROJECT_NAME,
            "system": "MLSpace",
            "user": MOCK_USERNAME,
        },
    },
}

"2023-10-17T17:09:50.816Z"
expected_config_metadata = {
    "CreationTime": "2023-10-17 17:09:50.816000+00:00",
    "EndpointConfigArn": mock_config_event["detail"]["EndpointConfigArn"],
}

# HPO test data
MOCK_HPO_JOB_NAME = "UnitTestHPO"
mock_hpo_event = {
    "version": "0",
    "id": "fe4d5d99-24ab-b3bc-ca34-493e23b1b1bc",
    "detail-type": "SageMaker HyperParameter Tuning Job State Change",
    "source": "aws.sagemaker",
    "account": "123456789000",
    "time": "2023-10-04T13:46:49Z",
    "region": "us-east-1",
    "resources": [f"arn:aws:sagemaker:us-east-1:123456789000:hyper-parameter-tuning-job/{MOCK_HPO_JOB_NAME}"],
    "detail": {
        "HyperParameterTuningJobName": MOCK_HPO_JOB_NAME,
        "HyperParameterTuningJobArn": f"arn:aws:sagemaker:us-east-1:123456789000:hyper-parameter-tuning-job/{MOCK_HPO_JOB_NAME}",
        "HyperParameterTuningJobConfig": {"Strategy": "Bayesian"},
        "TrainingJobDefinition": {},
        "TrainingJobDefinitions": None,
        "HyperParameterTuningJobStatus": "Running",
        "CreationTime": 1696426861998,
        "HyperParameterTuningEndTime": None,
        "LastModifiedTime": 1696427209672,
        "TrainingJobStatusCounters": None,
        "ObjectiveStatusCounters": None,
        "FailureReason": None,
        "BestTrainingJob": {},
        "TuningJobCompletionReason": None,
        "TuningJobCompletionDetails": None,
        "Tags": {
            "project": MOCK_PROJECT_NAME,
            "system": "MLSpace",
            "user": MOCK_USERNAME,
        },
    },
}
mock_hpo_describe = {
    "HyperParameterTuningJobName": MOCK_HPO_JOB_NAME,
    "HyperParameterTuningJobArn": f"arn:aws:sagemaker:us-east-1:123456789000:hyper-parameter-tuning-job/{MOCK_HPO_JOB_NAME}",
    "HyperParameterTuningJobConfig": {"Strategy": "Bayesian"},
    "TrainingJobDefinition": {},
    "TrainingJobDefinitions": None,
    "HyperParameterTuningJobStatus": "Running",
    "CreationTime": "2023-10-04 13:41:01.998000+00:00",
    "FailureReason": None,
    "HyperParameterTuningEndTime": None,
    "LastModifiedTime": "2023-10-04 13:46:49.672000+00:00",
    "TrainingJobStatusCounters": {
        "Completed": 2,
        "InProgress": 3,
        "RetryableError": 0,
        "NonRetryableError": 0,
        "Stopped": 1,
    },
}
expected_hpo_metadata = {
    "CreationTime": "2023-10-04 13:41:01.998000+00:00",
    "FailureReason": None,
    "HyperParameterTuningJobArn": f"arn:aws:sagemaker:us-east-1:123456789000:hyper-parameter-tuning-job/{MOCK_HPO_JOB_NAME}",
    "HyperParameterTuningJobStatus": "Running",
    "LastModifiedTime": "2023-10-04 13:46:49.672000+00:00",
    "TrainingJobStatusCounters": {
        "Completed": 2,
        "InProgress": 3,
        "RetryableError": 0,
        "NonRetryableError": 0,
        "Stopped": 1,
    },
    "HyperParameterTuningEndTime": None,
    "Strategy": "Bayesian",
}

# Translate test data
MOCK_TRANSLATE_JOB_ID = "c74fd5ed513fe2e02d2170c1a00452d8"
MOCK_NOTEBOOK_ROLE_NAME = "MLSpace-UnitTest-33d0912c6bf5578c532f5aad5bf92fb9fd7bd1f6c8c26"
mock_translate_terminal_event = {
    "version": "0",
    "id": "c5bd2302-491c-1fc7-b397-1c342ea4da61",
    "detail-type": "Translate TextTranslationJob State Change",
    "source": "aws.translate",
    "account": "123456789000",
    "time": "2023-10-18T14:42:29Z",
    "region": "us-east-1",
    "resources": [],
    "detail": {"jobId": MOCK_TRANSLATE_JOB_ID, "jobStatus": "COMPLETED"},
}

# Labeling job test data
MOCK_LABELING_JOB_NAME = "UnitTestLabeling"
mock_labeling_terminal_event = {
    "version": "0",
    "id": "7377f6d4-e894-4847-66e0-0b856c001e9a",
    "detail-type": "SageMaker Ground Truth Labeling Job State Change",
    "source": "aws.sagemaker",
    "account": "123456789000",
    "time": "2023-11-15T21:53:43Z",
    "region": "us-east-1",
    "resources": [f"arn:aws:sagemaker:us-east-1:123456789000:labeling-job/{MOCK_LABELING_JOB_NAME}"],
    "detail": {"LabelingJobStatus": "Completed"},
}

mock_labeling_create_event = {
    "version": "0",
    "id": "d5db4f84-8aa3-cc8b-8193-9e709209f711",
    "detail-type": "AWS API Call via CloudTrail",
    "source": "aws.sagemaker",
    "account": "679683741526",
    "time": "2023-11-15T22:27:40Z",
    "region": "us-east-1",
    "resources": [],
    "detail": {
        "eventTime": "2023-11-15T22:27:40Z",
        "eventSource": "sagemaker.amazonaws.com",
        "eventName": "CreateLabelingJob",
        "awsRegion": "us-east-1",
        "requestParameters": {
            "labelingJobName": MOCK_LABELING_JOB_NAME,
            "labelAttributeName": "label",
        },
        "responseElements": {
            "labelingJobArn": f"arn:aws:sagemaker:us-east-1:123456789000:labeling-job/{MOCK_LABELING_JOB_NAME}"
        },
        "eventType": "AwsApiCall",
    },
}

mock_labeling_describe = {
    "LabelingJobArn": f"arn:aws:sagemaker:us-east-1:123456789000:labeling-job/{MOCK_LABELING_JOB_NAME}",
    "LabelingJobName": MOCK_LABELING_JOB_NAME,
    "LabelingJobStatus": "InProgress",
    "CreationTime": "2023-10-04 13:41:01.998000+00:00",
    "LastModifiedTime": "2023-10-04 13:46:49.672000+00:00",
    "LabelCounters": {
        "TotalLabeled": 123,
        "HumanLabeled": 123,
        "MachineLabeled": 123,
        "FailedNonRetryableError": 123,
        "Unlabeled": 123,
    },
    "FailureReason": None,
    "Tags": [
        {"Key": "system", "Value": "MLSpace"},
        {"Key": "user", "Value": MOCK_USERNAME},
        {"Key": "project", "Value": MOCK_PROJECT_NAME},
    ],
    "HumanTaskConfig": {
        "WorkteamArn": "arn:aws:sagemaker:us-east-1:123456789000:workteam/private-crowd/unit-test-team",
        "UiConfig": {
            "UiTemplateS3Uri": f"s3://mlspace-data-123456789000/private/{MOCK_USERNAME}/datasets/unit-test/task_template.html"
        },
        "PreHumanTaskLambdaArn": "arn:aws:lambda:us-east-1:432418664414:function:PRE-ImageMultiClass",
        "TaskTitle": "MLSpace Demo Labeling Job",
        "TaskDescription": "Example demo for labeling hand-written digits",
        "NumberOfHumanWorkersPerDataObject": 1,
        "TaskTimeLimitInSeconds": 3600,
        "AnnotationConsolidationConfig": {
            "AnnotationConsolidationLambdaArn": "arn:aws:lambda:us-east-1:432418664414:function:ACS-ImageMultiClass"
        },
    },
}

expected_labeling_metadata = {
    "LabelingJobArn": f"arn:aws:sagemaker:us-east-1:123456789000:labeling-job/{MOCK_LABELING_JOB_NAME}",
    "LabelingJobStatus": "InProgress",
    "CreationTime": "2023-10-04 13:41:01.998000+00:00",
    "LastModifiedTime": "2023-10-04 13:46:49.672000+00:00",
    "LabelCounters": {
        "TotalLabeled": 123,
        "HumanLabeled": 123,
        "MachineLabeled": 123,
        "FailedNonRetryableError": 123,
        "Unlabeled": 123,
    },
    "FailureReason": None,
    "TaskType": "Image classification",
}

# Project test data
mock_project_metadata_with_termination_configs = {
    "terminationConfiguration": {
        "defaultEndpointTTL": 168,
        "defaultEMRClusterTTL": 168,
        "defaultNotebookStopTime": "17:00",
    },
}
mock_project_with_termination_configs = ProjectModel(
    "termination-configuration-project",
    "Project for testing termination configurations",
    False,
    "testUserTerminationConfigurations@amazon.com",
    metadata=mock_project_metadata_with_termination_configs,
)
mock_project_without_metadata = ProjectModel(
    "no-metadata-project",
    "Project for testing lack of metadata",
    False,
    "testUserNoMetadata@amazon.com",
)


def _mock_translate_cloudtrail_event(notebook_event=False, is_create=True):
    create_params = {
        "jobName": "TranslateUnitTestJob",
        "inputDataConfig": {
            "s3Uri": "s3://mlspace-data/private/jdoe/datasets/TranslateInput/",
            "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        "outputDataConfig": {
            "s3Uri": "s3://mlspace-data/private/jdoe/datasets/TranslateOutput/",
            "encryptionKey": {
                "type": "KMS",
                "id": "arn:aws:kms:us-east-1:123456789000:key/49898ae1-bb88-4f77-b621-909ee5ebec1a",
            },
        },
        "dataAccessRoleArn": f"arn:aws:iam::123456789000:role/{MOCK_NOTEBOOK_ROLE_NAME}",
        "sourceLanguageCode": "en",
        "targetLanguageCodes": ["fr"],
        "clientToken": "6a72c4fb-113e-46b4-8f83-e89868975c1e",
        "settings": {},
    }
    stop_params = {"jobId": MOCK_TRANSLATE_JOB_ID}
    return {
        "version": "0",
        "id": "e2cc44c1-4f9d-40cd-c9db-dd17f7d0b9c9",
        "detail-type": "AWS API Call via CloudTrail",
        "source": "aws.translate",
        "account": "123456789000",
        "time": "2023-10-18T17:02:47Z",
        "region": "us-east-1",
        "resources": [],
        "detail": {
            "eventVersion": "1.08",
            "userIdentity": {
                "type": "AssumedRole",
                "principalId": f"AAAAA1AAA11AAA1AAAAAA:{'SageMaker' if notebook_event else 'mls-lambda-batch_translate-create'}",
                "arn": f"arn:aws:sts::123456789000:assumed-role/{(MOCK_NOTEBOOK_ROLE_NAME + '/SageMaker') if notebook_event else 'mlspace-app-role/mls-lambda-batch_translate-create'}",
                "accountId": "123456789000",
                "accessKeyId": "AAAAA1AA111AAAAAAAAA",
                "sessionContext": {
                    "sessionIssuer": {
                        "type": "Role",
                        "principalId": "AAAAA1AAA11AAA1AAAAAA",
                        "arn": f"arn:aws:iam::123456789000:role/{MOCK_NOTEBOOK_ROLE_NAME if notebook_event else 'mlspace-app-role'}",
                        "accountId": "123456789000",
                        "userName": MOCK_NOTEBOOK_ROLE_NAME if notebook_event else "mlspace-app-role",
                    },
                },
            },
            "eventTime": "2023-10-18T17:02:47Z",
            "eventSource": "translate.amazonaws.com",
            "eventName": "StartTextTranslationJob" if is_create else "StopTextTranslationJob",
            "awsRegion": "us-east-1",
            "requestParameters": create_params if is_create else stop_params,
            "responseElements": {
                "jobId": MOCK_TRANSLATE_JOB_ID,
                "jobStatus": "SUBMITTED" if is_create else "STOP_REQUESTED",
            },
        },
    }


def _mock_translate_job_describe(job_status="COMPLETED"):
    return {
        "TextTranslationJobProperties": {
            "JobName": "TranslateUnitTestJob",
            "JobStatus": job_status,
            "SubmittedTime": "2023-10-17 17:09:50.816000+00:00",
            "SourceLanguageCode": "en",
            "TargetLanguageCodes": ["fr"],
            "EndTime": "2023-10-17 17:16:13.195000+00:00",
            "InputDataConfig": {
                "s3Uri": "s3://mlspace-data/private/jdoe/datasets/TranslateInput/",
                "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
            "OutputDataConfig": {
                "s3Uri": "s3://mlspace-data/private/jdoe/datasets/TranslateOutput/",
                "encryptionKey": {
                    "type": "KMS",
                    "id": "arn:aws:kms:us-east-1:123456789000:key/49898ae1-bb88-4f77-b621-909ee5ebec1a",
                },
            },
            "DataAccessRoleArn": f"arn:aws:iam::123456789000:role/{MOCK_NOTEBOOK_ROLE_NAME}",
        }
    }


def _mock_translate_expected_metadata(job_status="COMPLETED"):
    return {
        "JobName": "TranslateUnitTestJob",
        "JobStatus": job_status,
        "SubmittedTime": "2023-10-17 17:09:50.816000+00:00",
        "SourceLanguageCode": "en",
        "TargetLanguageCodes": ["fr"],
    }


mock_context = mock.Mock()


def _mock_sm_describe_error(resoucrce_type: ResourceType):
    resource_name = ""
    resource_label = ""
    api = ""

    if resoucrce_type == ResourceType.MODEL:
        resource_label = "model"
        api = "DescribeModel"
        resource_name = MOCK_MODEL_NAME
        return ClientError(
            {
                "Error": {
                    "Code": "AccessDeniedException",
                    "Message": f"An error occurred (AccessDeniedException) when calling the {api} operation: User: arn:aws:sts::111111111111:assumed-role/mlspace-app-role/mls-lambda-resource-metadata is not authorized to perform: sagemaker:{api} on resource: arn:aws:sagemaker:us-east-1:111111111111:model/{resource_name} because no identity-based policy allows the sagemaker:{api} action.",
                },
                "ResponseMetadata": {"HTTPStatusCode": 400},
            },
            api,
        )
    elif resoucrce_type == ResourceType.ENDPOINT_CONFIG:
        resource_label = "endpoint configuration"
        api = "DescribeEndpointConfig"
        resource_name = MOCK_CONFIG_NAME

    return ClientError(
        {
            "Error": {
                "Code": "ValidationException",
                "Message": f'An error occurred (ValidationException) when calling the {api} operation: Could not find {resource_label} "{resource_name}".',
            },
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        api,
    )


# This test isn't very realistic because our IAM policy wouldn't really allow this to happen
# but we still want to ensure we have the user/project data and it's possible someone could manually
# create and tag a resource with the MLSpace system manually
@pytest.mark.parametrize(
    "mock_eventbridge_event",
    [
        (mock_notebook_event),
        (mock_endpoint_event),
        (mock_model_event),
        (mock_training_job_event),
        (mock_transform_job_event),
        (mock_config_event),
        (mock_hpo_event),
    ],
    ids=[
        "notebook_event",
        "endpoint_event",
        "model_event",
        "training_job_event",
        "transform_job_event",
        "endpoint_config_event",
        "hpo_event",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
def test_process_event_create_missing_user_and_project(mock_resource_metadata_dao, mock_eventbridge_event):
    missing_tags_event = copy.deepcopy(mock_eventbridge_event)
    missing_tags_event["detail"]["Tags"] = {"system": "MLSpace"}

    with pytest.raises(ValueError):
        process_event(missing_tags_event, mock_context)

    mock_resource_metadata_dao.update.assert_not_called()
    mock_resource_metadata_dao.create.assert_not_called()


@pytest.mark.parametrize(
    "mock_eventbridge_event,mock_system",
    [
        (mock_labeling_terminal_event, "MLSpace"),
        (mock_labeling_create_event, "MLSpace"),
        (mock_labeling_terminal_event, "FakeSystem"),
        (mock_labeling_create_event, "FakeSystem"),
    ],
    ids=[
        "labeling_terminal_missing_user_and_project",
        "labeling_create_missing_user_and_project",
        "labeling_terminal_non_mls",
        "labeling_create_non_mls",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.sagemaker")
def test_process_event_create_missing_tags_labeling_jobs(
    mock_sagemaker, mock_resource_metadata_dao, mock_eventbridge_event, mock_system
):
    describe_result = copy.deepcopy(mock_labeling_describe)
    describe_result["Tags"] = [{"Key": "system", "Value": mock_system}]
    mock_sagemaker.describe_labeling_job.return_value = describe_result

    if mock_system == "MLSpace":
        with pytest.raises(ValueError):
            process_event(mock_eventbridge_event, mock_context)
    else:
        process_event(mock_eventbridge_event, mock_context)

    mock_resource_metadata_dao.update.assert_not_called()
    mock_resource_metadata_dao.create.assert_not_called()
    mock_sagemaker.describe_labeling_job.assert_called_with(LabelingJobName=MOCK_LABELING_JOB_NAME)


@pytest.mark.parametrize(
    "resource_id,resource_type,mock_eventbridge_event,expected_metadata",
    [
        (
            MOCK_NOTEBOOK_NAME,
            ResourceType.NOTEBOOK,
            mock_notebook_event,
            expected_notebook_metadata,
        ),
        (
            MOCK_ENDPOINT_NAME,
            ResourceType.ENDPOINT,
            mock_endpoint_event,
            expected_endpoint_metadata,
        ),
        (
            MOCK_MODEL_NAME,
            ResourceType.MODEL,
            mock_model_event,
            expected_model_metadata,
        ),
        (
            MOCK_TRAINING_JOB_NAME,
            ResourceType.TRAINING_JOB,
            mock_training_job_event,
            expected_training_job_metadata,
        ),
        (
            MOCK_TRANSFORM_JOB_NAME,
            ResourceType.TRANSFORM_JOB,
            mock_transform_job_event,
            expected_transform_job_metadata,
        ),
        (
            MOCK_CONFIG_NAME,
            ResourceType.ENDPOINT_CONFIG,
            mock_config_event,
            expected_config_metadata,
        ),
        (
            MOCK_HPO_JOB_NAME,
            ResourceType.HPO_JOB,
            mock_hpo_event,
            expected_hpo_metadata,
        ),
        (
            MOCK_LABELING_JOB_NAME,
            ResourceType.LABELING_JOB,
            mock_labeling_create_event,
            expected_labeling_metadata,
        ),
    ],
    ids=[
        "notebook_event",
        "endpoint_event",
        "model_event",
        "training_job_event",
        "transform_job_event",
        "endpoint_config_event",
        "hpo_event",
        "labeling_job_event",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
def test_process_event_create_client_error(
    mock_resource_metadata_dao,
    mock_sagemaker,
    resource_id,
    resource_type,
    mock_eventbridge_event,
    expected_metadata,
):
    error_msg = {
        "Error": {
            "Code": "KeyError",
            "Message": "Invalid Key specified",
        },
        "ResponseMetadata": {"HTTPStatusCode": 400},
    }
    if resource_type == ResourceType.HPO_JOB:
        mock_sagemaker.describe_hyper_parameter_tuning_job.return_value = mock_hpo_describe
    if resource_type == ResourceType.LABELING_JOB:
        mock_sagemaker.describe_labeling_job.return_value = mock_labeling_describe

    mock_resource_metadata_dao.upsert_record.side_effect = ClientError(
        error_msg,
        "UpdateItem",
    )
    with pytest.raises(ClientError):
        process_event(mock_eventbridge_event, mock_context)

    if resource_type == ResourceType.HPO_JOB:
        mock_sagemaker.describe_hyper_parameter_tuning_job.assert_called_with(HyperParameterTuningJobName=MOCK_HPO_JOB_NAME)
    if resource_type == ResourceType.LABELING_JOB:
        mock_sagemaker.describe_labeling_job.assert_called_with(LabelingJobName=MOCK_LABELING_JOB_NAME)
    mock_resource_metadata_dao.upsert_record.assert_called_with(
        resource_id, resource_type, MOCK_USERNAME, MOCK_PROJECT_NAME, expected_metadata
    )


@pytest.mark.parametrize(
    "resource_id,resource_type,mock_eventbridge_event,expected_metadata",
    [
        (
            MOCK_NOTEBOOK_NAME,
            ResourceType.NOTEBOOK,
            mock_notebook_event,
            expected_notebook_metadata,
        ),
        (
            MOCK_ENDPOINT_NAME,
            ResourceType.ENDPOINT,
            mock_endpoint_event,
            expected_endpoint_metadata,
        ),
        (
            MOCK_MODEL_NAME,
            ResourceType.MODEL,
            mock_model_event,
            expected_model_metadata,
        ),
        (
            MOCK_TRAINING_JOB_NAME,
            ResourceType.TRAINING_JOB,
            mock_training_job_event,
            expected_training_job_metadata,
        ),
        (
            MOCK_TRANSFORM_JOB_NAME,
            ResourceType.TRANSFORM_JOB,
            mock_transform_job_event,
            expected_transform_job_metadata,
        ),
        (
            MOCK_CONFIG_NAME,
            ResourceType.ENDPOINT_CONFIG,
            mock_config_event,
            expected_config_metadata,
        ),
        (
            MOCK_HPO_JOB_NAME,
            ResourceType.HPO_JOB,
            mock_hpo_event,
            expected_hpo_metadata,
        ),
        (
            MOCK_LABELING_JOB_NAME,
            ResourceType.LABELING_JOB,
            mock_labeling_create_event,
            expected_labeling_metadata,
        ),
    ],
    ids=[
        "notebook_event",
        "endpoint_event",
        "model_event",
        "training_job_event",
        "transform_job_event",
        "endpoint_config_event",
        "hpo_event",
        "labeling_job_event",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
def test_process_event_upsert(
    mock_resource_metadata_dao,
    mock_sagemaker,
    resource_id,
    resource_type,
    mock_eventbridge_event,
    expected_metadata,
):
    if resource_type == ResourceType.HPO_JOB:
        mock_sagemaker.describe_hyper_parameter_tuning_job.return_value = mock_hpo_describe
    if resource_type == ResourceType.LABELING_JOB:
        mock_sagemaker.describe_labeling_job.return_value = mock_labeling_describe

    process_event(mock_eventbridge_event, mock_context)

    if resource_type == ResourceType.HPO_JOB:
        mock_sagemaker.describe_hyper_parameter_tuning_job.assert_called_with(HyperParameterTuningJobName=MOCK_HPO_JOB_NAME)
    if resource_type == ResourceType.LABELING_JOB:
        mock_sagemaker.describe_labeling_job.assert_called_with(LabelingJobName=MOCK_LABELING_JOB_NAME)
    mock_resource_metadata_dao.upsert_record.assert_called_with(
        resource_id, resource_type, MOCK_USERNAME, MOCK_PROJECT_NAME, expected_metadata
    )


@pytest.mark.parametrize(
    "resource_id,resource_type,status_key,deleting_status,mock_eventbridge_event,expected_metadata,error_code",
    [
        (
            MOCK_NOTEBOOK_NAME,
            ResourceType.NOTEBOOK,
            "NotebookInstanceStatus",
            "Deleting",
            mock_notebook_event,
            expected_notebook_metadata,
            "ConditionalCheckFailedException",
        ),
        (
            MOCK_ENDPOINT_NAME,
            ResourceType.ENDPOINT,
            "EndpointStatus",
            "DELETING",
            mock_endpoint_event,
            expected_endpoint_metadata,
            "ValidationException",
        ),
    ],
    ids=[
        "notebook_event",
        "endpoint_event",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
def test_resource_deleting(
    mock_resource_metadata_dao,
    resource_id,
    resource_type,
    status_key,
    deleting_status,
    mock_eventbridge_event,
    expected_metadata,
    error_code,
):
    deleting_event = copy.deepcopy(mock_eventbridge_event)
    deleting_event["detail"][status_key] = deleting_status

    deleting_metadata = copy.deepcopy(expected_metadata)
    deleting_metadata[status_key] = deleting_status

    # For deleting updaets we don't actually expect any exception to be raised (we may be processing)
    # an event for an already deleted record
    mock_resource_metadata_dao.update.side_effect = ClientError(
        {
            "Error": {
                "Code": error_code,
                "Message": f"An error occurred ({error_code}) when calling the DDB operation",
            },
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "DDB",
    )

    process_event(deleting_event, mock_context)
    mock_resource_metadata_dao.delete.assert_not_called()
    mock_resource_metadata_dao.create.assert_not_called()
    mock_resource_metadata_dao.upsert_record.assert_not_called()
    mock_resource_metadata_dao.update.assert_called_with(resource_id, resource_type, deleting_metadata)


@pytest.mark.parametrize(
    "status_key,status,mock_eventbridge_event,expected_metadata,mock_project",
    [
        (
            "EndpointStatus",
            "CREATING",
            mock_endpoint_event,
            expected_endpoint_metadata,
            mock_project_with_termination_configs,
        ),
        (
            "EndpointStatus",
            "CREATING",
            mock_endpoint_event,
            expected_endpoint_metadata,
            mock_project_without_metadata,
        ),
    ],
    ids=[
        "endpoint_event_project_termination_scheudle",
        "endpoint_event_project_no_scheudle",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.project_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_scheduler_dao")
def test_resource_creating_event_with_termination_time(
    mock_resource_scheduler_dao,
    mock_project_dao,
    mock_resource_metadata_dao,
    status_key,
    status,
    mock_eventbridge_event,
    expected_metadata,
    mock_project: ProjectModel,
):
    # Copy events for the test
    creating_event = copy.deepcopy(mock_eventbridge_event)
    creating_event["detail"][status_key] = status
    metadata = copy.deepcopy(expected_metadata)
    metadata[status_key] = status

    mock_project_dao.get.return_value = mock_project

    process_event(creating_event, mock_context)
    if "terminationConfiguration" in mock_project.metadata:
        mock_resource_scheduler_dao.create.assert_called_once()
    else:
        mock_resource_scheduler_dao.create.assert_not_called()
    mock_resource_metadata_dao.upsert_record.assert_called_once()


@pytest.mark.parametrize(
    "resource_id,resource_type,status_key,deleted_status,mock_eventbridge_event",
    [
        (
            MOCK_NOTEBOOK_NAME,
            ResourceType.NOTEBOOK,
            "NotebookInstanceStatus",
            "Deleted",
            mock_notebook_event,
        ),
        (
            MOCK_ENDPOINT_NAME,
            ResourceType.ENDPOINT,
            "EndpointStatus",
            "DELETED",
            mock_endpoint_event,
        ),
        (
            MOCK_MODEL_NAME,
            ResourceType.MODEL,
            None,
            None,
            mock_model_event,
        ),
        (
            MOCK_CONFIG_NAME,
            ResourceType.ENDPOINT_CONFIG,
            None,
            None,
            mock_config_event,
        ),
    ],
    ids=[
        "notebook_event",
        "endpoint_event",
        "model_event",
        "endpoint_config_event",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.sagemaker")
def test_resource_delete(
    mock_sagemaker,
    mock_resource_metadata_dao,
    resource_id,
    resource_type,
    status_key,
    deleted_status,
    mock_eventbridge_event,
):
    delete_event = copy.deepcopy(mock_eventbridge_event)
    if status_key:
        delete_event["detail"][f"{status_key}"] = deleted_status
    elif resource_type == ResourceType.MODEL:
        mock_sagemaker.describe_model.side_effect = _mock_sm_describe_error(resource_type)
    elif resource_type == ResourceType.ENDPOINT_CONFIG:
        mock_sagemaker.describe_endpoint_config.side_effect = _mock_sm_describe_error(resource_type)

    delete_event["detail"]["Tags"] = {}
    process_event(delete_event, mock_context)
    mock_resource_metadata_dao.delete.assert_called_with(resource_id, resource_type)
    mock_resource_metadata_dao.create.assert_not_called()
    mock_resource_metadata_dao.update.assert_not_called()
    if not status_key:
        if resource_type == ResourceType.MODEL:
            mock_sagemaker.describe_model.assert_called_with(ModelName=resource_id)
        elif resource_type == ResourceType.ENDPOINT_CONFIG:
            mock_sagemaker.describe_endpoint_config.assert_called_with(EndpointConfigName=resource_id)


@pytest.mark.parametrize(
    "mock_eventbridge_event",
    [
        (mock_notebook_event),
        (mock_endpoint_event),
        (mock_model_event),
        (mock_training_job_event),
        (mock_transform_job_event),
        (mock_config_event),
        (mock_hpo_event),
    ],
    ids=[
        "notebook_event",
        "endpoint_event",
        "model_event",
        "training_job_event",
        "transform_job_event",
        "endpoint_config_event",
        "hpo_event",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.sagemaker")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
def test_non_mls_event(mock_resource_metadata_dao, mock_sagemaker, mock_eventbridge_event):
    non_mls_event = copy.deepcopy(mock_eventbridge_event)
    non_mls_event["detail"]["Tags"] = {"system": "NotMLSpace"}
    process_event(non_mls_event, mock_context)
    mock_sagemaker.describe_hyper_parameter_tuning_job.assert_not_called()
    mock_resource_metadata_dao.update.assert_not_called()
    mock_resource_metadata_dao.create.assert_not_called()


@pytest.mark.parametrize(
    "resource_type,mock_eventbridge_event",
    [
        (ResourceType.MODEL, mock_model_event),
        (ResourceType.ENDPOINT_CONFIG, mock_config_event),
    ],
    ids=[
        "model_event",
        "endpoint_config_event",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.sagemaker")
def test_no_tag_resource_still_exists(mock_sagemaker, mock_resource_metadata_dao, mock_eventbridge_event, resource_type):
    no_tag_event = copy.deepcopy(mock_eventbridge_event)
    no_tag_event["detail"]["Tags"] = {}
    if resource_type == ResourceType.MODEL:
        mock_sagemaker.describe_model.return_value = {
            "Containers": [],
            "ModelArn": "example_arn",
            "ModelName": MOCK_MODEL_NAME,
            "PrimaryContainer": {
                "Mode": "example_mode",
                "ModelPackageName": "example_model_package",
            },
            "ResponseMetadata": {"HTTPStatusCode": "200"},
        }
    elif resource_type == ResourceType.ENDPOINT_CONFIG:
        mock_sagemaker.describe_endpoint_config.return_value = {
            "EndpointConfigArn": "fake_arn",
            "EndpointConfigName": MOCK_CONFIG_NAME,
            "ResponseMetadata": {"HTTPStatusCode": "200"},
        }

    with pytest.raises(ValueError):
        process_event(no_tag_event, mock_context)

    mock_resource_metadata_dao.delete.assert_not_called()
    mock_resource_metadata_dao.create.assert_not_called()
    mock_resource_metadata_dao.update.assert_not_called()
    if resource_type == ResourceType.MODEL:
        mock_sagemaker.describe_model.assert_called_with(ModelName=MOCK_MODEL_NAME)
    elif resource_type == ResourceType.ENDPOINT_CONFIG:
        mock_sagemaker.describe_endpoint_config.assert_called_with(EndpointConfigName=MOCK_CONFIG_NAME)


# Translate tests are separate because the event processing is so much different than the
# SageMaker events
@pytest.mark.parametrize(
    "mock_event,status,manage_iam_roles,expected_action",
    [
        (mock_translate_terminal_event, "COMPLETED", "True", "update"),
        (_mock_translate_cloudtrail_event(is_create=False), "STOP_REQUESTED", "True", "update"),
        (_mock_translate_cloudtrail_event(), "SUBMITTED", "True", None),
        (
            _mock_translate_cloudtrail_event(notebook_event=True, is_create=False),
            "STOP_REQUESTED",
            "True",
            "update",
        ),
        (_mock_translate_cloudtrail_event(notebook_event=True), "SUBMITTED", "True", "create"),
        (_mock_translate_cloudtrail_event(notebook_event=True), "SUBMITTED", "", None),
    ],
    ids=[
        "terminal_event",
        "cloudwatch_api_stop",
        "cloudwatch_api_start",
        "cloudwatch_api_notebook_stop",
        "cloudwatch_api_notebook_start",
        "cloudwatch_api_notebook_start_no_dynamic_iam",
    ],
)
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.boto3")
def test_translate_event(mock_boto3, mock_resource_metadata_dao, mock_event, status, manage_iam_roles, expected_action):
    # clear out global params if set to make lambda tests independent of each other
    resource_metadata_lambda.translate = {}
    resource_metadata_lambda.env_variables = {"MANAGE_IAM_ROLES": manage_iam_roles}

    if expected_action:
        mock_translate = mock.MagicMock()
        mock_translate.describe_text_translation_job.return_value = _mock_translate_job_describe(job_status=status)
        mock_iam = mock.MagicMock()
        mock_paginator = mock.Mock()
        mock_paginator.paginate.return_value = [
            {
                "Tags": [
                    {
                        "Key": "user",
                        "Value": MOCK_USERNAME,
                    },
                    {
                        "Key": "project",
                        "Value": MOCK_PROJECT_NAME,
                    },
                    {
                        "Key": "system",
                        "Value": "MLSpace",
                    },
                ]
            },
        ]
        mock_iam.get_paginator.return_value = mock_paginator
        mock_boto3.client.side_effect = (
            lambda client_type, **kwargs: mock_translate if client_type == "translate" else mock_iam
        )

    process_event(mock_event, mock_context)

    if expected_action:
        mock_translate.describe_text_translation_job.assert_called_with(JobId=MOCK_TRANSLATE_JOB_ID)
        if expected_action == "update":
            mock_resource_metadata_dao.update.assert_called_with(
                MOCK_TRANSLATE_JOB_ID,
                ResourceType.BATCH_TRANSLATE_JOB,
                _mock_translate_expected_metadata(job_status=status),
            )
        if expected_action == "create":
            mock_iam.get_paginator.assert_called_with("list_role_tags")
            mock_resource_metadata_dao.upsert_record.assert_called_with(
                MOCK_TRANSLATE_JOB_ID,
                ResourceType.BATCH_TRANSLATE_JOB,
                MOCK_USERNAME,
                MOCK_PROJECT_NAME,
                _mock_translate_expected_metadata(job_status=status),
            )
    else:
        mock_boto3.client.assert_not_called()


@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.boto3")
def test_translate_update_event_no_existing_metadata_record(mock_boto3, mock_resource_metadata_dao):
    # clear out global params if set to make lambda tests independent of each other
    resource_metadata_lambda.translate = {}
    mock_translate = mock.MagicMock()
    mock_boto3.client.return_value = mock_translate
    mock_translate.describe_text_translation_job.return_value = _mock_translate_job_describe("STOP_REQUESTED")
    mock_resource_metadata_dao.update.side_effect = ClientError(
        {
            "Error": {
                "Code": "ValidationException",
                "Message": "An error occurred (ValidationException) when calling the PutItem operation: One or more parameter values were invalid: An AttributeValue may not contain an empty string. Key: resourceType",
            },
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "PutItem",
    )

    with pytest.raises(ClientError):
        process_event(_mock_translate_cloudtrail_event(is_create=False), mock_context)

    mock_resource_metadata_dao.update.assert_called_with(
        MOCK_TRANSLATE_JOB_ID,
        ResourceType.BATCH_TRANSLATE_JOB,
        _mock_translate_expected_metadata(job_status="STOP_REQUESTED"),
    )
    mock_translate.describe_text_translation_job.assert_called_with(JobId=MOCK_TRANSLATE_JOB_ID)


@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.boto3")
def test_translate_event_describe_error(mock_boto3, mock_resource_metadata_dao):
    # clear out global params if set to make lambda tests independent of each other
    resource_metadata_lambda.translate = {}
    mock_translate = mock.MagicMock()
    mock_boto3.client.return_value = mock_translate
    mock_translate.describe_text_translation_job.side_effect = ClientError(
        {
            "Error": {
                "Code": "ValidationException",
                "Message": f'An error occurred (ValidationException) when calling the DescribeTextTranslationJob operation: Could not find translation job "{MOCK_TRANSLATE_JOB_ID}".',
            },
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "DescribeTextTranslationJob",
    )

    with pytest.raises(ClientError):
        process_event(_mock_translate_cloudtrail_event(is_create=False), mock_context)

    mock_resource_metadata_dao.update.assert_not_called()
    mock_translate.describe_text_translation_job.assert_called_with(JobId=MOCK_TRANSLATE_JOB_ID)


def test_translate_start_job_via_notebook_iam_client_error():
    pass


@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.resource_metadata_dao")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.iam")
@mock.patch("ml_space_lambda.resource_metadata.lambda_functions.translate")
def test_translate_start_job_via_notebook_missing_tags(mock_translate, mock_iam, mock_resource_metadata_dao):
    # clear out global params if set to make lambda tests independent of each other
    resource_metadata_lambda.env_variables = {"MANAGE_IAM_ROLES": "True"}

    mock_translate.describe_text_translation_job.return_value = _mock_translate_job_describe(job_status="SUBMITTED")
    mock_paginator = mock.Mock()
    mock_paginator.paginate.return_value = [
        {
            "Tags": [
                {
                    "Key": "project",
                    "Value": MOCK_PROJECT_NAME,
                },
                {
                    "Key": "system",
                    "Value": "MLSpace",
                },
            ]
        },
    ]
    mock_iam.get_paginator.return_value = mock_paginator

    with pytest.raises(ValueError):
        process_event(_mock_translate_cloudtrail_event(notebook_event=True), mock_context)

    mock_iam.get_paginator.assert_called_with("list_role_tags")
    mock_translate.describe_text_translation_job.assert_called_with(JobId=MOCK_TRANSLATE_JOB_ID)
    mock_resource_metadata_dao.update.assert_not_called()
    mock_resource_metadata_dao.upsert_record.assert_not_called()
