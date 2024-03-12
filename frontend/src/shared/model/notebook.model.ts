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

export type INotebook = {
    NotebookInstanceArn?: string;
    NotebookInstanceName: string;
    NotebookInstanceStatus?: string;
    NotebookDailyStopTime?: number;
    Url?: string;
    InstanceType?: string;
    SubnetId?: string;
    SecurityGroups?: string;
    RoleArn?: string;
    KmsKeyId?: string;
    NetworkInterfaceId?: string;
    LastModifiedTime?: string;
    CreationTime?: string;
    NotebookInstanceLifecycleConfigName: string;
    DirectInternetAccess?: string;
    VolumeSizeInGB: number;
    RootAccess?: boolean;
    PlatformIdentifier?: string;
    Owner?: string;
    Project?: string;
};

export type IEMRBackedNotebook = {
    clusterId?: string;
};

export type NotebookStatus =
    | 'Pending'
    | 'InService'
    | 'Stopping'
    | 'Stopped'
    | 'Failed'
    | 'Deleting'
    | 'Updating';

export const defaultNotebook: INotebook = {
    NotebookInstanceName: '',
    InstanceType: 'ml.t3.medium',
    NotebookInstanceLifecycleConfigName: 'No configuration',
    VolumeSizeInGB: 5,
};

export const defaultValue: Readonly<INotebook> = defaultNotebook;
