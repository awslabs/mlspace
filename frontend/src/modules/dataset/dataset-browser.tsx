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
import React, { useCallback, useEffect, useMemo } from 'react';
import { DatasetContext, datasetFromS3Uri } from '../../shared/util/dataset-utils';
import { getDatasetsList } from '../../entities/dataset/dataset.reducer';
import { useAppDispatch } from '../../config/store';
import { useParams } from 'react-router-dom';
import { modeForDatasetContext as displayModeForDatasetContext, getSelectionType, prefixForPath, resourceForPath, tablePropertiesForDisplayMode } from './dataset-browser.utils';
import { breadcrumbFromDataset } from './dataset-browser.utils';
import { DatasetActionType, DatasetBrowserState, DatasetResource, datasetBrowserReducer, getDatasetContents } from './dataset-browser.reducer';
import Condition from '../condition';
import { DatasetBrowserDisplayMode, DatasetBrowserManageMode } from './dataset-browser.types';
import { DatasetType, IDataset } from '../../shared/model';
import { isFulfilled } from '@reduxjs/toolkit';
import { MLSTextFilter } from '../textfilter/textfilter';
import { upperFirst } from 'lodash';
import { getMatchesCountText } from '../../shared/util/table-utils';
import { EmptyState } from '../table';
import { DatasetBrowserProps } from './dataset-browser.types';
import NotificationService from '../../shared/layout/notification/notification.service';
import { useUsername } from '../../shared/util/auth-utils';

export function DatasetBrowser (props: DatasetBrowserProps) {
    const username = useUsername();
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const { actions, resource, header, selectableItemsTypes = [], manageMode, onItemsChange } = props;
    const isSelectingObject = selectableItemsTypes.indexOf('objects') > -1;
    const isSelectingPrefix = selectableItemsTypes.indexOf('prefixes') > -1;
    const [state, setState] = React.useReducer(datasetBrowserReducer, {
        datasetContext: undefined,
        breadcrumbs: [],
        items: [],
        selectedItems: [],
        manageMode,
        isLoading: false,
        nextToken: undefined,
        username: username!,
        projectName: projectName!,
        filter: {
            filteringText: '',
            filteredItems: []
        },
        pagination: {
            currentPageIndex: 1,
            pagesCount: 1,
            openEnd: false,
            disabled: false,
        },
        refresh: false
    });

    const displayMode = displayModeForDatasetContext(state.datasetContext);
    const isCreating = state.manageMode === DatasetBrowserManageMode.Create;

    // memoize notification service so it doesn't cause infinite loops when used in react hooks for fetchDatasetResources & fetchDatasets
    const notificationService = useMemo(() => {
        return NotificationService(dispatch);
    }, [dispatch]);

    const fetchDatasetResources = useCallback((datasetContext: Partial<DatasetContext>, nextToken?: string, existingItems?: (DatasetResource | IDataset)[]) => {
        if (state.manageMode !== DatasetBrowserManageMode.Create) {
            return dispatch(getDatasetContents({datasetContext, projectName, username, nextToken})).then((response) => {
                if (isFulfilled(response)) {
                    // if nextToken is provided we're appending to existing items
                    const items = nextToken ? [...existingItems || []] : [];
        
                    const payload: Partial<DatasetBrowserState> = {
                        items: items.concat(response.payload.data.contents),
                        nextToken: response.payload.data.nextToken,
                        isLoading: false
                    };
        
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
    }, [state.manageMode, dispatch, projectName, username, notificationService]);

    const fetchDatasets = useMemo(() => () => {
        dispatch(getDatasetsList(projectName)).then((response) => {
            if (isFulfilled(response)) {
                setState({
                    type: DatasetActionType.State,
                    payload: {
                        items: response.payload.data.filter((dataset) => dataset.type === state.datasetContext?.type),
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
    }, [dispatch, projectName, state.datasetContext?.type, notificationService]);

    // The resource is expected to be empty on most first loads, but if it is an S3 URI try and create the datasetContext
    // based on that URI.
    useEffect(() => {
        const datasetContext = datasetFromS3Uri(resource);
        const payload: Partial<Pick<DatasetBrowserState, 'datasetContext' | 'filter' | 'items'>> = {
            datasetContext,
            items: []
        };

        if (state.manageMode === DatasetBrowserManageMode.Create) {
            payload.datasetContext = {type: DatasetType.PRIVATE, name: 'NoName'};
        }

        setState({
            type: DatasetActionType.State,
            payload
        });
    }, [resource, state.manageMode]);

    // Update the component if the datasetContext changes. This is expected to occur whenever the browser is going to display
    // a different scope, dataset, or prefix.
    useEffect(() => {
        const payload: Partial<DatasetBrowserState> = {
            breadcrumbs: breadcrumbFromDataset(state.datasetContext, !!state.manageMode),
            selectedItems: [],
            isLoading: true
        };

        if (state.manageMode === DatasetBrowserManageMode.Create) {
            payload.isLoading = false;
        } else {
            switch (displayMode) {
                case DatasetBrowserDisplayMode.Resource:
                    // DatasetBrowser invariant requires state.datasetContext can never be undefined with this displayMode
                    if (state.datasetContext) {
                        fetchDatasetResources(state.datasetContext);
                    }
                    break;
                case DatasetBrowserDisplayMode.Dataset:
                    fetchDatasets();
                    break;
                default:
                    payload.items = Object.keys(DatasetType).map((key) => ({ name: upperFirst(DatasetType[key]), type: DatasetType[key] }));
                    payload.isLoading = false;
            }
        }

        setState({
            type: DatasetActionType.State,
            payload
        });
    }, [state.datasetContext, state.manageMode, fetchDatasetResources, fetchDatasets, displayMode, state.refresh]);

    const pageSize = 10;
    // recalculate pages if filteredItems or pageSize changes
    useEffect(() => {
        setState({
            type: DatasetActionType.Pagination,
            payload: {
                pagesCount: Math.max(1, Math.ceil(state.filter.filteredItems.length / pageSize)),
            }
        });
    }, [state.filter.filteredItems, pageSize]);

    // if pagination changes make sure currentPageIndex isn't greater than pageCount
    useEffect(() => {
        if (state.pagination.currentPageIndex > state.pagination.pagesCount) {
            setState({
                type: DatasetActionType.Pagination,
                payload: { currentPageIndex: state.pagination.pagesCount }
            });
        }
    }, [state.pagination]);

    // if items or filteringText changes recompute filteredItems
    useEffect(() => {
        setState({
            type: DatasetActionType.Filter,
            payload: {
                filteringText: state.filter.filteringText,
                filteredItems: state.items.filter((item) => {
                    return !!item.name?.includes(resourceForPath(state.filter.filteringText));
                })
            }
        });
    }, [state.items, state.filter.filteringText]);

    useEffect(() => {
        onItemsChange?.(new CustomEvent('itemsChange', {detail: {items: state.items}}));
    }, [state.items, onItemsChange]);

    // create the appropriate table properties for the current viewing context (scopes, listing datasets, listing a dataset resources)
    const displayModeTableProperties = tablePropertiesForDisplayMode(displayMode, state, setState);

    console.log('outer filtering text', state.filter.filteringText);

    return (
        <Box>
            <SpaceBetween direction='vertical' size='s'>
                <Condition condition={header !== undefined}>
                    { header }
                </Condition>
                
                <Condition condition={state.manageMode !== DatasetBrowserManageMode.Create}>
                    <BreadcrumbGroup items={state.breadcrumbs} onClick={(event) => {
                        event.preventDefault();
                        
                        setState({
                            type: DatasetActionType.DatasetContext,
                            payload: event.detail.href.length > 0 ? JSON.parse(event.detail.href) : undefined
                        });
                    }} />
                </Condition>

                <Table
                    // add common properties shared by every display mode
                    header={<Header actions={actions?.({
                        items: state.items,
                        manageMode: state.manageMode,
                        selectedItems: state.selectedItems,
                        datasetContext: state.datasetContext,
                        filter: state.filter,
                    }, setState)} counter={
                        state.selectedItems?.length > 0
                            ? `(${state.selectedItems.length}/${state.items.length})`
                            : `(${state.items.length})`
                    }>{displayMode}s</Header>}
                    empty={state.manageMode === DatasetBrowserManageMode.Create ? EmptyState('No files uploaded') : EmptyState('No Entries exist')}
                    filter={
                        <MLSTextFilter
                            filteringText={state.filter.filteringText}
                            requireEnter={true}
                            countText={getMatchesCountText(state.filter.filteredItems.length)}
                            onChange={({detail: {filteringText}}) => {
                                // if creating a dataset there is no fetching from the server so just update the filter text and bail out early
                                if (isCreating) {
                                    return setState({
                                        type: DatasetActionType.State,
                                        payload: {
                                            isLoading: false,
                                            filter: {
                                                ...state.filter,
                                                filteringText: filteringText,
                                            }
                                        }
                                    });
                                }

                                const filteringTextPrefix = prefixForPath(filteringText);
                                const filteringTextDisplayPrefix = prefixForPath(state.filter.filteringText);
                                const shouldFetch = filteringTextPrefix !== filteringTextDisplayPrefix;

                                if (state.datasetContext) {
                                    console.log('filterText', filteringText);
                                    const payload: Partial<DatasetBrowserState> = {
                                        isLoading: shouldFetch,
                                        selectedItems: shouldFetch ? [] : state.selectedItems,
                                        filter: {
                                            ...state.filter,
                                            filteringText
                                        }
                                    };

                                    setState({
                                        type: DatasetActionType.State,
                                        payload
                                    });

                                    if (shouldFetch) {
                                        // if the filter contains a prefix append that to the Location
                                        const effectiveContext = {...state.datasetContext, location: [state.datasetContext.location, filteringTextPrefix].join('')};
                                        fetchDatasetResources(effectiveContext);
                                    }
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
                    items={state.filter.filteredItems.slice((state.pagination.currentPageIndex - 1) * pageSize, (state.pagination.currentPageIndex) * pageSize)}
                    loading={state.isLoading}
                    loadingText={`Loading ${displayMode}s`}
                    onSelectionChange={(event) => {
                        setState({
                            type: DatasetActionType.State,
                            payload: {
                                selectedItems: event.detail.selectedItems
                            }
                        });

                        props.onSelectionChange?.(event);
                    }}
                    pagination={
                        <Pagination
                            {...state.pagination}
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
                                    const filteringTextPrefix = prefixForPath(state.filter.filteringText);
                                    // if the filter contains a prefix append that to the Location
                                    const effectiveContext = {...state.datasetContext, location: [state.datasetContext.location, filteringTextPrefix].join('')};
                                    fetchDatasetResources(effectiveContext, state.nextToken, state.items);
                                }
                            }}
                        />
                    }
                    selectionType={getSelectionType(state.manageMode, selectableItemsTypes)}
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
