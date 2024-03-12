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
import { linkify, prettyStatus, sortStringValue } from '../../../shared/util/table-utils';
import { formatDate } from '../../../shared/util/date-utils';
import { LabelingJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

const defaultColumns: TableProps.ColumnDefinition<LabelingJobResourceMetadata>[] = [
    {
        id: 'name',
        header: 'Name',
        sortingField: 'resourceId',
        cell: (item) => linkify('labeling', item.resourceId),
    },
    {
        id: 'status',
        header: 'Status',
        sortingComparator: sortStringValue('metadata.LabelingJobStatus'),
        cell: (item) => prettyStatus(item.metadata.LabelingJobStatus, item.metadata.FailureReason),
    },
    {
        id: 'taskType',
        header: 'Task type',
        sortingComparator: sortStringValue('metadata.TaskType'),
        cell: (item) => item.metadata.TaskType,
    },
    {
        id: 'creationTime',
        header: 'Creation time',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.CreationTime) - Date.parse(b.metadata.CreationTime),
        cell: (item) => formatDate(item.metadata.CreationTime),
    },
];

const visibleColumns: string[] = ['name', 'status', 'taskType', 'creationTime'];

const visibleContentPreference = {
    title: 'Select visible columns',
    options: [
        {
            label: 'Instance attributes',
            options: [
                { id: 'name', label: 'Name' },
                { id: 'status', label: 'Job status' },
                { id: 'taskType', label: 'Task type' },
                { id: 'creationTime', label: 'Creation time' },
            ],
        },
    ],
};

export { defaultColumns, visibleColumns, visibleContentPreference };
