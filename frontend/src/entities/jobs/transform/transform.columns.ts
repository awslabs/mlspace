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
import { formatDate } from '../../../shared/util/date-utils';
import { linkify, prettyStatus, sortStringValue } from '../../../shared/util/table-utils';
import { getDurationText } from './transform.reducer';
import { TransformJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

const batchTransformJobColumns: TableProps.ColumnDefinition<TransformJobResourceMetadata>[] = [
    {
        id: 'name',
        header: 'Name',
        sortingField: 'resourceId',
        cell: (item) => linkify('transform', item.resourceId),
    },
    {
        id: 'status',
        header: 'Job status',
        sortingComparator: sortStringValue('metadata.TransformJobStatus'),
        cell: (item) =>
            prettyStatus(item.metadata.TransformJobStatus, item.metadata.FailureReason, true),
    },
    {
        id: 'duration',
        header: 'Duration',
        cell: (item) =>
            getDurationText(
                item.metadata.CreationTime,
                item.metadata.TransformStartTime,
                item.metadata.TransformEndTime
            ),
    },
    {
        id: 'created',
        header: 'Creation time',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.CreationTime) - Date.parse(b.metadata.CreationTime),
        cell: (item) => formatDate(item.metadata.CreationTime),
    },
];

const visibleColumns: string[] = ['name', 'status', 'duration', 'created'];

const visibleContentPreference = {
    title: 'Select visible Batch Transform job content',
    options: [
        {
            label: 'Batch Transform job properties',
            options: [
                { id: 'name', label: 'Name' },
                { id: 'status', label: 'Status' },
                { id: 'duration', label: 'Duration' },
                { id: 'created', label: 'Created' },
            ],
        },
    ],
};

export { batchTransformJobColumns, visibleColumns, visibleContentPreference };
