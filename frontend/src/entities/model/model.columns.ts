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

import { TableProps } from '@cloudscape-design/components';
import { formatDate } from '../../shared/util/date-utils';
import { linkify, sortStringValue } from '../../shared/util/table-utils';
import { ModelResourceMetadata } from '../../shared/model/resource-metadata.model';

const defaultColumns: TableProps.ColumnDefinition<ModelResourceMetadata>[] = [
    {
        id: 'modelName',
        header: 'Model name',
        sortingField: 'resourceId',
        cell: (item) => linkify('model', item.resourceId),
    },
    {
        id: 'modelARN',
        header: 'ARN',
        sortingComparator: sortStringValue('metadata.ModelArn'),
        cell: (item) => item.metadata.ModelArn,
    },
    {
        id: 'creationTime',
        header: 'Creation time',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.CreationTime) - Date.parse(b.metadata.CreationTime),
        cell: (item) => formatDate(item.metadata.CreationTime),
    },
];

const visibleColumns: string[] = ['modelName', 'modelARN', 'creationTime'];

const visibleContentPreference = {
    title: 'Select visible Model content',
    options: [
        {
            label: 'Model properties',
            options: [
                { id: 'modelName', label: 'Model name' },
                { id: 'modelARN', label: 'ARN' },
                { id: 'creationTime', label: 'Creation time' },
            ],
        },
    ],
};

export { defaultColumns, visibleColumns, visibleContentPreference };
