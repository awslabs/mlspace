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
import React, { useEffect, useState } from 'react';
import { Button, Table as CloudscapeTable, SpaceBetween } from '@cloudscape-design/components';
import {
    CollectionPreferences,
    Pagination,
    Header,
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { TableProps, EmptyState, paginationLabels } from '../table';
import Condition from '../condition';
import {
    PaginationLoadingState,
    ServerSidePaginator,
    createColumnAriaLabel,
    getMatchesCountText,
    setTableAnnouncement,
} from '../../shared/util/table-utils';
import _ from 'lodash';
import {
    getPageSizeForUser,
    selectCurrentUser,
    updateUser,
} from '../../entities/user/user.reducer';
import { useAppSelector } from '../../config/store';
import { useDispatch } from 'react-redux';
import { MLSTextFilter } from '../textfilter/textfilter';

export default function Table ({
    tableName,
    tableType,
    actions,
    selectItemsCallback,
    allItems,
    setItemsOverride,
    columnDefinitions,
    visibleColumns,
    visibleContentPreference,
    trackBy,
    itemNameProperty,
    empty,
    footer,
    variant,
    header,
    headerVariant,
    loadingItems,
    stickyHeader = false,
    showPreference = true,
    showCounter = true,
    showFilter = true,
    showPaging = true,
    loadingAction,
    loadingText = 'Loading resources',
    focusProps,
    focusFileUploadProps,
    serverFetch,
    serverRequestProps,
    storeClear,
    keepSelection = true,
}: TableProps) {
    const currentUser = useAppSelector(selectCurrentUser);
    const dispatch = useDispatch();
    const initialState = () => {
        return {
            pageSize: getPageSizeForUser(currentUser, tableName),
            visibleContent: visibleColumns,
        };
    };
    const [preferences, setPreferences] = useState(initialState);
    const emptyState = empty || EmptyState(`No ${tableName ? tableName : 'Entrie'}s exist`);
    const { items, filteredItemsCount, collectionProps, filterProps, paginationProps } =
        useCollection(allItems, {
            filtering: {
                empty: emptyState,
                noMatch: EmptyState('No matches found'),
            },
            pagination: { pageSize: preferences.pageSize },
            sorting: {},
            selection: {keepSelection},
        });

    const { selectedItems } = collectionProps;

    const [serverSideLoading, setServerSideLoading] = useState<PaginationLoadingState>({
        loadingEmpty: false,
        loadingAdditional: false,
        loadingInBackground: false
    });

    const tableHeaderVariant =
        headerVariant || (variant && ['embedded', 'stacked'].includes(variant) ? 'h2' : 'h1');

    // Announce non-server side paging table updates
    useEffect(() => {
        if (!loadingItems) {
            setTableAnnouncement(`${tableName} table items refreshed`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingItems]);
    // Announce server side paging table updates
    useEffect(() => {
        if (!serverSideLoading.loadingEmpty) {
            setTableAnnouncement(`${tableName} table items refreshed`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverSideLoading]);

    let tablePreferences;
    if (showPreference) {
        tablePreferences = (
            <CollectionPreferences
                title='Preferences'
                confirmLabel='Confirm'
                cancelLabel='Cancel'
                preferences={preferences}
                pageSizePreference={{
                    title: 'Select page size',
                    options: [
                        { value: 10, label: '10 resources' },
                        { value: 20, label: '20 resources' },
                        { value: 50, label: '50 resources' },
                    ],
                }}
                visibleContentPreference={visibleContentPreference}
                onConfirm={async ({ detail }) => {
                    setPreferences({
                        ...preferences,
                        visibleContent: detail.visibleContent,
                        pageSize: detail.pageSize
                    });

                    // Only save the preference if this is a named table
                    if (tableName) {
                        const updatedUser = _.set(_.cloneDeep(currentUser), `preferences.pageSize.${tableName}`, detail.pageSize);
                        dispatch(updateUser(updatedUser));
                    }
                }}
            />
        );
    }
    let pagination;
    if (!serverFetch && showPaging) {
        pagination = <Pagination {...paginationProps} ariaLabels={paginationLabels} />;
    } else if (serverFetch && storeClear) {
        pagination = (
            <ServerSidePaginator
                paginationProps={paginationProps}
                ariaLabels={paginationLabels}
                requestProps={serverRequestProps}
                fetchDataThunk={serverFetch}
                loading={serverSideLoading}
                setLoading={setServerSideLoading}
                storeClear={storeClear}
            />
        );
    }

    return (
        <CloudscapeTable
            data-cy={`${tableName}-table`}
            {...collectionProps}
            onSelectionChange={(event) => {
                selectItemsCallback?.(event.detail.selectedItems);
                collectionProps.onSelectionChange!(event);
            }}
            columnDefinitions={columnDefinitions.map((column) => ({
                ...column,
                ariaLabel: createColumnAriaLabel(column),
            }))}
            items={items}
            wrapLines
            loading={
                serverFetch
                    ? serverSideLoading.loadingAdditional || serverSideLoading.loadingEmpty
                    : loadingItems && serverSideLoading.loadingInBackground
            }
            loadingText={loadingText}
            selectionType={tableType}
            trackBy={trackBy ? trackBy : 'id'}
            visibleColumns={preferences.visibleContent}
            renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) => {
                return `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`;
            }}
            ariaLabels={{
                selectionGroupLabel: 'Items selection',
                allItemsSelectionLabel: ({ selectedItems }) =>
                    `${selectedItems.length} ${
                        selectedItems.length === 1 ? 'item' : 'items'
                    } selected`,
                itemSelectionLabel: (props, item) => {
                    return _.get(item, itemNameProperty || trackBy || 'name');
                },
                tableLabel: `${tableName ? tableName : 'Entries'} table`,
            }}
            header={
                header ? (
                    header
                ) : (
                    <Condition condition={tableName !== undefined}>
                        <Header
                            variant={tableHeaderVariant}
                            counter={
                                showCounter
                                    ? selectedItems?.length
                                        ? `(${selectedItems.length}/${allItems.length})`
                                        : `(${allItems.length})`
                                    : undefined
                            }
                            actions={
                                actions !== undefined && (
                                    <SpaceBetween direction='horizontal' size='xs'>
                                        {serverFetch && (
                                            <Button
                                                key='refreshButton'
                                                variant='normal'
                                                iconName='refresh'
                                                loading={serverSideLoading.loadingInBackground}
                                                disabled={
                                                    serverSideLoading.loadingEmpty ||
                                                    serverSideLoading.loadingAdditional
                                                }
                                                onClick={() =>
                                                    setServerSideLoading({
                                                        ...serverSideLoading,
                                                        loadingEmpty: true,
                                                    })
                                                }
                                                ariaLabel={'Refresh table contents'}
                                            />
                                        )}
                                        {actions({
                                            selectedItems,
                                            allItems,
                                            setItemsOverride,
                                            loadingAction,
                                            focusProps,
                                            focusFileUploadProps,
                                        })}
                                    </SpaceBetween>
                                )
                            }
                        >
                            {tableName}s
                        </Header>
                    </Condition>
                )
            }
            pagination={pagination}
            filter={
                showFilter ? (
                    <MLSTextFilter
                        {...filterProps}
                        countText={getMatchesCountText(filteredItemsCount || 0)}
                        filteringAriaLabel={`Filter ${tableName}`}
                        filteringClearAriaLabel={`Clear text for filtering ${tableName}`}
                    />
                ) : undefined
            }
            preferences={tablePreferences}
            footer={footer}
            variant={variant}
            stickyHeader={stickyHeader}
        />
    );
}
