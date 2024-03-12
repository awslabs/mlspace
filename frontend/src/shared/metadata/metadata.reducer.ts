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

import { createSlice, createAsyncThunk, isPending, isFulfilled } from '@reduxjs/toolkit';
import { LoadingStatus } from '../loading-status';
import axios from '../util/axios-utils';
import { Subnet } from '../model/vpc.config';

const initialState = {
    computeTypes: {
        status: LoadingStatus.INITIAL,
        values: {},
    },
    subnets: {
        status: LoadingStatus.INITIAL,
        values: [] as Subnet[],
    },
};

export const listComputeTypes = createAsyncThunk('metadata/listComputeTypes', async () => {
    return axios.get('/metadata/compute-types').then((response) => response.data);
});

export const listSubnets = createAsyncThunk('metadata/listSubnets', async () => {
    return axios.get('/metadata/subnets').then((response) => response.data);
});

export const MetadataSlice = createSlice({
    name: 'metadata',
    initialState,
    reducers: {},
    extraReducers (builder) {
        builder
            .addMatcher(isPending(listComputeTypes), (state) => {
                return { ...state, computeTypes: { status: LoadingStatus.PENDING, values: {} } };
            })
            .addMatcher(isPending(listSubnets), (state) => {
                return { ...state, subnets: { status: LoadingStatus.PENDING, values: [] } };
            })
            .addMatcher(isFulfilled(listComputeTypes), (state, action) => {
                return {
                    ...state,
                    computeTypes: { status: LoadingStatus.FULFILLED, values: action.payload },
                };
            })
            .addMatcher(isFulfilled(listSubnets), (state, action) => {
                return {
                    ...state,
                    subnets: { status: LoadingStatus.FULFILLED, values: action.payload },
                };
            });
    },
});

export const selectSubnets = (state: any) => state.metadata.subnets;
export const selectComputeTypes = (state: any) => state.metadata.computeTypes;

export default MetadataSlice.reducer;
