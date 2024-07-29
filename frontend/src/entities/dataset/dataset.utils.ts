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

import { DatasetType, IDataset } from '../../shared/model/dataset.model';

export const validateName = function (datasetName: string) {
    // Validate that the instance name follows the naming guidelines
    const valid = /^[A-Za-z0-9][a-zA-Z0-9-]*/;
    return valid.test(datasetName);
};

export const showAccessLevel = (dataset: IDataset) => {
    if (dataset.type === DatasetType.PROJECT) {
        return `${dataset.type}: ${dataset.scope}`;
    } else {
        return dataset.type;
    }
};

//TODO: for private datasets, show the name of the user and their status (suspended/active)
//TODO: for datasets associated with a suspended user/project or 0 groups, put the WARNING icon next to it
export const showDatasetOwnership = (dataset: IDataset) => {
    if (dataset.type === DatasetType.GROUP) {
        return `${dataset.groups?.length || 0} group${dataset.groups && dataset.groups.length === 1 ? '' : 's'} associated`;
    } else if (dataset.type === DatasetType.PRIVATE) {
        return dataset.createdBy;
    } else if (dataset.type === DatasetType.PROJECT) {
        return dataset.scope;
    } else {
        return '-';
    }
};

export const deleteButtonAriaLabel = 'Delete selected files';
export const downloadButtonAriaLabel = 'Download selected file';
export const copyButtonAriaLabel = 'Copy selected file S3 URI';
