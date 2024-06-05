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
import { Box, BreadcrumbGroup, Header, Pagination, SpaceBetween, Table } from '@cloudscape-design/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DatasetContext, datasetFromS3Uri } from '../../shared/util/dataset-utils';
import { getDatasetsList } from '../../entities/dataset/dataset.reducer';
import { useAppDispatch } from '../../config/store';
import { useParams } from 'react-router-dom';
import { modeForDatasetContext as displayModeForDatasetContext, getSelectionType, prefixForPath, resourceForPath, tablePropertiesForDisplayMode } from './dataset-browser.utils';
import { breadcrumbFromDataset } from './dataset-browser.utils';
import { DatasetActionType, DatasetBrowserState, DatasetResource, datasetBrowserReducer, getDatasetContents } from './dataset-browser.reducer';
import Condition from '../condition';
import { DatasetBrowserDisplayMode, DatasetBrowserManageMode, UpdateDatasetContextFunction } from './dataset-browser.types';
import { DatasetType, IDataset } from '../../shared/model';
import { isFulfilled } from '@reduxjs/toolkit';
import { MLSTextFilter } from '../textfilter/textfilter';
import { upperFirst } from 'lodash';
import { getMatchesCountText } from '../../shared/util/table-utils';
import { EmptyState } from '../table';
import { DatasetBrowserProps } from './dataset-browser.types';
import NotificationService from '../../shared/layout/notification/notification.service';
import { useUsername } from '../../shared/util/auth-utils';
import '../../entities/dataset/dataset.scss';


export function DatasetBrowser (props: DatasetBrowserProps) {
    const username = useUsername();
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const { actions, resource, header, selectableItemsTypes = [], manageMode, onItemsChange, onSelectionChange } = props;
    const isSelectingObject = selectableItemsTypes.indexOf('objects') > -1;
    const isSelectingPrefix = selectableItemsTypes.indexOf('prefixes') > -1;
    const isCreating = manageMode === DatasetBrowserManageMode.Create;
    const newDataset = {type: DatasetType.PRIVATE, name: 'New Dataset'};
    const [state, setState] = React.useReducer(datasetBrowserReducer, {
        datasetContext: isCreating ? newDataset : datasetFromS3Uri(resource),
        items: [],
        selectedItems: [],
        manageMode,
        isLoading: false,
        nextToken: undefined,
        username: username!,
        projectName: projectName!,
        filteringText: '',
        pagination: {
            currentPageIndex: 1,
            pagesCount: 1,
            openEnd: false,
            disabled: false,
        }
    });
    const breadcrumbItems = useMemo(() => breadcrumbFromDataset(state.datasetContext, !!manageMode), [state.datasetContext, manageMode]);
    const displayMode = displayModeForDatasetContext(state.datasetContext);

    // memoize notification service so it doesn't cause infinite loops when used in react hooks for fetchDatasetResources & fetchDatasets
    const notificationService = useMemo(() => {
        return NotificationService(dispatch);
    }, [dispatch]);

    const fetchDatasetResources = useCallback((datasetContext: Partial<DatasetContext>, nextToken?: string, existingItems?: (DatasetResource | IDataset)[]) => {
        if (!isCreating) {
            return dispatch(getDatasetContents({datasetContext, projectName, username, nextToken})).then((response) => {
                if (isFulfilled(response)) {
                    // if nextToken is provided we're appending to existing items
                    const items = nextToken ? [...existingItems || []] : [];
        
                    const payload: Partial<DatasetBrowserState> = {
                        items: items.concat(response.payload.data.contents),
                        nextToken: response.payload.data.nextToken,
                        isLoading: false
                    };

                    // if existingItems isn't supplied when we're effectively changing view contexts so selectedItems should be cleared
                    if (!existingItems) {
                        payload.selectedItems = [];
                    }
        
                    setState({
                        type: DatasetActionType.State,
                        payload
                    });
                } else {
                    // if an error occurred reset the component to a safe state
                    notificationService.generateNotification(`Failed to fetch resources for ${datasetContext.name}`, 'error');
                    setState({
                        type: DatasetActionType.DatasetContext,
                        payload: undefined
                    });
                }
            });
        }

        setState({
            type: DatasetActionType.State,
            payload: {isLoading: false}
        });
    }, [dispatch, isCreating, notificationService, projectName, username]);

    const fetchDatasets = useCallback((type: DatasetType) => {
        dispatch(getDatasetsList({projectName})).then((response) => {
            if (isFulfilled(response)) {
                setState({
                    type: DatasetActionType.State,
                    payload: {
                        items: response.payload.data.filter((dataset) => dataset.type === type),
                        isLoading: false
                    }
                });
            } else {
                notificationService.generateNotification('Failed to fetch datasets', 'error');
                setState({
                    type: DatasetActionType.DatasetContext,
                    payload: undefined
                });
            }
        });
    }, [dispatch, notificationService, projectName]);

    const updateDatasetContext: UpdateDatasetContextFunction = useCallback((datasetContext: Partial<DatasetContext>, filteringText: string, keepContext: boolean, keepItems = false) => {
        const filteringTextPrefix = prefixForPath(filteringText);
        const filteringTextDisplayPrefix = prefixForPath(state.filteringText);
        const shouldFetch = !keepContext || filteringTextPrefix !== filteringTextDisplayPrefix;
        const displayMode = displayModeForDatasetContext(datasetContext);

        const payload: Partial<DatasetBrowserState> = {
            datasetContext: keepContext ? state.datasetContext : datasetContext,
            selectedItems: [],
            isLoading: false,
            filteringText
        };

        if (!isCreating) {
            switch (displayMode) {
                case DatasetBrowserDisplayMode.Resource:
                    if (shouldFetch && datasetContext) {
                        payload.isLoading = true;
                        if (keepItems) {
                            fetchDatasetResources(datasetContext, state.nextToken, state.items);
                        } else {
                            fetchDatasetResources(datasetContext);
                        }
                    }
                    break;
                case DatasetBrowserDisplayMode.Dataset:
                    if (shouldFetch && datasetContext.type) {
                        payload.isLoading = true;
                        fetchDatasets(datasetContext.type);
                    }
                    break;
                default:
                    payload.items = Object.keys(DatasetType).map((key) => ({ name: upperFirst(DatasetType[key]), type: DatasetType[key] }));
            }
        }

        setState({
            type: DatasetActionType.State,
            payload
        });
    }, [fetchDatasetResources, fetchDatasets, isCreating, state.datasetContext, state.filteringText, state.items, state.nextToken]);

    const [firstLoad, setFirstLoad] = useState(true);
    useEffect(() => {
        if (firstLoad) {
            setFirstLoad(false);
            updateDatasetContext(state.datasetContext || {}, '', false);
        }
    }, [firstLoad, state.datasetContext, updateDatasetContext]);

    const filteredItems = useMemo(() => state.items.filter((item) => {
        return !!item.name?.includes(isCreating ? state.filteringText : resourceForPath(state.filteringText));
    }), [state.items, state.filteringText, isCreating]);

    const pageSize = 10;
    const pagesCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    if (state.pagination.currentPageIndex > pagesCount) {
        setState({
            type: DatasetActionType.Pagination,
            payload: { currentPageIndex: pagesCount }
        });
    }

    useEffect(() => {
        onItemsChange?.(new CustomEvent('itemsChange', {detail: {items: state.items}}));
    }, [state.items, onItemsChange]);

    useEffect(() => {
        onSelectionChange?.(new CustomEvent('selectionChange', {cancelable: false, detail: { selectedItems: state.selectedItems}}));
    }, [onSelectionChange, state.selectedItems]);

    // create the appropriate table properties for the current viewing context (scopes, listing datasets, listing a dataset resources)
    const displayModeTableProperties = tablePropertiesForDisplayMode(displayMode, state, updateDatasetContext);

    return (
        <Box>
            <SpaceBetween direction='vertical' size='s'>
                <Condition condition={header !== undefined}>
                    { header }
                </Condition>

                <Condition condition={manageMode ? [DatasetBrowserManageMode.Create, DatasetBrowserManageMode.Edit].includes(manageMode) : false}>
                    <div className='drop-box'>
                        <Box textAlign='center'>
                            Drag and drop files and folders you want to upload here, or choose Upload Files or Upload Folder.
                        </Box>
                    </div>
                </Condition>

                <Condition condition={manageMode !== DatasetBrowserManageMode.Create}>
                    <BreadcrumbGroup items={breadcrumbItems} onClick={(event) => {
                        event.preventDefault();
                        updateDatasetContext(event.detail.href.length > 0 ? JSON.parse(event.detail.href) : undefined, '', false);
                    }} />
                </Condition>

                <Table
                    // add common properties shared by every display mode
                    header={<Header actions={actions?.({
                        items: state.items,
                        manageMode: manageMode,
                        selectedItems: state.selectedItems,
                        datasetContext: state.datasetContext,
                        filteringText: state.filteringText,
                    }, setState, updateDatasetContext)} counter={
                        state.selectedItems?.length > 0
                            ? `(${state.selectedItems.length}/${state.items.length})`
                            : `(${state.items.length})`
                    }>{displayMode}s</Header>}
                    empty={isCreating ? EmptyState('No files uploaded') : EmptyState('No Entries exist')}
                    filter={
                        <MLSTextFilter
                            filteringText={state.filteringText}
                            requireEnter={true}
                            countText={getMatchesCountText(filteredItems.length)}
                            onChange={({detail: {filteringText}}) => {
                                if (state.datasetContext) {
                                    // if this is creating a new dataset there can't be fetching from the sever
                                    if (isCreating) {
                                        return updateDatasetContext(state.datasetContext, filteringText, true);
                                    }

                                    const effectiveContext = {...state.datasetContext};
                                    const filteringTextPrefix = prefixForPath(filteringText);
                                    const filteringTextDisplayPrefix = prefixForPath(state.filteringText);

                                    // if the prefixes don't match update the location that we should display
                                    if (filteringTextPrefix !== filteringTextDisplayPrefix) {
                                        effectiveContext.location = [state.datasetContext.location, filteringTextPrefix].join('');
                                    }

                                    updateDatasetContext(effectiveContext, filteringText, true);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.detail.key.match(/[^\w!-.*'()/]/)) {
                                    event.preventDefault();
                                }
                            }}
                        />
                    }
                    isItemDisabled={(item) => {
                        switch (displayMode) {
                            case DatasetBrowserDisplayMode.Resource:
                                return (item.type === 'prefix' && !isSelectingPrefix) || (item.type === 'object' && !isSelectingObject);
                            case DatasetBrowserDisplayMode.Dataset:
                                return !isSelectingPrefix;
                            case DatasetBrowserDisplayMode.Scope:
                                return true;
                        }
                    }}
                    items={filteredItems.slice((state.pagination.currentPageIndex - 1) * pageSize, (state.pagination.currentPageIndex) * pageSize)}
                    loading={state.isLoading}
                    loadingText={`Loading ${displayMode}s`}
                    onSelectionChange={(event) => {
                        setState({
                            type: DatasetActionType.State,
                            payload: {
                                selectedItems: event.detail.selectedItems
                            }
                        });
                    }}
                    pagination={
                        <Pagination
                            {...state.pagination}
                            pagesCount={pagesCount}
                            openEnd={!!state.nextToken}
                            onChange={(event) => {
                                setState({
                                    type: DatasetActionType.State,
                                    payload: {
                                        pagination: {
                                            ...state.pagination,
                                            currentPageIndex: event.detail.currentPageIndex
                                        }
                                    }
                                });
                            }}
                            onNextPageClick={({detail}) => {
                                if (!detail.requestedPageAvailable && state.datasetContext) {
                                    const effectiveContext = {...state.datasetContext, location: [state.datasetContext.location, prefixForPath(state.filteringText)].join('')};
                                    fetchDatasetResources(effectiveContext, state.nextToken, state.items);
                                }
                            }}
                        />
                    }
                    selectionType={getSelectionType(manageMode, selectableItemsTypes)}
                    selectedItems={state.selectedItems}
                    variant={'borderless'}

                    // add display mode specific properties
                    {...displayModeTableProperties}

                    // merge in additional column definitions
                    columnDefinitions={[...displayModeTableProperties.columnDefinitions, ...props.columnDefinitions || []]}
                ></Table>
            </SpaceBetween>
        </Box>
    );
}

export default DatasetBrowser;
