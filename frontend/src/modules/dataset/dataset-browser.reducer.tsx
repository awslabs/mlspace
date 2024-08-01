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
import { ServerRequestProps } from '../../shared/util/table-utils';
import { DatasetContext } from '../../shared/util/dataset-utils';
import { PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { DatasetType, IDataset } from '../../shared/model/dataset.model';
import axios from '../../shared/util/axios-utils';
import { PaginationProps } from '@cloudscape-design/components';
import { lastComponent } from './dataset-browser.utils';
import { DatasetBrowserManageMode } from './dataset-browser.types';

/**
 * Thunk parameter for {@link getDatasetContents}. Extends {@link ServerRequestProps} with
 * additional properties for fetching dataset contents.
 */
export type DatasetServerRequestProps = ServerRequestProps & {
    datasetContext: Partial<DatasetContext>,
    username?: string,
    delimiter?: string
};

/**
 * Base type for the contents of a dataset
 */
type DatasetResourceBase = {
    type: 'object' | 'prefix',
    bucket: string,
    name: string
};

/**
 * Object variant of {@link DatasetResourceBase}
 */
export type DatasetResourceObject = DatasetResourceBase & {
    type: 'object',
    key: string,
    size?: number,
    file?: File,
};

/**
 * Prefix variant of {@link DatasetResourceBase}
 */
export type DatasetResourcePrefix = DatasetResourceBase & {
    type: 'prefix',
    prefix: string
};

export type DatasetResource = DatasetResourceObject | DatasetResourcePrefix;

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
export type ContextAction = PayloadAction<Partial<DatasetContext> | undefined> & {
    type: DatasetActionType.DatasetContext;
};

/**
 * Action to update {@link DatasetBrowserState#pagination}. Properties not provided
 * will be inherited from the existing pagination state.
 */
export type PaginationAction = PayloadAction<Partial<DatasetBrowserState['pagination']>> & {
    type: DatasetActionType.Pagination;
};

export type DatasetBrowserAction = StateAction | ContextAction | PaginationAction;

/**
 * Component state for {@link DatasetBrowser}
 */
export type DatasetBrowserState = {
    /**
     * The current {@link DatasetContext} to display
     */
    datasetContext?: Partial<DatasetContext>;
    /**
     * List of items fetched for {@link DatasetBrowserState#datasetContext}
     */
    items: (DatasetResource | IDataset)[];
    /**
     * Subset of {@link DatasetBrowserState#items} of selected items
     */
    selectedItems: (DatasetResource | IDataset)[];
    /**
     * Defines how the browser functions.
     * - {@link DatasetBrowserManageMode#Create} will not fetch any data from the server and expects {@link DatasetBrowserState#items)} to be populated another way.
     * - {@link DatasetBrowserManageMode#Edit} will not fetch any data from the server and expects {@link DatasetBrowserState#items)} to be populated another way.
     */
    manageMode?: DatasetBrowserManageMode,
    /**
     * String showing  
     */
    nextToken?: string;
    isLoading: boolean;
    username: string;
    projectName: string;
    filteringText: string;
    pagination: Pick<PaginationProps, 'currentPageIndex' | 'disabled' | 'openEnd' | 'pagesCount'>,
};

/**
 * Async thunk for fetching the contents of datasets.
 */
export const getDatasetContents = createAsyncThunk(
    'dataset/list_files',
    async (props: DatasetServerRequestProps) => {
        const { datasetContext } = props;

        switch (datasetContext.type) {
            case DatasetType.GROUP:
            case DatasetType.GLOBAL:
                datasetContext.scope = datasetContext.type;
                break;
        }

        const searchParams = new URLSearchParams();

        const queryStringParameters = ['nextToken', 'pageSize', 'projectName', 'delimiter'];
        for (const key of queryStringParameters) {
            if (props[key] !== undefined) {
                searchParams.set(key, String(props[key]));    
            }
        }

        if (datasetContext?.location) {
            searchParams.set('prefix', datasetContext.location);
        }

        return axios.get<ListFilesResponse>(`/v2/dataset/${datasetContext.type}/${datasetContext.scope}/${datasetContext.name}/files?${searchParams.toString()}`).then((response) => {
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
                items: [],
                nextToken: undefined,
                filter: {
                    filteringText: '',
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
        case DatasetActionType.State:
            return {
                ...state,
                ...action.payload
            };
        default:
            return state;
    }
};