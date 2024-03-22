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

import { IDatasetFile } from '../../shared/model/datasetfile.model';
import { IDataset } from '../../shared/model/dataset.model';
import { convertBytesToHumanReadable } from './create/dataset-upload.utils';

export const validateName = function (datasetName: string) {
    // Validate that the instance name follows the naming guidelines
    const valid = /^[A-Za-z0-9][a-zA-Z0-9-]*/;
    return valid.test(datasetName);
};

export const mapFilesToDatasetFiles = (file: File) => {
    return {
        key: file.name,
        size: convertBytesToHumanReadable(file.size),
        file: file,
    } as IDatasetFile;
};

export const showAccessLevel = (dataset: IDataset) => {
    if (dataset.type === 'project') {
        return dataset.scope;
    } else {
        return dataset.type;
    }
};

export const deleteButtonAriaLabel = 'Delete selected files';
