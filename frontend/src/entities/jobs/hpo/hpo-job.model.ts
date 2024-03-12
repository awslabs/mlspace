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

import { DatasetType } from '../../../shared/model/dataset.model';

export enum TrainingInputMode {
    Pipe = 'Pipe',
    File = 'File',
}

export enum TrainingInputModeExtended {
    Pipe = 'Pipe',
    File = 'File',
    FastFile = 'FastFile',
}

export enum WarmStartType {
    IdenticalDataAndAlgorithm = 'IdenticalDataAndAlgorithm',
    TransferLearning = 'TransferLearning',
}

export enum TrainingJobEarlyStoppingType {
    Off = 'Off',
    Auto = 'Auto',
}

export type ObjectiveMetricType = 'Maximize' | 'Minimize';

export enum S3DataType {
    ManifestFile = 'ManifestFile',
    S3Prefix = 'S3Prefix',
    AugmentedManifestFile = 'AugmentedManifestFile',
}

export enum S3DataDistributionType {
    FullyReplicated = 'FullyReplicated',
    ShardedByS3Key = 'ShardedByS3Key',
}

export enum CompressionType {
    None = 'None',
    Gzip = 'Gzip',
}

export enum RecordWrapperType {
    None = 'None',
    RecordIO = 'RecordIO',
}

export enum InputDataConfigurationInputMode {
    Pipe = 'Pipe',
    File = 'File',
}

export enum InputDataConfigurationInputModeExpanded {
    Pipe = 'Pipe',
    File = 'File',
    FastFile = 'FastFile',
}

export type DatasetExtension = {
    Dataset?: {
        Type: DatasetType;
        Name?: string;
        Location?: string;
    };
};

export type InputDataConfig = {
    ChannelName: string;
    DataSource: {
        S3DataSource?: {
            S3DataType: S3DataType;
            S3Uri: string;
            S3DataDistributionType: S3DataDistributionType;
            AttributeNames?: [string];
            InstanceGroupNames?: [string];
        };
        FileSystemDataSource?: {
            FileSystemId: string;
            FileSystemAccessMode: 'rw' | 'ro';
            FileSystemType: 'EFS' | 'FSxLustre';
            DirectoryPath: string;
        };
    };
    ContentType: string;
    CompressionType: CompressionType;
    RecordWrapperType: RecordWrapperType;
    InputMode: InputDataConfigurationInputMode | InputDataConfigurationInputModeExpanded;
    ShuffleConfig?: {
        Seed: number;
    };
};

export type HyperparameterScalingType = 'Auto' | 'Linear' | 'Logarithmic' | 'ReverseLogarithmic';

export type IntegerParameterRange = {
    Name: string;
    MinValue: string;
    MaxValue: string;
    ScalingType: HyperparameterScalingType;
};

export type ContinuousParameterRange = {
    Name: string;
    MinValue: string;
    MaxValue: string;
    ScalingType: HyperparameterScalingType;
};

export type CategoricalParameterRange = {
    Name: string;
    Values: string[];
};

export type MetricDefinition = {
    Name: string;
    Regex: string;
};

export type AlgorithmSpecification = {
    TrainingImage: string | null;
    TrainingInputMode: TrainingInputMode;
    AlgorithmName?: string | null;
    MetricDefinitions: MetricDefinition[];
};

export type OutputDataConfig = {
    KmsKeyId?: string;
    S3OutputPath: string;
};

export type ResourceConfig = {
    InstanceType?: string;
    InstanceCount: number;
    VolumeSizeInGB?: number;
    VolumeKmsKeyId?: string;
    InstanceGroups?: [
        {
            InstanceType: string;
            InstanceCount: number;
            InstanceGroupName: string;
        }
    ];
    KeepAlivePeriodInSeconds?: number;
};

export type ITrainingJobDefinition = {
    HyperParameters?: Record<string, string>;
    DefinitionName?: string;
    TuningObjective?: {
        Type: ObjectiveMetricType | null;
        MetricName: string | null;
    };
    HyperParameterRanges?: {
        IntegerParameterRanges: IntegerParameterRange[];
        ContinuousParameterRanges: ContinuousParameterRange[];
        CategoricalParameterRanges: CategoricalParameterRange[];
    };
    StaticHyperParameters: {
        string: string;
    };
    AlgorithmSpecification: AlgorithmSpecification;
    RoleArn?: string;
    InputDataConfig: InputDataConfig[];
    VpcConfig?: {
        SecurityGroupIds: string[];
        Subnets: string[];
    };
    OutputDataConfig: OutputDataConfig;
    ResourceConfig: ResourceConfig;
    StoppingCondition: {
        MaxRuntimeInSeconds: number | null;
        MaxWaitTimeInSeconds?: number;
    };
    EnableNetworkIsolation?: boolean;
    EnableInterContainerTrafficEncryption?: boolean;
    EnableManagedSpotTraining?: boolean;
    CheckpointConfig?: {
        S3Uri: string;
        LocalPath: string;
    };
    RetryStrategy?: {
        MaximumRetryAttempts: number;
    };
    HyperParameterTuningResourceConfig?: {
        InstanceType: string;
        InstanceCount: number;
        VolumeSizeInGB: number;
        VolumeKmsKeyId: string;
        AllocationStrategy: 'Prioritized';
        InstanceConfigs: [
            {
                InstanceType: string;
                InstanceCount: number;
                VolumeSizeInGB: number;
            }
        ];
    };
};

export enum HyperParameterTuningJobConfigStrategy {
    Bayesian = 'Bayesian',
    Random = 'Random',
    Hyperband = 'Hyperband',
    Grid = 'Grid',
}

export type IHPOJob = {
    HyperParameterTuningJobName: string;
    HyperParameterTuningJobArn?: string;
    HyperParameterTuningJobConfig: {
        Strategy: HyperParameterTuningJobConfigStrategy;
        StrategyConfig?: {
            HyperbandStrategyConfig: {
                MinResource: number;
                MaxResource: number;
            };
        };
        HyperParameterTuningJobObjective?: {
            Type: 'Maximize' | 'Minimize';
            MetricName: string;
        };
        ResourceLimits: {
            MaxNumberOfTrainingJobs: number;
            MaxParallelTrainingJobs: number;
        };
        ParameterRanges?: {
            IntegerParameterRanges: IntegerParameterRange[];
            ContinuousParameterRanges: ContinuousParameterRange[];
            CategoricalParameterRanges: CategoricalParameterRange[];
        };
        TrainingJobEarlyStoppingType: TrainingJobEarlyStoppingType;
        TuningJobCompletionCriteria?: {
            TargetObjectiveMetricValue: {
                Type: string;
                MetricName: string;
            };
        };
    };
    TrainingJobDefinition?: ITrainingJobDefinition;
    TrainingJobDefinitions: ITrainingJobDefinition[];
    WarmStartConfig?: {
        ParentHyperParameterTuningJobs: [
            {
                HyperParameterTuningJobName: string;
            }
        ];
        WarmStartType: WarmStartType;
    };
    Tags?: [
        {
            Key: string;
            Value: string;
        }
    ];
};

export type TrainingJobStatusCounters = {
    Completed: number;
    InProgress: number;
    RetryableError: number;
    NonRetryableError: number;
    Stopped: number;
};
