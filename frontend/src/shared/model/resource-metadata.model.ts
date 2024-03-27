/**
  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
import { EMRStatusState } from '../../entities/emr/emr.model';
import { TrainingJobStatusCounters } from '../../entities/jobs/hpo/hpo-job.model';
import { JobStatus } from '../../entities/jobs/job.model';
import { NotebookStatus } from './notebook.model';
import { TranslateJobStatus } from './translate.model';

type IResourceMetadata<T> = {
    resourceId: string;
    resourceType: ResourceType;
    project: string;
    user: string;
    metadata: T;
};

type EndpointMetadata = {
    CreationTime: string;
    EndpointArn: string;
    EndpointStatus: string;
    FailureReason?: string;
    LastModifiedTime: string;
};

type EndpointConfigMetadata = {
    EndpointConfigArn: string;
    CreationTime: string;
};

type EMRMetadata = {
    State: EMRStatusState;
    ReleaseLabel: string;
    CreationTime: string;
    Name: string;
    NormalizedInstanceHours: number;
}

type HPOJobMetadata = {
    CreationTime: string;
    FailureReason?: string;
    HyperParameterTuningEndTime?: string;
    HyperParameterTuningJobArn: string;
    HyperParameterTuningJobStatus: JobStatus;
    LastModifiedTime: string;
    Strategy: string;
    TrainingJobStatusCounters: TrainingJobStatusCounters;
};

type LabelingJobMetadata = {
    CreationTime: string;
    FailureReason?: string;
    LabelingJobArn: string;
    LabelingJobStatus: JobStatus;
    LastModifiedTime: string;
    TaskType: string;
};

type ModelMetadata = {
    ModelArn: string;
    CreationTime: string;
};

type NotebookMetadata = {
    CreationTime: string;
    FailureReason?: string;
    InstanceType: string;
    NotebookInstanceArn: string;
    NotebookInstanceLifecycleConfigName: string;
    NotebookInstanceStatus: NotebookStatus;
};

type TrainingJobMetadata = {
    CreationTime: string;
    FailureReason?: string;
    LastModifiedTime: string;
    TrainingJobArn: string;
    TrainingJobStatus: JobStatus;
    TrainingStartTime?: string;
    TrainingEndTime?: string;
};

type TransformJobMetadata = {
    CreationTime: string;
    FailureReason?: string;
    LastModifiedTime: string;
    TransformJobArn: string;
    TransformJobStatus: JobStatus;
    TransformStartTime?: string;
    TransformEndTime?: string;
};

type TextTranslationMetadata = {
    JobName: string;
    JobStatus: string;
    SourceLanguageCode: TranslateJobStatus;
    SubmittedTime: string;
    TargetLanguageCodes: string[];
};

export type BatchTranslateResourceMetadata = IResourceMetadata<TextTranslationMetadata>;
export type EndpointConfigResourceMetadata = IResourceMetadata<EndpointConfigMetadata>;
export type EMRResourceMetadata = IResourceMetadata<EMRMetadata>;
export type EndpointResourceMetadata = IResourceMetadata<EndpointMetadata>;
export type HPOJobResourceMetadata = IResourceMetadata<HPOJobMetadata>;
export type LabelingJobResourceMetadata = IResourceMetadata<LabelingJobMetadata>;
export type NotebookResourceMetadata = IResourceMetadata<NotebookMetadata>;
export type ModelResourceMetadata = IResourceMetadata<ModelMetadata>;
export type TrainingJobResourceMetadata = IResourceMetadata<TrainingJobMetadata>;
export type TransformJobResourceMetadata = IResourceMetadata<TransformJobMetadata>;

// Updating the ResourceType enumeration will likely require an update to the
// corresponding enum in the lambda code (src/ml_space_lambda/enums.py)
export enum ResourceType {
    BATCH_TRANSLATE_JOB = 'batch-translate-job',
    EMR_CLUSTER = 'cluster',
    ENDPOINT = 'endpoint',
    ENDPOINT_CONFIG = 'endpoint-config',
    HPO_JOB = 'hpo-job',
    LABELING_JOB = 'labeling-job',
    MODEL = 'model',
    NOTEBOOK = 'notebook-instance',
    TRAINING_JOB = 'training-job',
    TRANSFORM_JOB = 'transform-job',
}
