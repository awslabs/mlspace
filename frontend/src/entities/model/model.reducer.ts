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
    isRejected,
    isPending,
    PayloadAction,
} from '@reduxjs/toolkit';
import { IModel } from '../../shared/model/model.model';
import { SelectProps } from '@cloudscape-design/components';
import axios, { setProjectHeader } from '../../shared/util/axios-utils';
import { PagedResponsePayload, ServerRequestProps } from '../../shared/util/table-utils';
import { addPagingParams } from '../../shared/util/url-utils';
import { cloneDeep } from 'lodash';
import { ModelResourceMetadata } from '../../shared/model/resource-metadata.model';

type ModelAndProject = {
    model: IModel;
    projectName: string;
};

const initialState = {
    selectTrainingJobModalVisible: false,
    loadingModelsList: false,
    loadingModel: false,
    loadingImageURIs: false,
    loadingURLs: false,
    modelsList: [] as ModelResourceMetadata[],
    model: {} as IModel,
    imageURIs: [] as SelectProps.Option[],
    modelDataUrls: [] as SelectProps.Option[],
    responseText: undefined,
};

// Actions

export const getProjectModels = createAsyncThunk(
    'models/fetch_entity_list',
    async (params: ServerRequestProps) => {
        const requestUrl = `/project/${params.projectName}/models`;
        return axios.get<PagedResponsePayload<ModelResourceMetadata>>(
            addPagingParams(requestUrl, params)
        );
    }
);

export const getModelByName = createAsyncThunk(
    'models/fetch_entity_by_id',
    async (modelName: string) => {
        const requestUrl = `/model/${modelName}`;
        return await axios.get<IModel>(requestUrl);
    }
);

export const deleteModelFromProject = createAsyncThunk(
    'models/remove_model_from_project',
    async (modelName: string) => {
        const requestUrl = `/model/${modelName}`;
        return axios.delete<IModel>(requestUrl);
    }
);

export const createModel = async ({ model, projectName }: ModelAndProject) => {
    const requestUrl = '/model';
    const payload = {
        ...model,
        ProjectName: projectName,
        PrimaryContainer: model.Containers![0],
    };
    return axios.post<IModel>(requestUrl, payload, setProjectHeader(projectName));
};

export const getImageURIs = createAsyncThunk('model/image_uris', async () => {
    return axios.get('/model/images');
});

// slice

export const ModelSlice = createSlice({
    name: 'model',
    initialState,
    reducers: {
        toggleSelectTrainingJobModal (state, action) {
            state.selectTrainingJobModalVisible = action.payload;
        },
        updateEntity (state, action: PayloadAction<IModel>) {
            state.model = action.payload;
        },
        clearModelsList (state) {
            state.modelsList.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(
                isRejected(getProjectModels, getModelByName, deleteModelFromProject, getImageURIs),
                (state, action: any) => {
                    let data: any = undefined;
                    if (action.payload) {
                        data = action.payload;
                    }
                    return {
                        ...state,
                        loadingModelsList: false,
                        loadingModels: false,
                        loadingImageURIs: false,
                        loadingURLs: false,
                        responseText: data,
                    };
                }
            )
            .addMatcher(isFulfilled(getProjectModels), (state, action: any) => {
                const { data } = action.payload;
                const allModels = cloneDeep(state.modelsList);
                data.records.forEach((model: ModelResourceMetadata) => {
                    const existingIndex = allModels.findIndex(
                        (m) => m.metadata.ModelArn === model.metadata.ModelArn
                    );
                    if (existingIndex > -1) {
                        allModels[existingIndex] = model;
                    } else {
                        allModels.push(model);
                    }
                });
                return {
                    ...state,
                    loadingModelsList: false,
                    modelsList: allModels,
                };
            })
            .addMatcher(isPending(getProjectModels), (state) => {
                return {
                    ...state,
                    loadingModelsList: true,
                };
            })
            .addMatcher(isFulfilled(getImageURIs), (state, action: any) => {
                const { data } = action.payload;
                const images = [] as SelectProps.Option[];
                Object.keys(data).forEach((key: string) => {
                    images.push({ value: data[key] });
                });
                return {
                    ...state,
                    loadingImageURIs: false,
                    imageURIs: images,
                };
            })
            .addMatcher(isPending(getImageURIs), (state) => {
                return {
                    ...state,
                    loadingImageURIs: true,
                };
            })
            .addMatcher(isFulfilled(getModelByName), (state, action: any) => {
                const { data } = action.payload;
                if (Object.prototype.hasOwnProperty.call(data, 'PrimaryContainer')) {
                    if (!Object.prototype.hasOwnProperty.call(data, 'Containers')) {
                        data['Containers'] = [data['PrimaryContainer']];
                    } else {
                        data['Containers'] = data['Containers'].concat(data['PrimaryContainer']);
                    }
                }
                return {
                    ...state,
                    loadingModel: false,
                    model: data,
                };
            })
            .addMatcher(isPending(getModelByName), (state) => {
                return {
                    ...state,
                    loadingModel: true,
                };
            })
            .addMatcher(isFulfilled(deleteModelFromProject, getModelByName), (state) => {
                return {
                    ...state,
                    loadingModel: false,
                };
            })
            .addMatcher(isPending(deleteModelFromProject, getModelByName), (state) => {
                return {
                    ...state,
                    loadingModel: true,
                };
            });
    },
});

// Reducer
export default ModelSlice.reducer;
export const { toggleSelectTrainingJobModal, updateEntity, clearModelsList } = ModelSlice.actions;
export const loadingModelsList = (state: any) => state.model.loadingModelsList;
export const loadingModel = (state: any) => state.model.loadingModel;
export const loadingImageURIs = (state: any) => state.model.loadingImageURIs;
export const loadingURL = (state: any) => state.model.loadingURLs;
export const modelsList = (state: any) => state.model.modelsList;
export const modelBinding = (state: any) => state.model.model;
