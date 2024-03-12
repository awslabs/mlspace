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
import { Link, TableProps } from '@cloudscape-design/components';
import { formatDate, formatDateDiff } from '../../../shared/util/date-utils';
import { prettyStatus, sortStringValue } from '../../../shared/util/table-utils';
import { HPOJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

const defaultColumns: TableProps.ColumnDefinition<HPOJobResourceMetadata>[] = [
    {
        id: 'name',
        header: 'Name',
        sortingField: 'resourceId',
        cell: (item) => (
            <Link href={`${window.location}/detail/${item.resourceId}`}>{item.resourceId}</Link>
        ),
    },
    {
        id: 'status',
        header: 'Job status',
        sortingComparator: sortStringValue('metadata.HyperParameterTuningJobStatus'),
        cell: (item) => prettyStatus(item.metadata.HyperParameterTuningJobStatus, undefined, true),
    },
    {
        id: 'completed',
        header: 'Training completed/total',
        cell: (item) =>
            !item.metadata.TrainingJobStatusCounters
                ? '-'
                : `${item.metadata.TrainingJobStatusCounters.Completed} / ${
                    item.metadata.TrainingJobStatusCounters.Completed +
                      item.metadata.TrainingJobStatusCounters.Stopped +
                      item.metadata.TrainingJobStatusCounters.InProgress +
                      item.metadata.TrainingJobStatusCounters.NonRetryableError +
                      item.metadata.TrainingJobStatusCounters.RetryableError
                }`,
    },
    {
        id: 'created',
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
        id: 'strategy',
        header: 'Strategy',
        sortingComparator: sortStringValue('metadata.Strategy'),
        cell: (item) => item.metadata.Strategy,
    },
    {
        id: 'duration',
        header: 'Duration',
        cell: (item) =>
            formatDateDiff(
                item.metadata.CreationTime,
                item.metadata.HyperParameterTuningEndTime || item.metadata.LastModifiedTime
            ),
    },
];

const visibleContentPreference = {
    title: 'Select visible columns',
    options: [
        {
            label: 'Instance attributes',
            options: [
                { id: 'name', label: 'Name' },
                { id: 'status', label: 'Job status' },
                { id: 'completed', label: 'Training completed/total' },
                { id: 'created', label: 'Creation time' },
                { id: 'modified', label: 'Last updated' },
                { id: 'strategy', label: 'Strategy' },
                { id: 'duration', label: 'Duration' },
            ],
        },
    ],
};

export { defaultColumns, visibleContentPreference };
