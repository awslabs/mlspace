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

import { JobStatus } from '../../entities/jobs/job.model';
import { TableEntry } from '../../modules/table';

export type ITransform = {
    AutoMLJobArn?: string;
    BatchStrategy?: string;
    CreationTime?: string;
    DataCaptureConfig?: {
        DestinationS3Uri?: string;
        GenerateInferenceId?: boolean;
        KmsKeyId?: string;
    };
    DataProcessing?: {
        InputFilter?: string;
        JoinSource?: string;
        OutputFilter?: string;
    };
    Environment?: Record<string, string>[];
    ExperimentConfig?: {
        ExperimentName?: string;
        TrialComponentDisplayName?: string;
        TrialName?: string;
    };
    FailureReason?: string;
    LabelingJobArn?: string;
    MaxConcurrentTransforms?: number;
    MaxPayloadInMB?: number;
    ModelClientConfig?: {
        InvocationsMaxRetries?: number;
        InvocationsTimeoutInSeconds?: number;
    };
    ModelName?: string;
    TransformEndTime?: string;
    TransformInput?: {
        CompressionType?: string;
        ContentType?: string;
        DataSource?: {
            S3DataSource?: {
                S3DataType?: string;
                S3Uri?: string;
            };
        };
        SplitType?: string;
    };
    TransformJobArn?: string;
    TransformJobName?: string;
    TransformJobStatus?: JobStatus;
    TransformOutput?: {
        Accept?: string;
        AssembleWith?: string;
        KmsKeyId?: string;
        S3OutputPath?: string;
    };
    TransformResources?: {
        InstanceCount?: number;
        InstanceType?: string;
        VolumeKmsKeyId?: string;
    };
    TransformStartTime?: string;
    ProjectName?: string;
    duration?: string;
} & TableEntry;

export const defaultValue: Readonly<ITransform> = {
    id: '0',
    TransformInput: { DataSource: { S3DataSource: {} } },
    TransformOutput: {},
    TransformResources: {
        InstanceCount: 1,
    },
    ModelClientConfig: {
        InvocationsMaxRetries: 3,
        InvocationsTimeoutInSeconds: 600,
    },
    MaxPayloadInMB: 6,
    TransformJobArn: '',
    TransformJobName: '',
    TransformJobStatus: JobStatus.InProgress,
};
