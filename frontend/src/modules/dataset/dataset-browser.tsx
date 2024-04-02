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
import React, { useEffect, useMemo } from 'react';
import { DatasetContext, datasetFromS3Uri } from '../../shared/util/dataset-utils';
import { getDatasetsList } from '../../entities/dataset/dataset.reducer';
import { useAppDispatch } from '../../config/store';
import { useParams } from 'react-router-dom';
import { modeForDatasetContext as displayModeForDatasetContext, prefixForPath, resourceForPath, tablePropertiesForDisplayMode } from './dataset-browser.utils';
import { breadcrumbFromDataset } from './dataset-browser.utils';
import { DatasetActionType, DatasetBrowserState, DatasetResource, datasetBrowserReducer, getDatasetContents } from './dataset-browser.reducer';
import { useAuth } from 'react-oidc-context';
import Condition from '../condition';
import { DatasetBrowserDisplayMode } from './dataset-browser.types';
import { DatasetType, IDataset } from '../../shared/model';
import { isFulfilled } from '@reduxjs/toolkit';
import { MLTextFilter } from '../textfilter/textfilter';
import { upperFirst } from 'lodash';
import { getMatchesCountText } from '../../shared/util/table-utils';
import { EmptyState } from '../table';
import { DatasetBrowserProps } from './dataset-browser.types';
import NotificationService from '../../shared/layout/notification/notification.service';
import { getUsername } from '../../shared/util/auth-utils';

export function DatasetBrowser (props: DatasetBrowserProps) {
    const username = getUsername(useAuth());
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const { resource, isPinned = false, header, selectableItemsTypes = [] } = props;
    const isSelectingObject = selectableItemsTypes.indexOf('objects') > -1;
    const isSelectingPrefix = selectableItemsTypes.indexOf('prefixes') > -1;
    const [state, setState] = React.useReducer(datasetBrowserReducer, {
        datasetContext: undefined,
        breadcrumbs: [],
        items: [],
        isLoading: false,
        isPinned,
        nextToken: undefined,
        username: username!,
        projectName: projectName!,
        filter: {
            filteringText: '',
            filteringTextDisplay: '',
            filteredItems: []
        },
        pagination: {
            currentPageIndex: 1,
            pagesCount: 1,
            openEnd: false,
            disabled: false,
        },
    });
    const [selectedItems, setSelectedItems] = React.useState<any[]>([]);
    const displayMode = displayModeForDatasetContext(state.datasetContext);

    // memoize notification service so it doesn't cause infinite loops for fetchDatasetResources & fetchDatasets
    const notificationService = useMemo(() => {
        return NotificationService(dispatch);
    }, [dispatch]);

    const fetchDatasetResources = useMemo(() => (datasetContext: DatasetContext, nextToken?: string, existingItems?: (DatasetResource | IDataset)[]) => dispatch(getDatasetContents({datasetContext, projectName, username, nextToken})).then((response) => {
        if (isFulfilled(response)) {
            // if nextToken is provided we're appending to existing items
            const items = nextToken ? [...existingItems || []] : [];

            const payload: Partial<Pick<DatasetBrowserState, 'items' | 'nextToken' | 'datasetContext' | 'filter' | 'isLoading'>> = {
                items: items.concat(response.payload.data.contents),
                nextToken: response.payload.data.nextToken,
                isLoading: false
            };

            // if the dataset context location is for a resource update the filter too
            const resourceStringForPath = resourceForPath(datasetContext.Location);
            if (resourceStringForPath) {
                payload.filter = {
                    filteredItems: [],
                    filteringTextDisplay: resourceStringForPath,
                    filteringText: resourceStringForPath
                };
            }

            setState({
                type: DatasetActionType.State,
                payload
            });
        } else {
            // if an error occurred reset the component to a safe state
            notificationService.generateNotification(`Failed to fetch resources for ${datasetContext.Name}`, 'error');
            setState({
                type: DatasetActionType.DatasetContext,
                payload: undefined
            });
        }
    }), [dispatch, projectName, username, notificationService]);

    const fetchDatasets = useMemo(() => () => {
        dispatch(getDatasetsList(projectName)).then((response) => {
            if (isFulfilled(response)) {
                setState({
                    type: DatasetActionType.State,
                    payload: {
                        items: response.payload.data.filter((dataset) => dataset.type === state.datasetContext?.Type),
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
    }, [dispatch, projectName, state.datasetContext?.Type, notificationService]);


    // refresh component if resource changes
    useEffect(() => {
        const datasetContext = datasetFromS3Uri(resource);
        const payload: Partial<Pick<DatasetBrowserState, 'datasetContext' | 'filter' | 'items'>> = {
            datasetContext,
            items: []
        };

        setState({
            type: DatasetActionType.State,
            payload
        });
    }, [resource]);

    // update the component if the datasetContext changes
    useEffect(() => {
        const payload: Partial<DatasetBrowserState> = {
            breadcrumbs: breadcrumbFromDataset(state.datasetContext, isPinned),
            isLoading: true
        };

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

        setState({
            type: DatasetActionType.State,
            payload
        });
    }, [state.datasetContext, isPinned, fetchDatasetResources, fetchDatasets, displayMode]);

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


    // create the appropriate table properties for the current viewing context (scopes, listing datasets, listing a dataset resources)
    const displayModeTableProperties = tablePropertiesForDisplayMode(displayMode, state, setState);

    // if items or filteringText changes recompute filteredItems
    useEffect(() => {
        setState({
            type: DatasetActionType.Filter,
            payload: {
                filteringText: state.filter.filteringText,
                filteringTextDisplay: state.filter.filteringTextDisplay,
                filteredItems: state.items.filter((item) => {
                    return !!item.name?.includes(state.filter.filteringText);
                })
            }
        });
    }, [state.items, state.filter.filteringText, state.filter.filteringTextDisplay]);

    return (
        <Box>
            <SpaceBetween direction='vertical' size='s'>
                <Condition condition={header !== undefined}>
                    { header }
                </Condition>
                
                <BreadcrumbGroup items={state.breadcrumbs} onClick={(event) => {
                    event.preventDefault();

                    setState({
                        type: DatasetActionType.DatasetContext,
                        payload: event.detail.href.length > 0 ? JSON.parse(event.detail.href) : undefined
                    });
                }} />

                <Table
                    // add common properties shared by every display mode
                    header={<Header counter={`(${state.items.length})`}>{displayMode}s</Header>}
                    empty={EmptyState('No Entries exist')}
                    filter={
                        <MLTextFilter
                            filteringText={state.filter.filteringTextDisplay}
                            requireEnter={true}
                            countText={getMatchesCountText(state.filter.filteredItems.length)}
                            onChange={({detail: {filteringText}}) => {
                                const filteringTextPrefix = prefixForPath(filteringText);
                                const filteringTextDisplayPrefix = prefixForPath(state.filter.filteringTextDisplay);
                                const shouldFetch = filteringTextPrefix !== filteringTextDisplayPrefix;

                                if (state.datasetContext) {
                                    const payload: Pick<DatasetBrowserState, 'isLoading' | 'filter'> = {
                                        isLoading: shouldFetch,
                                        filter: {
                                            ...state.filter,
                                            filteringTextDisplay: filteringText,
                                            filteringText
                                        }
                                    };

                                    // if there is a a prefix then the actual filter text should not include the prefix
                                    if (filteringTextPrefix) {
                                        payload.filter.filteringText = resourceForPath(filteringText); 
                                    }

                                    setState({
                                        type: DatasetActionType.State,
                                        payload
                                    });

                                    if (shouldFetch) {
                                        // if the filter contains a prefix append that to the Location
                                        const newContext = {...state.datasetContext, Location: [state.datasetContext.Location, filteringTextPrefix].join('')};
                                        fetchDatasetResources(newContext);
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
                    onSelectionChange={({detail}) => {
                        setSelectedItems(detail.selectedItems);
                        const selectedItem = detail.selectedItems?.[0];
                        let selection: string | undefined = undefined;
                        if (selectedItem) {
                            switch (selectedItem?.type) {
                                case 'object':
                                    selection = `s3://${selectedItem.bucket}/${selectedItem.key}`;
                                    break;
                                case 'prefix':
                                    selection = `s3://${selectedItem.bucket}/${selectedItem.prefix}`;
                                    break;
                                default:
                                    selection = selectedItem.location;
                            }
                                
                        }     

                        props.onSelectionChange?.(new CustomEvent('selectionChange', {bubbles: false, detail: {selectedItem: selection}}));
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
                                    const filteringTextPrefix = prefixForPath(state.filter.filteringTextDisplay);
                                    // if the filter contains a prefix append that to the Location
                                    const newContext = {...state.datasetContext, Location: [state.datasetContext.Location, filteringTextPrefix].join('')};
                                    fetchDatasetResources(newContext, state.nextToken, state.items);
                                }
                            }}
                        />
                    }
                    selectionType={selectableItemsTypes.length > 0 ? 'single' : undefined}
                    selectedItems={selectedItems}
                    variant={'borderless'}

                    // add display mode specific properties
                    {...displayModeTableProperties}
                ></Table>
            </SpaceBetween>
        </Box>
    );
}

export default DatasetBrowser;
