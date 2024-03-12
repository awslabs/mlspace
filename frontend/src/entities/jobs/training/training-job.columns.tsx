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
import { formatDate, formatDateDiff } from '../../../shared/util/date-utils';
import { TrainingJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

const defaultColumns: TableProps.ColumnDefinition<TrainingJobResourceMetadata>[] = [
    {
        id: 'name',
        header: 'Name',
        sortingField: 'resourceId',
        cell: (item) => linkify('training', item.resourceId, 'detail'),
    },
    {
        id: 'arn',
        header: 'ARN',
        sortingComparator: sortStringValue('metadata.TrainingJobArn'),
        cell: (item) => item.metadata.TrainingJobArn,
    },
    {
        id: 'creationTime',
        header: 'Creation time',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.CreationTime) - Date.parse(b.metadata.CreationTime),
        cell: (item) => formatDate(item.metadata.CreationTime),
    },
    {
        id: 'modified',
        header: 'Last updated',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.LastModifiedTime) - Date.parse(b.metadata.LastModifiedTime),
        cell: (item) => formatDate(item.metadata.LastModifiedTime),
    },
    {
        id: 'duration',
        header: 'Duration',
        cell: (item) =>
            item.metadata.TrainingStartTime
                ? formatDateDiff(
                    item.metadata.TrainingStartTime,
                    item.metadata.TrainingEndTime || new Date().toString()
                )
                : '-',
    },
    {
        id: 'status',
        header: 'Job status',
        sortingComparator: sortStringValue('metadata.TrainingJobStatus'),
        cell: (item) =>
            prettyStatus(item.metadata.TrainingJobStatus, item.metadata.FailureReason, true),
    },
];

const visibleColumns: string[] = ['name', 'creationTime', 'duration', 'status'];

const visibleContentPreference = {
    title: 'Select visible columns',
    options: [
        {
            label: 'Instance attributes',
            options: [
                { id: 'name', label: 'Name' },
                { id: 'arn', label: 'ARN' },
                { id: 'creationTime', label: 'Creation time' },
                { id: 'modified', label: 'Last updated' },
                { id: 'duration', label: 'Duration' },
                { id: 'status', label: 'Job status' },
            ],
        },
    ],
};

export { defaultColumns, visibleColumns, visibleContentPreference };
