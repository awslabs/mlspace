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
import { BatchTranslateResourceMetadata } from '../../shared/model/resource-metadata.model';

const defaultColumns: TableProps.ColumnDefinition<BatchTranslateResourceMetadata>[] = [
    {
        id: 'batchJobName',
        header: 'Job name',
        sortingComparator: sortStringValue('metadata.JobName'),
        cell: (item) =>
            linkify('batch-translate', item.resourceId, undefined, item.metadata.JobName),
    },
    {
        id: 'batchJobSourceLanguage',
        header: 'Source language',
        sortingComparator: sortStringValue('metadata.SourceLanguageCode'),
        cell: (item) => item.metadata.SourceLanguageCode,
    },
    {
        id: 'batchJobTargetLanguages',
        header: 'Target languages',
        cell: (item) => item.metadata.TargetLanguageCodes.join(', '),
    },
    {
        id: 'batchJobStartTime',
        header: 'Started',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.SubmittedTime) - Date.parse(b.metadata.SubmittedTime),
        cell: (item) => formatDate(item.metadata.SubmittedTime),
    },
    {
        id: 'batchJobStatus',
        header: 'Status',
        sortingComparator: sortStringValue('metadata.JobStatus'),
        cell: (item) => prettyStatus(item.metadata.JobStatus),
    },
];

const visibleColumns: string[] = [
    'batchJobName',
    'batchJobSourceLanguage',
    'batchJobTargetLanguages',
    'batchJobStartTime',
    'batchJobStatus',
];

const visibleContentPreference = {
    title: 'Select visible Batch Translate content',
    options: [
        {
            label: 'Batch Translate properties',
            options: [
                { id: 'batchJobName', label: 'Name' },
                { id: 'batchJobSourceLanguage', label: 'Source language' },
                { id: 'batchJobTargetLanguages', label: 'Target languages' },
                { id: 'batchJobStartTime', label: 'Started' },
                { id: 'batchJobStatus', label: 'Status' },
            ],
        },
    ],
};

export { defaultColumns, visibleColumns, visibleContentPreference };
