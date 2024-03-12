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
import { IProductionVariant } from '../../shared/model/endpoint-config.model';
import { formatDate } from '../../shared/util/date-utils';
import { linkify, sortStringValue } from '../../shared/util/table-utils';
import { EndpointConfigResourceMetadata } from '../../shared/model/resource-metadata.model';

type ProductionVariantColumnOptions = {
    canEdit?: boolean;
    tableItemAction?(action: string, key: string): any;
};

const defaultColumns: TableProps.ColumnDefinition<EndpointConfigResourceMetadata>[] = [
    {
        id: 'endpointConfigName',
        header: 'Endpoint config name',
        sortingField: 'resourceId',
        cell: (item) => linkify('endpoint-config', item.resourceId),
    },
    {
        id: 'endpointConfigArn',
        header: 'ARN',
        sortingComparator: sortStringValue('metadata.EndpointConfigArn'),
        cell: (item) => item.metadata.EndpointConfigArn,
    },
    {
        id: 'creationTime',
        header: 'Creation time',
        sortingComparator: (a, b) =>
            Date.parse(a.metadata.CreationTime) - Date.parse(b.metadata.CreationTime),
        cell: (item) => formatDate(item.metadata.CreationTime),
    },
];

const productionVariantColumns = ({
    canEdit,
    tableItemAction,
}: ProductionVariantColumnOptions): TableProps.ColumnDefinition<IProductionVariant>[] => {
    const columns = [
        {
            id: 'modelName',
            header: 'Model name',
            sortingField: 'modelName',
            cell: (item: IProductionVariant) => linkify('model', item.ModelName!),
        },
        { id: 'trainingJob', header: 'Training job', sortingField: 'trainingJob', cell: () => '-' },
        {
            id: 'variantName',
            header: 'Variant name',
            sortingField: 'variantName',
            cell: (item: IProductionVariant) => item.VariantName,
        },
        {
            id: 'instanceType',
            header: 'Instance type',
            sortingField: 'instanceType',
            cell: (item: IProductionVariant) => item.InstanceType!,
        },
        {
            id: 'elasticInference',
            header: 'Elastic inference',
            sortingField: 'elasticInference',
            cell: (item: IProductionVariant) => item.AcceleratorType || '-',
        },
        {
            id: 'initialInstanceCount',
            header: 'Initial instance count',
            sortingField: 'initialInstanceCount',
            cell: (item: IProductionVariant) => item.InitialInstanceCount!.toString(),
        },
        {
            id: 'initialWeight',
            header: 'Initial weight',
            sortingField: 'initialWeight',
            cell: (item: IProductionVariant) => item.InitialVariantWeight!.toString(),
        },
    ];

    if (canEdit && tableItemAction) {
        columns.push({
            id: 'editActions',
            header: 'Actions',
            sortingField: 'editActions',
            cell: (item) => {
                return (
                    <div>
                        <Button
                            variant='link'
                            onClick={() => {
                                tableItemAction('edit', item.VariantName);
                            }}
                        >
                            Edit
                        </Button>{' '}
                        |{' '}
                        <Button
                            variant='link'
                            onClick={() => {
                                tableItemAction('remove', item.VariantName);
                            }}
                        >
                            Remove
                        </Button>
                    </div>
                );
            },
        });
    }
    return columns;
};

const visibleColumns: string[] = ['endpointConfigName', 'endpointConfigArn', 'creationTime'];

const visibleContentPreference = {
    title: 'Select visible Endpoint Config content',
    options: [
        {
            label: 'Endpoint Config properties',
            options: [
                { id: 'endpointConfigName', label: 'Endpoint config name' },
                { id: 'endpointConfigArn', label: 'ARN' },
                { id: 'creationTime', label: 'Creation time' },
            ],
        },
    ],
};

export type { ProductionVariantColumnOptions };
export { defaultColumns, productionVariantColumns, visibleColumns, visibleContentPreference };
