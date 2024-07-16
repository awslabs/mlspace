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

import { DatasetType, IDataset } from '../../../shared/model/dataset.model';
import { determineScope } from '../dataset.service';

export const createDatasetFromForm = (form: any, projectName: string, username: string): IDataset & Required<Pick<IDataset, 'name' | 'description' | 'type' | 'format' | 'scope'>> => {
    if (form.type.startsWith(DatasetType.GROUP)) {
        form.type = DatasetType.GROUP;
    }
    return {
        name: form.name,
        description: form.description,
        type: form.type,
        format: form.format,
        scope: determineScope(form.type, projectName, form.groupName, username!)
    };
};
