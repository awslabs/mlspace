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
import { InputDataConfig } from '../hpo/hpo-job.model';
import { JobStatus, SecondaryStatus } from '../job.model';

export type ITrainingJob = {
    TuningJobArn?: string,
    TuningJobName?: string,
    TrainingJobName?: string;
    TrainingJobArn?: string;
    TrainingJobStatus?: JobStatus;
    SecondaryStatus?: SecondaryStatus;
    FailureReason?: string;
    HyperParameters?: { [key: string]: string };
    AlgorithmSpecification?: {
        TrainingImage?: string;
        AlgorithmName?: null;
        TrainingInputMode?: string;
        MetricDefinitions?: { Name: string; Regex: string }[];
        EnableSageMakerMetricsTimeSeries: boolean;
    };
    RoleArn?: string;
    InputDataConfig?: InputDataConfig[];
    OutputDataConfig?: {
        KmsKeyId?: string;
        S3OutputPath: string;
    };
    ResourceConfig?: {
        InstanceType: string;
        InstanceCount: number;
        VolumeSizeInGB: number;
        VolumeKmsKeyId?: string;
    };
    StoppingCondition?: {
        MaxRuntimeInSeconds: number;
    };
    CreationTime?: string;
    TrainingStartTime?: string;
    TrainingEndTime?: string;
    LastModifiedTime?: string;
    TrainingTimeInSeconds?: number;
    BillableTimeInSeconds?: number;
    ProfilingStatus?: string;
    ModelArtifacts?: {
        S3ModelArtifacts: string;
    };
    VpcConfig?: {
        SecurityGroupIds: string[];
        Subnets: string[];
    };
    EnableNetworkIsolation: boolean;
    ProjectName?: string;
    UserName?: string;
};
