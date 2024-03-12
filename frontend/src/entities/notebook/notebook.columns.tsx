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
import { TableProps } from '@cloudscape-design/components';
import { formatDate } from '../../shared/util/date-utils';
import { linkify, prettyStatus, sortStringValue } from '../../shared/util/table-utils';
import { NotebookResourceMetadata } from '../../shared/model/resource-metadata.model';

const defaultColumns: TableProps.ColumnDefinition<NotebookResourceMetadata>[] = [
    {
        id: 'instanceName',
        header: 'Instance name',
        sortingField: 'resourceId',
        cell: (item) => <div data-cy={item.resourceId}>{linkify('notebook', item.resourceId)}</div>,
    },
    {
        id: 'creationTime',
        header: 'Creation time',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.CreationTime) - Date.parse(b.metadata.CreationTime),
        cell: (item) => formatDate(item.metadata.CreationTime),
    },
    {
        id: 'status',
        header: 'Status',
        sortingComparator: sortStringValue('metadata.NotebookInstanceStatus'),
        cell: (item) =>
            prettyStatus(item.metadata.NotebookInstanceStatus!, item.metadata.FailureReason),
    },
    {
        id: 'instanceType',
        header: 'Instance type',
        sortingComparator: sortStringValue('metadata.InstanceType'),
        cell: (item) => item.metadata.InstanceType,
    },
    {
        id: 'createdBy',
        header: 'Created by',
        sortingField: 'user',
        cell: (item) => item.user,
    },
];

const visibleColumns: string[] = [
    'instanceName',
    'creationTime',
    'status',
    'instanceType',
    'createdBy',
];

const visibleContentPreference = {
    title: 'Select visible Notebook content',
    options: [
        {
            label: 'Notebook properties',
            options: [
                { id: 'instanceName', label: 'Instance name' },
                { id: 'creationTime', label: 'Creation time' },
                { id: 'status', label: 'Status' },
                { id: 'instanceType', label: 'Instance type' },
                { id: 'createdBy', label: 'Created by' },
            ],
        },
    ],
};

export { defaultColumns, visibleColumns, visibleContentPreference };
