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
import { prettyStatus } from '../../shared/util/table-utils';
import { linkify } from '../../shared/util/table-utils';
import { EMRResourceMetadata } from '../../shared/model/resource-metadata.model';

const defaultColumns: TableProps.ColumnDefinition<EMRResourceMetadata>[] = [
    {
        id: 'name',
        header: 'Name',
        cell: (item) => linkify('emr', item.metadata.Name, item.resourceId),
    },
    {
        id: 'id',
        header: 'Id',
        cell: (item) => item.resourceId,
    },
    {
        id: 'status',
        header: 'Status',
        cell: (item) => prettyStatus(item.metadata.State),
    },
    {
        id: 'created',
        header: 'Creation time',
        cell: (item) => formatDate(item.metadata.CreationTime),
    },
    { id: 'elapsed', header: 'Elapsed time', cell: () => '-' },
    {
        id: 'hours',
        header: 'Normalized instance hours',
        cell: (item) => item.metadata.NormalizedInstanceHours,
    },
];

const visibleContentPreference = {
    title: 'Select visible columns',
    options: [
        {
            label: 'Instance attributes',
            options: [
                { id: 'name', label: 'Name' },
                { id: 'id', label: 'Id' },
                { id: 'status', label: 'Job status' },
                { id: 'created', label: 'Creation time' },
                { id: 'elapsed', label: 'Elapsed time' },
                { id: 'hours', label: 'Normalized instance hours' },
            ],
        },
    ],
};

export { defaultColumns, visibleContentPreference };
