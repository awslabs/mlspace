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
    createAsyncThunk,
    createSlice,
    isFulfilled,
    isPending,
    PayloadAction,
} from '@reduxjs/toolkit';
import { IDataset } from '../../shared/model/dataset.model';
import axios from '../../shared/util/axios-utils';
import { ServerRequestProps } from '../../shared/util/table-utils';

const initialState = {
    loadingAction: false,
    loadingDatasetsList: false,
    loadingDataset: false,
    datasetsList: [],
    dataset: {},
    loadingFileEntities: false,
    showModal: false,
    presignedUrls: [] as any[],
};

// Actions

export const getDatasetsList = createAsyncThunk(
    'dataset/fetch_entity_list',
    async (params: ServerRequestProps) => {
        let requestUrl = '/dataset';
        if (params?.projectName !== undefined) {
            requestUrl = `/project/${params.projectName}/datasets`;
        }
        return axios.get<IDataset[]>(requestUrl);
    }
);

export const getDataset = createAsyncThunk(
    'dataset/fetch_entity_by_id',
    async ({ type, scope, name }: any) => {
        const requestUrl = `dataset/${type}/${scope}/${name}`;
        return axios.get<IDataset>(requestUrl);
    }
);

export const deleteDatasetFromProject = createAsyncThunk(
    'dataset/remove_dataset_from_project',
    async (dataset: IDataset) => {
        const requestUrl = `/dataset/${dataset.type}/${dataset.scope}/${dataset.name}`;
        return axios.delete<IDataset>(requestUrl);
    }
);

export const deleteFileFromDataset = createAsyncThunk(
    'dataset/remove_file_from_dataset',
    async ({ type, scope, datasetName, files }: any) => {
        for (const file of files) {
            const requestUrl = `v2/dataset/${type}/${scope}/${datasetName}/${file}`;
            await axios.delete<IDataset>(requestUrl);
        }
    }
);

export const editDataset = createAsyncThunk('dataset/edit_dataset', async (dataset: IDataset) => {
    const requestUrl = `/dataset/${dataset.type}/${dataset.scope}/${dataset.name}`;
    return axios.put<any>(requestUrl, dataset);
});

export const addDataset = createAsyncThunk('dataset/add_dataset', async (data: any) => {
    const requestUrl = '/dataset';
    return axios.post<IDataset>(requestUrl, data);
});

// slice

export const DatasetSlice = createSlice({
    name: 'dataset',
    initialState,
    reducers: {
        updateEntity (state, action: PayloadAction<IDataset>) {
            state.dataset = action.payload;
        },
        clearDatasetList (state) {
            state.datasetsList.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(getDatasetsList), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    loadingDatasetsList: false,
                    datasetsList: data,
                };
            })
            .addMatcher(isFulfilled(getDataset), (state, action) => {
                const { data } = action.payload;
                console.log(`Retrieved dataset: ${JSON.stringify(data)}`);
                return {
                    ...state,
                    loadingDataset: false,
                    dataset: data,
                };
            })
            .addMatcher(isFulfilled(deleteFileFromDataset), (state) => {
                return {
                    ...state,
                    loadingAction: false,
                };
            })
            .addMatcher(isFulfilled(editDataset), (state) => {
                return {
                    ...state,
                    loadingAction: false,
                };
            })
            .addMatcher(isFulfilled(addDataset), (state) => {
                return {
                    ...state,
                    loadingAction: false,
                };
            })
            .addMatcher(isPending(getDatasetsList), (state) => {
                return {
                    ...state,
                    loadingDatasetsList: true,
                };
            })
            .addMatcher(isPending(getDataset), (state) => {
                return {
                    ...state,
                    loadingDataset: true,
                };
            })
            .addMatcher(isPending(editDataset), (state) => {
                return {
                    ...state,
                    loadingAction: true,
                };
            });
    },
});

// Reducer
export default DatasetSlice.reducer;
export const { updateEntity, clearDatasetList } = DatasetSlice.actions;
export const loadingDatasetsList = (state: any) => state.dataset.loadingDatasetsList;
export const loadingDataset = (state: any) => state.dataset.loadingDataset;
export const loadingFiles = (state: any) => state.dataset.loadingFileEntities;
export const loadingDatasetAction = (state: any) => state.dataset.loadingAction;
export const datasetsList = (state: any) => state.dataset.datasetsList;
export const datasetBinding = (state: any) => state.dataset.dataset;
