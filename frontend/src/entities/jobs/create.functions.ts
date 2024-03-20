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

import {
    CategoricalParameterRange,
    CompressionType,
    ContinuousParameterRange,
    DatasetExtension,
    HyperParameterTuningJobConfigStrategy,
    IHPOJob,
    InputDataConfig,
    IntegerParameterRange,
    ITrainingJobDefinition,
    OutputDataConfig,
    RecordWrapperType,
    S3DataDistributionType,
    S3DataType,
    TrainingInputMode,
    TrainingJobEarlyStoppingType,
} from './hpo/hpo-job.model';
import { DatasetType } from '../../shared/model/dataset.model';
import { ITrainingJob } from './training/training-job.model';
import { ILabelingJobCreate } from './labeling/labeling-job.model';

export const createInputDataConfig = (): InputDataConfig & DatasetExtension => {
    return {
        ChannelName: 'train',
        DataSource: {
            S3DataSource: {
                S3DataType: S3DataType.S3Prefix,
                S3Uri: '',
                S3DataDistributionType: S3DataDistributionType.FullyReplicated,
            },
        },
        ContentType: 'text/csv',
        CompressionType: CompressionType.None,
        RecordWrapperType: RecordWrapperType.None,
        Dataset: {
            Type: DatasetType.GLOBAL,
        },
    };
};

export const createTrainingJob = (): Omit<
    ITrainingJob,
    | 'TrainingJobArn'
    | 'TrainingJobStatus'
    | 'SecondaryStatus'
    | 'FailureReason'
    | 'RoleArn'
    | 'CreationTime'
    | 'TrainingStartTime'
    | 'TrainingEndTime'
    | 'LastModifiedTime'
    | 'TrainingTimeInSeconds'
    | 'BillableTimeInSeconds'
    | 'ProfilingStatus'
    | 'ModelArtifacts'
> => {
    return {
        TrainingJobName: '',
        HyperParameters: {},
        AlgorithmSpecification: {
            TrainingInputMode: TrainingInputMode.File,
            EnableSageMakerMetricsTimeSeries: false,
        },
        InputDataConfig: [createInputDataConfig()],
        OutputDataConfig: {
            S3OutputPath: '',
            Dataset: {
                Type: DatasetType.PRIVATE,
            },
        } as OutputDataConfig,
        ResourceConfig: {
            InstanceType: 'ml.m4.xlarge',
            InstanceCount: 1,
            VolumeSizeInGB: 10,
        },
        StoppingCondition: {
            MaxRuntimeInSeconds: 86400,
        },
        EnableNetworkIsolation: true,
    };
};

export const createTrainingDefinition = (): ITrainingJobDefinition => {
    return {
        DefinitionName: '',
        TuningObjective: {
            Type: null,
            MetricName: null,
        },
        HyperParameterRanges: {
            CategoricalParameterRanges: [] as CategoricalParameterRange[],
            ContinuousParameterRanges: [] as ContinuousParameterRange[],
            IntegerParameterRanges: [] as IntegerParameterRange[],
        },
        StaticHyperParameters: {} as { string: string },
        AlgorithmSpecification: {
            TrainingImage: '',
            TrainingInputMode: TrainingInputMode.File,
            AlgorithmName: null,
            MetricDefinitions: [],
        },
        InputDataConfig: [createInputDataConfig()],
        OutputDataConfig: {
            KmsKeyId: '',
            S3OutputPath: '',
            Dataset: {
                Type: DatasetType.PRIVATE,
            },
        } as OutputDataConfig,
        ResourceConfig: {
            InstanceCount: 1,
            VolumeSizeInGB: 10,
        },
        StoppingCondition: {
            MaxRuntimeInSeconds: 86400,
        },
        EnableNetworkIsolation: true,
    };
};

export const createHPOJob = (): IHPOJob => {
    return {
        HyperParameterTuningJobName: '',
        TrainingJobDefinitions: [] as ITrainingJobDefinition[],
        HyperParameterTuningJobConfig: {
            Strategy: HyperParameterTuningJobConfigStrategy.Bayesian,
            TrainingJobEarlyStoppingType: TrainingJobEarlyStoppingType.Off,
            ResourceLimits: {
                MaxNumberOfTrainingJobs: 500,
                MaxParallelTrainingJobs: 10,
            },
        },
    };
};

export const createDefaultLabelingJob = (): ILabelingJobCreate => {
    return {
        LabelingJobName: '',
        LabelAttributeName: '',
        InputConfig: {
            DataSource: {
                S3DataSource: {
                    ManifestS3Uri: '',
                },
            },
        },
        OutputConfig: {
            S3OutputPath: '',
            KmsKeyId: '',
        },
        RoleArn: '',
        LabelCategoryConfigS3Uri: '',
        HumanTaskConfig: {
            WorkteamArn: '',
            UiConfig: {
                UiTemplateS3Uri: '',
            },
            PreHumanTaskLambdaArn: '',
            TaskKeywords: ['Images', 'categorization', 'classification'],
            TaskTitle: 'Image Classification (Single Label): ',
            TaskDescription: 'Categorize images into individual classes.',
            NumberOfHumanWorkersPerDataObject: 1,
            TaskAvailabilityLifetimeInSeconds: 864000,
            TaskTimeLimitInSeconds: 300,
            AnnotationConsolidationConfig: {
                AnnotationConsolidationLambdaArn: '',
            },
        },
    };
};
