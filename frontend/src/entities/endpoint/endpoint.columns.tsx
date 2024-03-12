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
import { linkify, prettyStatus, sortStringValue } from '../../shared/util/table-utils';
import { EndpointResourceMetadata } from '../../shared/model/resource-metadata.model';

const defaultColumns: TableProps.ColumnDefinition<EndpointResourceMetadata>[] = [
    {
        id: 'endpointName',
        header: 'Name',
        sortingField: 'resourceId',
        cell: (item) => linkify('endpoint', item.resourceId),
    },
    {
        id: 'endpointArn',
        header: 'ARN',
        sortingComparator: sortStringValue('metadata.EndpointArn'),
        cell: (item) => item.metadata.EndpointArn,
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
        sortingComparator: sortStringValue('metadata.EndpointStatus'),
        minWidth: 140,
        cell: (item) => prettyStatus(item.metadata.EndpointStatus, item.metadata.FailureReason),
    },
    {
        id: 'lastUpdated',
        header: 'Last updated',
        sortingField: 'lastUpdated',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.LastModifiedTime) - Date.parse(b.metadata.LastModifiedTime),
        cell: (item) => formatDate(item.metadata.LastModifiedTime),
    },
];

const visibleColumns: string[] = [
    'endpointName',
    'endpointArn',
    'creationTime',
    'status',
    'lastUpdated',
];

const visibleContentPreference = {
    title: 'Select visible Endpoint content',
    options: [
        {
            label: 'Endpoint properties',
            options: [
                { id: 'endpointName', label: 'Name' },
                { id: 'endpointArn', label: 'ARN' },
                { id: 'creationTime', label: 'Creation time' },
                { id: 'status', label: 'Status' },
                { id: 'lastUpdated', label: 'Last updated' },
            ],
        },
    ],
};

export { defaultColumns, visibleColumns, visibleContentPreference };
