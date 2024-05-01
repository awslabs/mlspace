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

/**
 * Normalizes resource metadata endpoint status from a cloudwatch event status to an
 * EndpointStatus that matches the values returned from the SageMaker list/details API calls
 * for endpoints.
 *
 * @param endpointStatus Resource metadata endpoint status based on CloudWatch event data
 * @returns string
 */
export const normalizeEndpointMetadataStatus = (endpointStatus: string): string => {
    switch (endpointStatus) {
        case 'IN_SERVICE':
            return 'InService';
        case 'CREATING':
            return 'Creating';
        case 'UPDATING':
            return 'Updating';
        case 'DELETING':
            return 'Deleting';
        case 'FAILED':
            return 'Failed';
    }
    return endpointStatus;
};

export type IEndpointStatus = 'OutOfService'
| 'Creating'
| 'Updating'
| 'SystemUpdating'
| 'RollingBack'
| 'InService'
| 'Deleting'
| 'Failed';

export type IEndpointDataCaptureConfig = {
    EnableCapture: boolean;
    CaptureStatus: 'Started' | 'Stopped';
    CurrentSamplingPercentage: string;
    DestinationS3Uri: string;
    KmsKeyId: string;
};

export type IVariantStatus = {
    Status: 'Creating' | 'Updating' | 'Deleting' | 'ActivatingTraffic' | 'Baking';
    StatusMessage: string;
    StartTime: Date;
};

export type IDeployedImages = {
    SpecifiedImage: string;
    ResolvedImage: string;
    ResolutionTime: Date;
};

export type IEndpointProductionVariant = {
    VariantName: string;
    DeployedImages: IDeployedImages[];
    CurrentWeight: number;
    DesiredWeight: number;
    CurrentInstanceCount: number;
    DesiredInstanceCount: number;
    VariantStatus: IVariantStatus[];
};

export type IEndpoint = {
    EndpointName?: string;
    EndpointArn?: string;
    EndpointConfigName?: string;
    ProductionVariants?: IEndpointProductionVariant[];
    DataCaptureConfig: IEndpointDataCaptureConfig;
    EndpointStatus: IEndpointStatus;
    FailureReason?: string;
    CreationTime?: string;
    LastModifiedTime?: string;
    ProjectName?: string;
    TerminationTime?: number;
    Owner?: string;
};

export const defaultEndpoint: IEndpoint = {
    ProductionVariants: [],
    EndpointStatus: 'OutOfService',
    DataCaptureConfig: {
        EnableCapture: false,
        CaptureStatus: 'Started',
        CurrentSamplingPercentage: '30',
        DestinationS3Uri: '',
        KmsKeyId: '',
    },
};

export const defaultValue: Readonly<IEndpoint> = defaultEndpoint;
