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

import { Hyperparameter } from '../../algorithms';

export const createInputDataConfig = () => {
    return {
        channelName: 'train',
        dataSource: {
            s3DataSource: {
                s3DataType: 'S3Prefix',
                s3Uri: null,
                s3DataDistributionType: 'FullyReplicated',
            },
        },
        contentType: 'text/csv',
        compressionType: 'None',
        recordWrapperType: 'None',
        inputMode: 'File',

        dataSourceType: 'S3',
        dataSourceAccessType: 'global',
        dataSourceDataset: null,
        dataSourceFile: null,
        locations: null,
    };
};

export function createStoppingCondition (value: number, unit: string) {
    let MaxRuntimeInSeconds = value;

    switch (unit) {
        case 'seconds':
            MaxRuntimeInSeconds = value;
            break;
        case 'minutes':
            MaxRuntimeInSeconds = Math.floor(value * 60);
            break;
        case 'hours':
            MaxRuntimeInSeconds = Math.floor(value * 60 * 60);
            break;
        case 'days':
            MaxRuntimeInSeconds = Math.floor(value * 86400);
            break;
        default:
            MaxRuntimeInSeconds = Math.floor(value * 60 * 60);
    }

    return { MaxRuntimeInSeconds };
}

export function createTrainingJob (form: any) {
    return {
        TrainingJobName: form.name,
        HyperParameters: form.hyperParameters.reduce(
            (accumulator: any, parameter: Hyperparameter) => {
                accumulator[parameter.key] = parameter.value;
                return accumulator;
            },
            {}
        ),
        AlgorithmSpecification: {
            TrainingImage: form.image,
            TrainingInputMode: form.inputMode,
            EnableSageMakerMetricsTimeSeries: true,
        },
        InputDataConfig: form.inputDataConfig.map((inputDataConfig: any) => {
            return {
                ChannelName: inputDataConfig.channelName,
                DataSource: {
                    S3DataSource: {
                        S3DataType: inputDataConfig.dataSource.s3DataSource.s3DataType,
                        S3Uri: `${inputDataConfig.dataSourceDataset.location}${inputDataConfig.dataSourceFile}`,
                        S3DataDistributionType:
                            inputDataConfig.dataSource.s3DataSource.s3DataDistributionType,
                    },
                },
                ContentType: inputDataConfig.contentType,
                CompressionType: inputDataConfig.compressionType,
                RecordWrapperType: inputDataConfig.recordWrapperType,
                InputMode: inputDataConfig.inputMode,
            };
        }),
        OutputDataConfig: {
            S3OutputPath: form.outputPath,
        },
        ResourceConfig: {
            InstanceType: form.instanceType,
            InstanceCount: form.instanceCount,
            VolumeSizeInGB: form.volumeSizeInGB,
        },
        StoppingCondition: createStoppingCondition(form.stoppingValue, form.stoppingUnit),
    };
}
