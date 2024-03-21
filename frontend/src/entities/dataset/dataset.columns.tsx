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
import { Button, TableProps } from '@cloudscape-design/components';
import { IDataset } from '../../shared/model/dataset.model';
import { IDatasetFile } from '../../shared/model/datasetfile.model';
import { linkify } from '../../shared/util/table-utils';
import { convertBytesToHumanReadable } from './create/dataset-upload.utils';
import { showAccessLevel } from './dataset.utils';
import { getDownloadUrl } from './dataset.service';
import { Link } from '@cloudscape-design/components';

const defaultColumns: TableProps.ColumnDefinition<IDataset>[] = [
    {
        id: 'datasetName',
        header: 'Dataset name',
        sortingField: 'datasetName',
        cell: (item) => (
            <div data-cy={item.name}>{linkify('dataset', item.name!, item.scope!)}</div>
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
        cell: (item) => showAccessLevel(item),
    },
];

const defaultFileColumns: TableProps.ColumnDefinition<IDatasetFile>[] = [
    {
        id: 'fileName',
        header: 'Name',
        sortingField: 'Name',
        cell: (item) => {
            return (
                <div data-cy={item.key}>
                    <Link
                        variant='primary'
                        fontSize='body-m'
                        onFollow={async () => {
                            const downloadUrl = await getDownloadUrl(item.key!);
                            window.open(downloadUrl, '_blank');
                        }}
                    >
                        {item.key}
                    </Link>
                </div>
            );
        },
    },
    {
        id: 'fileSize',
        header: 'Size',
        sortingField: 'Size',
        cell: (item) => convertBytesToHumanReadable(+(item.file?.size || item.size!)),
    },
    {
        id: 'copyS3Url',
        sortingField: '',
        header: 'Copy S3 URI',
        cell: (item) => {
            return item.bucket ? (
                <Button
                    iconName='copy'
                    variant='icon'
                    onClick={() => navigator.clipboard.writeText(`s3://${item.bucket}/${item.key}`)}
                    ariaLabel={'Copy S3 URI'}
                />
            ) : (
                ''
            );
        },
    },
];

const visibleColumns: string[] = ['datasetName', 'description', 'accessLevel'];

const visibleFileColumns: string[] = ['fileName', 'fileSize', 'copyS3Url'];
const createDatasetVisibleColumns: string[] = ['fileName', 'fileSize'];

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

const visibleFileContentPreference = {
    title: 'Select visible file content',
    options: [
        {
            label: 'File properties',
            options: [
                { id: 'fileName', label: 'Name' },
                { id: 'fileSize', label: 'Size' },
                { id: 'copyS3Url', label: 'Copy S3 Url' },
            ],
        },
    ],
};

export {
    defaultColumns,
    createDatasetVisibleColumns,
    visibleColumns,
    visibleContentPreference,
    visibleFileContentPreference,
    visibleFileColumns,
    defaultFileColumns,
};
