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
import { Reducer } from 'react';
import { breadcrumbFromDataset, lastComponent } from './dataset-browser.utils';
import { ServerRequestProps } from '../../shared/util/table-utils';
import { DatasetContext } from '../../shared/util/dataset-utils';
import { PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { DatasetType, IDataset } from '../../shared/model/dataset.model';
import axios from '../../shared/util/axios-utils';
import { BreadcrumbGroupProps, PaginationProps } from '@cloudscape-design/components';

/**
 * Thunk parameter for {@link getDatasetContents}. Extends {@link ServerRequestProps} with
 * additional properties for fetching dataset contents.
 */
export type DatasetServerRequestProps = ServerRequestProps & {
    datasetContext: DatasetContext,
    username?: string
};

/**
 * Base type for the contents of a dataset
 */
type DatasetResourceBase = {
    type: string,
    bucket: string,
    name: string
};

/**
 * Object variant of {@link DatasetResourceBase}
 */
export type DatasetObjectResource = DatasetResourceBase & {
    type: 'object',
    key: string,
    size?: number
};

/**
 * Prefix variant of {@link DatasetResourceBase}
 */
export type DatasetPrefixResource = DatasetResourceBase & {
    type: 'prefix',
    prefix: string
};

export type DatasetResource = DatasetObjectResource | DatasetPrefixResource;

/**
 * Expected response structure for listing dataset contents
 */
export type ListFilesResponse = {
    bucket: string,
    prefix: string,
    nextToken: string,
    contents: DatasetResource[]
};

/**
 * Discriminators for actions dispatched to {@link datasetBrowserReducer}
 */
export enum DatasetActionType {
    DatasetContext = 'DatasetContext',
    Filter = 'Filter',
    Pagination = 'Pagination',
    State = 'State',
}

/**
 * Action to update top level properties of {@link DatasetBrowserState}. Properties
 * not provided will be inherited from the existing state.
 */
export type StateAction = PayloadAction<Partial<DatasetBrowserState>> & {
    type: DatasetActionType.State;
};

/**
 * Action to update {@link DatasetBrowserState#datasetContext}. Related fields will
 * be reset to their defaults.
 */
export type ContextAction = PayloadAction<DatasetContext | undefined> & {
    type: DatasetActionType.DatasetContext;
};

/**
 * Action to update {@link DatasetBrowserState#pagination}. Properties not provided
 * will be inherited from the existing pagination state.
 */
export type PaginationAction = PayloadAction<Partial<DatasetBrowserState['pagination']>> & {
    type: DatasetActionType.Pagination;
};

/**
 * Action to update {@link DatasetBrowserState#filter}. Properties not provided
 * will be inherited from the existing pagination state.
 */
export type FilterAction = PayloadAction<Partial<DatasetBrowserState['filter']>> & {
    type: DatasetActionType.Filter;
};

export type DatasetBrowserAction = StateAction | ContextAction | PaginationAction | FilterAction;

/**
 * Component state for {@link DatasetBrowser}
 */
export type DatasetBrowserState = {
    /**
     * The current {@link DatasetContext} to display
     */
    datasetContext?: DatasetContext;
    /**
     * List of {@link BreadcrumbGroupProps.Item} showing the ancestor contexts
     */
    breadcrumbs: BreadcrumbGroupProps.Item[];
    /**
     * List of items fetched for {@link DatasetBrowserState#datasetContext}
     */
    items: (DatasetResource | IDataset)[];
    /**
     * String showing  
     */
    nextToken?: string;
    isLoading: boolean;
    isPinned?: boolean;
    username: string;
    projectName: string;
    filter: {
        filteringText: string;
        filteringTextDisplay: string;
        filteredItems: (DatasetResource | IDataset)[];
    },
    pagination: Pick<PaginationProps, 'currentPageIndex' | 'disabled' | 'openEnd' | 'pagesCount'>
};

/**
 * Async thunk for fetching the contents of datasets.
 */
export const getDatasetContents = createAsyncThunk(
    'dataset/list_files',
    async (props: DatasetServerRequestProps) => {
        const { datasetContext, projectName, username } = props;
        let scope: string | undefined = datasetContext.Type;

        switch (datasetContext.Type) {
            case DatasetType.PROJECT:
                scope = projectName;
                break;
            case DatasetType.PRIVATE:
                scope = username;
        }

        const requestUrl = new URL(`${window.env.LAMBDA_ENDPOINT}dataset/${scope}/${datasetContext.Name}/files`);

        if (props.nextToken) {
            requestUrl.searchParams.set('nextToken', props.nextToken);
        }

        if (props.pageSize) {
            requestUrl.searchParams.set('pageSize', String(props.pageSize));
        }

        if (props.projectName) {
            requestUrl.searchParams.set('projectName', props.projectName);
        }

        if (datasetContext?.Location) {
            requestUrl.searchParams.set('prefix', datasetContext.Location);
        }

        return axios.get<ListFilesResponse>(requestUrl.toString()).then((response) => {
            response.data.contents.forEach((resource) => {
                // copy bucket from top level of response to individual resources for easier management
                resource.bucket = response.data.bucket;

                // for easier display set name field to the last component
                switch (resource.type) {
                    case 'object':
                        resource.name = lastComponent(resource.key);
                        break;
                    case 'prefix':
                        resource.name = lastComponent(resource.prefix);
                        break;
                }
            });
            
            return response;
        });
    }
);

/**
 * A {@link Reducer} for updating the state for a {@link DatasetBrowser}
 * 
 * @param {DatasetBrowserState} state previous state
 * @param {DatasetBrowserAction} action action dispatched to update state
 * @returns 
 */
export const datasetBrowserReducer: Reducer<DatasetBrowserState, DatasetBrowserAction> = (state: DatasetBrowserState, action: DatasetBrowserAction) => {
    switch (action.type) {
        case DatasetActionType.DatasetContext:
            return {
                ...state,
                datasetContext: action.payload,
                breadcrumbs: breadcrumbFromDataset(action.payload, state.isPinned),
                items: [],
                nextToken: undefined,
                filter: {
                    filteringText: '',
                    filteringTextDisplay: '',
                    filteredItems: []
                }
            };
        case DatasetActionType.Pagination:
            return {
                ...state,
                pagination: {
                    ...state.pagination,
                    ...action.payload
                }
            };
        case DatasetActionType.Filter:
            return {
                ...state,
                filter: {
                    ...state.filter,
                    ...action.payload
                }
            };
        case DatasetActionType.State:
            return {
                ...state,
                ...action.payload
            };
        default:
            return state;
    }
};