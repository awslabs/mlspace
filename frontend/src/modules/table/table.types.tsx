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

import {
    CollectionPreferencesProps,
    TableProps as CloudscapeTableProps,
    HeaderProps as CloudscapeHeaderProps,
    Box,
} from '@cloudscape-design/components';
import React, { ReactNode } from 'react';
import { CallbackFunction } from '../../types';
import { ServerRequestProps } from '../../shared/util/table-utils';
import { ActionCreatorWithoutPayload, AsyncThunk } from '@reduxjs/toolkit';

type TableProps = {
    tableName?: string;
    tableType?: CloudscapeTableProps.SelectionType;
    actions?: any;
    selectItemsCallback?: CallbackFunction;
    allItems: TableEntry[];
    setItemsOverride?: CallbackFunction;
    columnDefinitions: CloudscapeTableProps.ColumnDefinition<TableEntry>[];
    visibleColumns?: readonly string[];
    visibleContentPreference?: CollectionPreferencesProps.VisibleContentPreference;
    // Unique property of table items that can be used for tracking purposes ie arn
    trackBy?: string;
    // User friendly property of table items that will be used in selection aria labels
    itemNameProperty?: string;
    empty?: ReactNode;
    header?: ReactNode;
    headerVariant?: CloudscapeHeaderProps.Variant;
    footer?: ReactNode;
    variant?: CloudscapeTableProps.Variant;
    showPreference?: boolean;
    showCounter?: boolean;
    showFilter?: boolean;
    showPaging?: boolean;
    loadingItems?: boolean;
    loadingAction?: boolean;
    pageSize?: number;
    stickyHeader?: boolean;
    loadingText?: string;
    focusProps?: any;
    focusFileUploadProps?: any;
    serverRequestProps?: ServerRequestProps;
    serverFetch?: AsyncThunk<any, ServerRequestProps, any>;
    storeClear?: ActionCreatorWithoutPayload;
};

type TableEntry = any;

function EmptyState (title: string) {
    return (
        <Box textAlign='center' color='inherit'>
            <Box variant='strong' textAlign='center' color='inherit'>
                {title}
            </Box>
        </Box>
    );
}

export type { TableEntry, TableProps };

export { EmptyState };
