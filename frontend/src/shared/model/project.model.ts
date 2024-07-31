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

export type IProject = {
    name?: string;
    description?: string;
    suspended?: boolean;
    isOwner?: boolean;
    metadata?: ProjectMetadata;
};

export type GetProjectRequestProperties = {
    projectName: string;
    includeResourceCounts?: boolean;
};

export type ProjectMetadata = {
    terminationConfiguration: ProjectTerminationConfiguration;
};

export type ProjectTerminationConfiguration = {
    defaultEMRClusterTTL?: number;
    defaultEndpointTTL?: number;
    defaultNotebookStopTime?: string;
    allowEMROwnerOverride: boolean;
    allowNotebookOwnerOverride: boolean;
    allowEndpointOwnerOverride: boolean;
};

export const defaultProject: IProject = {
    name: '',
    description: '',
};

export const defaultValue: Readonly<IProject> = defaultProject;
