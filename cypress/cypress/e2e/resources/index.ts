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

export const notebookInstance = {
    NotebookInstanceName: '',
    NotebookInstanceArn: '',
    NotebookInstanceStatus: 'Pending',
    Url: '',
    InstanceType: 'ml.t3.xlarge',
    CreationTime: '2023-01-10 21:48:53.708000+00:00',
    LastModifiedTime: '2023-01-10 21:53:03.863000+00:00',
    NotebookInstanceLifecycleConfigName: 'No configuration',
    VolumeSizeInGB: 5,
    Owner: Cypress.env('username')
};

export const newNotebookInstance = {
    NotebookInstanceName: '',
    InstanceType: 'ml.t3.xlarge',
    NotebookInstanceLifecycleConfigName: 'No configuration',
    VolumeSizeInGB: 5
};

export const notebookOptions = {
    lifecycleConfigs: ['No configuration']
};

export const computeTypes = {
    InstanceTypes: {
        InstanceType: [
            'ml.t2.medium',
            'ml.t2.large',
            'ml.t2.xlarge',
            'ml.t3.medium',
            'ml.t3.large',
            'ml.t3.xlarge',
        ]
    }
};

export const project = {
    project: {
        name: '',
        description: 'E2E test project',
        suspended: false,
        createdBy: 'mo',
        createdAt: 1668113755,
        lastUpdatedAt: 1668113755
    },
    permissions: ['CO']
};

export const dataset = {
    DatasetName: 'E2EDatasetTest',
    DatasetDescription: 'E2E test dataset',
    DatasetType: 'Global',
    DatasetFormat: 'text/plain',
};