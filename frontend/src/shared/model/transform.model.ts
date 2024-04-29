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

export enum CompressionType {
    None = 'None',
    Gzip = 'Gzip',
}

export enum S3DataType {
    ManifestFile = 'ManifestFile',
    S3Prefix = 'S3Prefix',
}

export enum SplitType {
    None = 'None',
    Line = 'Line',
    RecordIO = 'RecordIO',
    TFRecord = 'TFRecord',
}

export enum AssembleWith {
    None = 'None',
    Line = 'Line',
}

export enum BatchStrategy {
    MultiRecord = 'MultiRecord',
    SingleRecord = 'SingleRecord',
}

export type ITransform = {
    AutoMLJobArn?: string;
    BatchStrategy?: BatchStrategy;
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
    TransformInput: {
        CompressionType?: CompressionType;
        ContentType?: string;
        DataSource: {
            S3DataSource: {
                S3DataType?: S3DataType;
                S3Uri: string;
            };
        };
        SplitType?: SplitType;
    };
    TransformJobArn?: string;
    TransformJobName?: string;
    TransformJobStatus?: JobStatus;
    TransformOutput?: {
        Accept?: string;
        AssembleWith?: AssembleWith;
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
};

export const defaultValue: Readonly<ITransform> & {id: string} = {
    id: '0',
    TransformInput: { DataSource: { S3DataSource: { S3Uri: ''} } },
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
