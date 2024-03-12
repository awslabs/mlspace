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

import { createAsyncThunk, createSlice, isFulfilled, isPending } from '@reduxjs/toolkit';
import {
    defaultProductionVariant,
    defaultValue,
    IEndpointConfig,
    IProductionVariant,
} from '../../shared/model/endpoint-config.model';
import axios, { setProjectHeader } from '../../shared/util/axios-utils';
import { cloneDeep } from 'lodash';
import { PagedResponsePayload, ServerRequestProps } from '../../shared/util/table-utils';
import { addPagingParams } from '../../shared/util/url-utils';
import { EndpointConfigResourceMetadata } from '../../shared/model/resource-metadata.model';

type IEndpointConfigState = {
    loading: boolean;
    errorMessage: string | null;
    entities: ReadonlyArray<EndpointConfigResourceMetadata>;
    entity: IEndpointConfig;
    selectedEntity?: IEndpointConfig;
    selectedVariant?: IProductionVariant;
    links?: any;
    totalItems?: number;
    showAddModelModal?: boolean;
    showEditVariantModal?: boolean;
};

type EndpointConfigAndProject = {
    endpointConfig: IEndpointConfig;
    projectName: string;
};

const initialState: IEndpointConfigState = {
    showAddModelModal: false,
    showEditVariantModal: false,
    loading: false,
    errorMessage: null,
    entities: [],
    selectedEntity: undefined,
    entity: defaultValue,
    selectedVariant: defaultProductionVariant('N/A', 1),
};

// Actions

export const getProjectEndpointConfigs = createAsyncThunk(
    'endpoint-config/fetch_entity_list',
    async (params: ServerRequestProps) => {
        const requestUrl = `/project/${params.projectName}/endpoint-configs`;
        return axios.get<PagedResponsePayload<EndpointConfigResourceMetadata>>(
            addPagingParams(requestUrl, params)
        );
    }
);

export const getEndpointConfig = createAsyncThunk(
    'endpoint-config/fetch_entity_by_id',
    async (endpointConfigName: string) => {
        const requestUrl = `endpoint-config/${endpointConfigName}`;
        return axios.get<IEndpointConfig>(requestUrl);
    }
);

export const createEndpointConfig = async ({
    endpointConfig,
    projectName,
}: EndpointConfigAndProject) => {
    const requestUrl = '/endpoint-config';
    const payload = {
        ...endpointConfig,
        ProjectName: projectName,
    };
    return axios.post<IEndpointConfig>(requestUrl, payload, setProjectHeader(projectName));
};

export const deleteEndpointConfig = (endpointConfigName: string) => {
    const requestUrl = `endpoint-config/${endpointConfigName}`;
    return axios.delete(requestUrl);
};

// slice

export const EndpointConfigSlice = createSlice({
    name: 'endpointConfig',
    initialState,
    reducers: {
        toggleAddModelModal (state, action) {
            state.showAddModelModal = action.payload;
        },
        toggleEditVariantModal (state, action) {
            state.showEditVariantModal = action.payload;
        },
        setSelectedVariant (state, action) {
            state.selectedVariant = action.payload;
        },
        clearEndpointConfigs (state) {
            state.entities.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(getProjectEndpointConfigs), (state, action) => {
                const { data } = action.payload;
                const allConfigs = cloneDeep(state.entities);
                data.records.forEach((config: EndpointConfigResourceMetadata) => {
                    const existingIndex = allConfigs.findIndex(
                        (c) => c.metadata.EndpointConfigArn === config.metadata.EndpointConfigArn
                    );
                    if (existingIndex > -1) {
                        allConfigs[existingIndex] = config;
                    } else {
                        allConfigs.push(config);
                    }
                });
                return {
                    ...state,
                    loading: false,
                    entities: allConfigs,
                };
            })
            .addMatcher(isFulfilled(getEndpointConfig), (state, action) => {
                const { data } = action.payload;
                return {
                    ...state,
                    loading: false,
                    entity: data,
                };
            })
            .addMatcher(isPending(getProjectEndpointConfigs, getEndpointConfig), (state) => {
                state.loading = true;
            });
    },
});

// Reducer
export default EndpointConfigSlice.reducer;
export const {
    toggleAddModelModal,
    toggleEditVariantModal,
    setSelectedVariant,
    clearEndpointConfigs,
} = EndpointConfigSlice.actions;
