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

import { IDataset } from '../../../shared/model/dataset.model';
import { validateName } from '../dataset.utils';

export type DatasetValidation = {
    name: boolean;
    description: boolean;
    createdBy: boolean;
    scope: boolean;
    type: boolean;
    location: boolean;
    format: boolean;
    files: boolean;
};

export const defaultDatasetValidation = {
    name: true,
    description: true,
    createdBy: true,
    scope: true,
    type: true,
    location: true,
    format: true,
    files: true,
};

export function validate (dataset: IDataset): DatasetValidation {
    return {
        name: validateName(dataset.name!),
        description: !!dataset.description,
        createdBy: !!dataset.createdBy,
        scope: !!dataset.scope,
        type: !!dataset.type,
        location: !!dataset.location,
        format: !!dataset.format,
        files: !!dataset.files,
    };
}

export function isValid (datasetValidation: DatasetValidation): boolean {
    return (
        datasetValidation.name &&
        datasetValidation.description &&
        datasetValidation.type &&
        datasetValidation.format
    );
}

export function generateErrorText (datasetValidation: DatasetValidation) {
    if (!datasetValidation.name) {
        return 'Dataset name must not be empty, can contain only letters or numbers, and be between 1 and 255 characters';
    } else if (!datasetValidation.type) {
        return 'Dataset type cannot be empty';
    } else if (!datasetValidation.format) {
        return 'Format cannot be empty';
    } else if (!datasetValidation.createdBy) {
        return 'Unable to determine current user';
    }

    return '';
}
