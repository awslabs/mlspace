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
import React from 'react';
import { StatusIndicator, TableProps } from '@cloudscape-design/components';
import { DatasetType, IDataset } from '../../shared/model/dataset.model';
import { linkify } from '../../shared/util/table-utils';
import { showDatasetOwnership } from './dataset.utils';

const defaultColumns: TableProps.ColumnDefinition<IDataset>[] = [
    {
        id: 'datasetName',
        header: 'Dataset name',
        sortingField: 'datasetName',
        cell: (item) => (
            <div data-cy={item.name}>{linkify('dataset', item.name!, `${item.type!}/${item.scope!}`)}</div>
        ),
    },
    { id: 'type', header: 'Dataset type', sortingField: 'type', cell: (item) => item.type },
    {
        id: 'description',
        header: 'Description',
        sortingField: 'description',
        cell: (item) => item.description,
    },
    {
        id: 'accessLevel',
        header: 'Access Level',
        sortingField: 'scope',
        cell: (item) => item.type,
    },
];

const adminDatasetColumns: TableProps.ColumnDefinition<IDataset>[] = defaultColumns.concat([
    {
        id: 'owners',
        header: 'Owners',
        sortingField: 'owners',
        cell: (item) => item.type === DatasetType.GROUP && item.groups && item.groups.length === 0 ? <StatusIndicator type='warning'>{showDatasetOwnership(item)}</StatusIndicator> : showDatasetOwnership(item),
    },
]);

const defaultColumnsWithUrlOverride: TableProps.ColumnDefinition<IDataset>[] = [
    {
        id: 'datasetName',
        header: 'Dataset name',
        sortingField: 'datasetName',
        cell: (item) => (
            <div data-cy={item.name}>{linkify('personal/dataset', item.name!, `${item.type!}/${item.scope!}`,undefined, true)}</div>
        ),
    },
    { id: 'type', header: 'Dataset type', sortingField: 'type', cell: (item) => item.type },
    {
        id: 'description',
        header: 'Description',
        sortingField: 'description',
        cell: (item) => item.description,
    },
];

const visibleColumns: string[] = ['datasetName', 'description', 'accessLevel'];
const visibleAdminColumns: string[] = visibleColumns.concat(['owners']);

const visibleContentPreference = {
    title: 'Select visible Dataset content',
    options: [
        {
            label: 'Dataset properties',
            options: [
                { id: 'datasetName', label: 'Dataset name' },
                { id: 'description', label: 'Description' },
                { id: 'accessLevel', label: 'Access level' },
            ],
        },
    ],
};

export {
    defaultColumns,
    adminDatasetColumns,
    visibleColumns,
    visibleAdminColumns,
    visibleContentPreference,
    defaultColumnsWithUrlOverride,
};
