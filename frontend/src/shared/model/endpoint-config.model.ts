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

export type ICaptureContentTypeHeader = {
    CsvContentTypes: string[];
    JsonContentTypes: string[];
};

export type ICaptureOption = {
    CaptureMode: 'Input' | 'Output';
};

export type IDataCaptureConfig = {
    EnableCapture: boolean;
    InitialSamplingPercentage: number;
    DestinationS3Uri: string;
    KmsKeyId: string;
    CaptureOptions: ICaptureOption[];
    CaptureContentTypeHeader: ICaptureContentTypeHeader;
};

export type IEndpointCoreDumpConfig = {
    DestinationS3Uri: string;
    KmsKeyId: string;
};

export type IProductionVariant = {
    VariantName: string;
    ModelName: string;
    InitialInstanceCount?: number;
    InitialVariantWeight?: number;
    InstanceType?: string;
    AcceleratorType?: string;
    CoreDumpConfig?: IEndpointCoreDumpConfig;
    VolumeSizeInGB?: number;
    ModelDataDownloadTimeoutInSeconds?: number;
    ContainerStartupHealthCheckTimeoutInSeconds?: number;
};

export type IEndpointConfig = {
    EndpointConfigName?: string;
    EndpointConfigArn?: string;
    KmsKeyId?: string;
    CreationTime?: string;
    ProjectName?: string;
    ProductionVariants?: IProductionVariant[];
    DataCaptureConfig: IDataCaptureConfig;
};

export const defaultEndpointConfig: IEndpointConfig = {
    EndpointConfigName: '',
    ProductionVariants: [],
    DataCaptureConfig: {
        EnableCapture: false,
        InitialSamplingPercentage: 30,
        DestinationS3Uri: '',
        KmsKeyId: '',
        CaptureOptions: [{ CaptureMode: 'Input' }, { CaptureMode: 'Output' }],
        CaptureContentTypeHeader: {
            CsvContentTypes: [],
            JsonContentTypes: [],
        },
    },
};

export const defaultValue: Readonly<IEndpointConfig> = defaultEndpointConfig;

export const defaultProductionVariant = (modelName: string, variantNumber: number, instanceType: string) => {
    return {
        VariantName: `variant-name-${variantNumber}`,
        ModelName: modelName,
        InitialInstanceCount: 1,
        InitialVariantWeight: 1,
        InstanceType: instanceType,
    };
};
