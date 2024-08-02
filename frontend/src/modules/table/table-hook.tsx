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

import { Button, Header, Icon, Pagination, PaginationProps, SpaceBetween, TextContent, TextFilterProps } from '@cloudscape-design/components';
import { QueryDefinition } from '@reduxjs/toolkit/dist/query/endpointDefinitions';
import { QueryHooks } from '@reduxjs/toolkit/dist/query/react/buildHooks';
import { ApiEndpointQuery, BaseQueryFn } from '@reduxjs/toolkit/query';
import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '../../config/store';
import { upperFirst } from 'lodash';
import pluralize from 'pluralize';
import { NonCancelableEventHandler } from '@cloudscape-design/components/internal/events';

export type UseCollectionConfig<T> = {
    /**
     * The type of object in this collection
     */
    itemName: string,

    /**
     * (optional) How often in milliseconds should this collection automatically refresh.
     * **NOTE** For paginated searches this will only refresh the last fetched page.
     */
    pollingInterval?: number

    /**
     * Actions to append to the Header object returned in {@link UseCollectionResult#headerActions}. These actions
     * will be wrapped in a {@link ActionContext} so they have access to {@link UseCollectionContext}
     */
    headerActions?: React.ReactNode,

    /**
     * Filtering configuration. If you want to activate filtering with default settings, provide an empty object.
     */
    filtering?: {
        /** 
         * Custom function to filter items. The default value is a function that loops through all items keys (unless
         * fields property is provided, see below), converts all values to strings, and matches them against current
         * filteringText.
         */
        filteringFunction?: (item: T, text: string, fields?: string[]) => boolean,

        /**
         * Array of keys within the item object whose values are taken into account by the default filteringFunction.
         */
        fields?: string[],

        /**
         * Initial filtering value on the first render.
         */
        defaultFilteringText?: string,

        /**
         * Content to display in the table/cards empty slot when there are no items initially provided.
         */
        empty?: React.ReactNode,

        /**
         * Content to display in the table/cards empty slot when filtering returns no matched items.
         */
        noMatch?: React.ReactNode
    },

    /**
     * Configuration for property filtering.
     */
    propertyFiltering?: {
        /**
         * 
         */
        filteringProperties?: any[],

        /**
         * Custom function to filter items. The default value is a function that takes values under
         * the FilteringProperty['key'] in individual items, and matches them against current filteringText.
         */
        filteringFunction?: (item: T, query: any) => boolean,

        /**
         * Initial query on the first render.
         */
        defaultQuery?: any,

        /**
         * Content to display in the table/cards empty slot when there are no items initially provided.
         */
        empty?: React.ReactNode,

        /**
         * Content to display in the table/cards empty slot when filtering returns no matched items.
         */
        noMatch?: React.ReactNode
    },

    /**
     * Sorting configuration. If you want to use sorting with default settings, provide an empty
     * object. This feature is only applicable for the table component.
     */
    sorting?: {
        /**
         * Initial sorting state on the first render. This is an object with two properties:
         */
        defaultState?: {
            sortingColumn: any[],
            isDescending?: boolean[]
        },
    },

    pagination?: {
        pageSize?: number,
        defaultPage?: number
    },
    selection?: {
        defaultSelectedItems?: ReadonlyArray<T>,
        keepSelection?: boolean,
        trackBy?: string | ((item: T) => string),
    },
    expandableRows: {
        getId?: (item: T) => string,
        getParentId?: (item: T) => null | string,
        defaultExpandedItems: ReadonlyArray<T>
    }
};

export type ActionsContext = {
    setNextPage: () => void,
    reset: () => void,
    refresh: () => void,
};

export type CollectionPropsContext<T> = {
    selectedItems: readonly T[]
    trackBy: string | ((items: T) => string),
    loading: boolean,
    loadingText: string,
};

export type FilterPropsContext = {
    disabled: boolean,
    filteringText: string,
    countText: string,
};

export type PaginationPropsContext = {
    disabled: boolean,
    openEnd: boolean,
    currentPageIndex: number,
    pagesCount: number,
};

export type BaseCollectionContext<T> = {
    /**
     * Table items with filtering, sorting, and pagination applied. In tables with expandable rows, only root
     * items are returned.
     */
    items: readonly T[],

    /**
     * Table items with filtering and sorting applied. In tables with expandable rows, only root items
     * are returned.
     */
    allPageItems: readonly T[],

    /**
     * The total count of all items in a table. For tables with expandable rows it only includes the
     * top-level items.
     */
    totalItemsCount: number,

    /**
     * Total numbers of items matching the current filter, ignoring the pagination. Use this value for
     * creating the localized matches count text for the TextFilter component.
     */
    filteredItemsCount: number,

    /**
     * The 1-based index of the first item returned in the items array. This index changes when pagination is used.
     * 
     * @todo implement this, right now always returns 0
     */
    firstIndex: number,

    /**
     * The type of object in this collection
     */
    itemName: string,

    /**
     * A pluralized version of {@link BaseCollectionContext#itemName} that you can use when
     * referring to the collection as a whole.
     */
    collectionName: string,
};

type UseCollectionContext<T> = BaseCollectionContext<T> & {actions: ActionsContext} & {collectionProps: CollectionPropsContext<T>} & {filterProps: FilterPropsContext};

type UseCollectionResult<T> = BaseCollectionContext<T> & {
    headerActions: React.ReactNode,

    actions: ActionsContext,

    collectionProps: CollectionPropsContext<T> & Partial<{
        empty: React.ReactNode,
        header?: React.ReactNode,
        onSortingChange: NonCancelableEventHandler<CustomEvent<any>>,
        onSelectionChange: NonCancelableEventHandler<CustomEvent<any>>,
        expandableRows: any,
        ref: React.RefObject<any>,
        pagination: React.ReactNode
    }>,

    filterProps: FilterPropsContext & {
        onChange: NonCancelableEventHandler<TextFilterProps.ChangeDetail>;
    },

    propertyFilterProps: number,

    paginationProps: PaginationPropsContext & {
        onChange: NonCancelableEventHandler<PaginationProps.ChangeDetail>,
        onNextPageClick: NonCancelableEventHandler<PaginationProps.PageClickDetail>
    }
};

export type PagedResponse<T> = {
    items: T[],
    nextToken?: string
};

export type PagedRequest = {
    nextToken?: string,
    pageSize?: number
};

export const ActionContext = React.createContext(undefined);

export const useCollection = <T, QueryArg extends PagedRequest, BaseQuery extends BaseQueryFn, TagTypes extends string, ResultType extends PagedResponse<T>, D extends QueryDefinition<QueryArg, BaseQuery, TagTypes, ResultType>>(queryHook: QueryHooks<D> & ApiEndpointQuery<D, any>, arg?: {[key: string]: string}, config?: UseCollectionConfig<T>): UseCollectionResult<T> => {
    // collection
    const [pageSize] = useState<number>(config?.pagination?.pageSize || 10);
    const [lastArg, setLastArg] = useState<any>();
    const [nextToken, setNextToken] = useState<string>();
    const [allItems, setAllItems] = useState<T[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState<number>(config?.pagination?.defaultPage || 1);

    const { data, isFetching, isSuccess, refetch, originalArgs } = queryHook.useQuery({...arg, nextToken, pageSize}, {
        pollingInterval: config?.pollingInterval
    });

    useEffect(() => {
        if (!isFetching && isSuccess && JSON.stringify(lastArg) !== JSON.stringify(originalArgs)) {
            setLastArg(originalArgs);
            setAllItems([...allItems, ...data.items]);
        }
    }, [data, isFetching, isSuccess, allItems, originalArgs, lastArg]);

    const dispatch = useAppDispatch();
    
    // filtering
    const [filteringText, setFilteringText] = useState<string>(config?.filtering?.defaultFilteringText || '');
    const filteredItems = allItems.filter((item) => {
        if (filteringText === undefined || filteringText.length === 0) {
            return true;
        }

        return (config?.filtering?.filteringFunction ? config.filtering.filteringFunction : (item: T, text: string, fields: string[]) => {
            if (!item) {
                return false;
            }

            return Object.keys(item)
                .filter((field) => fields.length ? fields.includes(field) : true)
                .findIndex((field) => {
                    if (item && typeof item === 'object') {
                        if (field in item) {
                            if (typeof item[field] == 'string') {
                                return item[field].includes(text);
                            }
                        }
                    }
    
                    return false;
                }) > -1;
        })(item, filteringText, config?.filtering?.fields || []);
    });
    const items = filteredItems.slice(pageSize * (currentPageIndex - 1), pageSize * currentPageIndex);

    const collectionName = pluralize(config?.itemName ? config.itemName : 'item', items.length);

    let empty;
    if (!allItems.length) {
        empty = config?.filtering?.empty ? config.filtering.empty : <TextContent>No {collectionName} exist.</TextContent>;
    } else if (allItems.length && filteredItems.length === 0) {
        empty = config?.filtering?.noMatch ? config.filtering.noMatch : <TextContent>No {collectionName} found.</TextContent>;
    }

    const pagesCount = Math.ceil((filteringText ? filteredItems : allItems).length / pageSize);
    useEffect(() => {
        setCurrentPageIndex(Math.max(Math.min(currentPageIndex, pagesCount), 1));
    }, [filteredItems, pagesCount, currentPageIndex]);

    // selection
    const [selectedItems, setSelectedItems] = useState<T[]>(config?.selection?.defaultSelectedItems || []);
    useEffect(() => {
        if (!config?.selection?.keepSelection) {
            setSelectedItems([]);
        }
    }, [pageSize, pagesCount, currentPageIndex, filteringText, config?.selection?.keepSelection]);

    const refresh = () => {
        dispatch(queryHook.initiate(lastArg, {forceRefetch: true}));
    };
    const headerActions = (
        <Button
            onClick={refresh}
            ariaLabel={`Refresh ${collectionName} list`}
            disabled={isFetching}
        >
            <Icon name='refresh'/>
        </Button>
    );

    const paginationProps = {
        disabled: isFetching,
        openEnd: Boolean(data?.nextToken),
        // setting it herte isn't enough, we actually need to return this
        currentPageIndex,
        pagesCount,
        onChange: (event) => setCurrentPageIndex(event.detail.currentPageIndex),
        onNextPageClick: (event) => {
            if (!event.detail.requestedPageAvailable) {
                setNextToken(data.nextToken);
            }
            setCurrentPageIndex(event.detail.requestedPageIndex);
        },
        onPreviousPageClick: (event) => setCurrentPageIndex(event.detail.requestedPageIndex),
    };

    const context: UseCollectionContext<T> = {
        items,
        allPageItems: allItems,
        totalItemsCount: allItems.length,
        filteredItemsCount: filteredItems.length,
        firstIndex: 0,
        collectionName,
        actions: {
            setNextPage: () => {
                if (data?.nextToken) {
                    setNextToken(data.nextToken);
                }
            },
            reset: () => {
                setNextToken(undefined);
                setAllItems([]);
                setCurrentPageIndex(1);
                setLastArg(undefined);
                refetch();
            },
            refresh
        },
        collectionProps: {
            selectedItems,
            trackBy: config?.selection?.trackBy || 'id',
            loading: isFetching,
            loadingText: `Loading ${pluralize(collectionName, 2)}...`,
        },
        filterProps: {
            disabled: isFetching,
            filteringText,
            countText: `${filteredItems.length} items`,
        },
    };

    return {
        ...context,

        headerActions: headerActions,

        collectionProps: {
            ...context.collectionProps,
            empty,
            onSelectionChange: (event) => {
                setSelectedItems(event.detail.selectedItems);
            },
            pagination: <Pagination {...paginationProps}/>,
            header: (<Header
                actions={<SpaceBetween direction='horizontal' size='xxs'>
                    { headerActions }
                    { config?.headerActions && <ActionContext.Provider value={context}>
                        {config.headerActions}
                    </ActionContext.Provider>}
                </SpaceBetween>}
                variant={'h1'}
                description={'some description'}
                counter={
                    selectedItems?.length
                        ? `(${selectedItems.length}/${allItems.length})`
                        : `(${allItems.length})`
                }
            >
                {upperFirst(collectionName)}
            </Header>)
        },

        filterProps: {
            disabled: isFetching,
            filteringText,
            countText: `${filteredItems.length} items`,
            onChange: (event) => {
                console.log(event);
                setFilteringText(event.detail.filteringText);
            }
        },

        paginationProps,

        // todo we don't use this but this needs to be fleshed out
        propertyFilterProps: {} as any
    };
};