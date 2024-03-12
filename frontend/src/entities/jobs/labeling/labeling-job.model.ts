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

/* istanbul ignore file */
import { JobStatus } from '../job.model';

export type ILabelingJob = {
    LabelingJobStatus: JobStatus;
    LabelCounters: {
        TotalLabeled: number;
        HumanLabeled: number;
        MachineLabeled: number;
        FailedNonRetryableError: number;
        Unlabeled: number;
    };
    FailureReason?: string;
    CreationTime: string;
    LastModifiedTime?: string;
    JobReferenceCode: string;
    LabelingJobName: string;
    LabelingJobArn: string;
    LabelAttributeName: string;
    InputConfig: {
        DataSource: {
            S3DataSource: {
                ManifestS3Uri: string;
            };
        };
    };
    OutputConfig: {
        S3OutputPath: string;
        KmsKeyId: string;
    };
    RoleArn?: string;
    LabelCategoryConfigS3Uri?: string;
    StoppingConditions?: {
        MaxHumanLabeledObjectCount: number;
        MaxPercentageOfInputDatasetLabeled: number;
    };
    LabelingJobAlgorithmsConfig?: {
        LabelingJobAlgorithmSpecificationArn: string;
        InitialActiveLearningModelArn?: string;
        LabelingJobResourceConfig?: {
            VolumeKmsKeyId?: string;
            VpcConfig: {
                SecurityGroupIds: string[];
                Subnets: string[];
            };
        };
    };
    HumanTaskConfig: {
        WorkteamArn: string;
        UiConfig: {
            UiTemplateS3Uri: string;
        };
        PreHumanTaskLambdaArn: string;
        TaskTitle: string;
        TaskDescription: string;
        AnnotationConsolidationConfig: {
            AnnotationConsolidationLambdaArn: string;
        };
        TaskKeywords?: string[];
        NumberOfHumanWorkersPerDataObject: number;
        TaskTimeLimitInSeconds: number;
        TaskAvailabilityLifetimeInSeconds: number;
        MaxConcurrentTaskCount?: number;
        PublicWorkforceTaskPrice?: {
            AmountInUsd: {
                Dollars: number;
                Cents: number;
                TenthFractionsOfACent: number;
            };
        };
    };
};

export type ILabelingJobCreate = Omit<
    ILabelingJob,
    | 'LabelingJobStatus'
    | 'LabelCounters'
    | 'CreationTime'
    | 'FailureReason'
    | 'LastModifiedTime'
    | 'JobReferenceCode'
    | 'LabelingJobArn'
    | 'LabelAttributeName'
> & {
    LabelAttributeName?: string;
};

export enum LabelingJobCategory {
    Image = 'Image',
    Text = 'Text',
}

export type ILabelingJobWorkteam = {
    WorkteamArn: string;
    WorkteamName: string;
};
