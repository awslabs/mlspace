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
import { defaultValue, IEndpoint, normalizeEndpointMetadataStatus } from '../../shared/model/endpoint.model';
import { defaultEndpointConfig, IEndpointConfig } from '../../shared/model/endpoint-config.model';
import axios, { setProjectHeader } from '../../shared/util/axios-utils';
import { ServerRequestProps, PagedResponsePayload } from '../../shared/util/table-utils';
import { addPagingParams } from '../../shared/util/url-utils';
import { cloneDeep } from 'lodash';
import { EndpointResourceMetadata } from '../../shared/model/resource-metadata.model';

type IEndpointState = {
    loading: boolean;
    errorMessage: string | null;
    entities: ReadonlyArray<EndpointResourceMetadata>;
    entity: IEndpoint;
    selectedEntity?: IEndpoint;
    links?: any;
    totalItems?: number;
    endpointConfig: IEndpointConfig;
};

type EndpointAndProject = {
    endpoint: IEndpoint;
    projectName: string;
};

const initialState: IEndpointState = {
    loading: false,
    errorMessage: null,
    entities: [],
    selectedEntity: undefined,
    entity: defaultValue,
    endpointConfig: defaultEndpointConfig,
};

export const getProjectEndpoints = createAsyncThunk(
    'endpoint/fetch_entity_list',
    async (params: ServerRequestProps) => {
        const requestUrl = `/project/${params.projectName}/endpoints`;
        return axios.get<PagedResponsePayload<EndpointResourceMetadata>>(
            addPagingParams(requestUrl, params)
        );
    }
);

export const getEndpoint = createAsyncThunk(
    'endpoint/fetch_entity_by_id',
    async (endpointName: string) => {
        const requestUrl = `endpoint/${endpointName}`;
        const endpoint = await axios.get<IEndpoint>(requestUrl);
        const endpointConfig = await axios.get<IEndpointConfig>(
            `endpoint-config/${endpoint.data.EndpointConfigName}`
        );
        return { endpoint: endpoint.data, endpointConfig: endpointConfig.data };
    }
);

export const createEndpoint = async ({ endpoint, projectName }: EndpointAndProject) => {
    const requestUrl = '/endpoint';
    const payload = {
        ...endpoint,
        ProjectName: projectName,
    };
    return axios.post<IEndpoint>(requestUrl, payload, setProjectHeader(projectName));
};

export const deleteEndpoint = (endpointName: string) => {
    const requestUrl = `endpoint/${endpointName}`;
    return axios.delete(requestUrl);
};

export const EndpointSlice = createSlice({
    name: 'endpoint',
    initialState,
    reducers: {
        clearEndpointsList (state) {
            state.entities.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(getProjectEndpoints), (state, action) => {
                const { data } = action.payload;
                const allEndpoints = cloneDeep(state.entities);
                data.records.forEach((endpoint: EndpointResourceMetadata) => {
                    endpoint.metadata.EndpointStatus = normalizeEndpointMetadataStatus(endpoint.metadata.EndpointStatus);
                    const existingIndex = allEndpoints.findIndex(
                        (e) => e.metadata.EndpointArn === endpoint.metadata.EndpointArn
                    );
                    if (existingIndex > -1) {
                        allEndpoints[existingIndex] = endpoint;
                    } else {
                        allEndpoints.push(endpoint);
                    }
                });
                return {
                    ...state,
                    loading: false,
                    entities: allEndpoints,
                };
            })
            .addMatcher(isFulfilled(getEndpoint), (state, action) => {
                return {
                    ...state,
                    loading: false,
                    entity: action.payload.endpoint,
                    endpointConfig: action.payload.endpointConfig,
                };
            })
            .addMatcher(isPending(getProjectEndpoints, getEndpoint), (state) => {
                state.loading = true;
            });
    },
});

export default EndpointSlice.reducer;
export const { clearEndpointsList } = EndpointSlice.actions;
