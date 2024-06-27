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

import axios from '../../shared/util/axios-utils';
import { createSlice, createAsyncThunk, isFulfilled, isPending, isRejected } from '@reduxjs/toolkit';
import { EMRCluster } from './emr.model';
import { PagedResponsePayload, ServerRequestProps } from '../../shared/util/table-utils';
import { addPagingParams } from '../../shared/util/url-utils';
import { cloneDeep } from 'lodash';
import { EMRResourceMetadata } from '../../shared/model/resource-metadata.model';

const initialState = {
    clusters: [] as EMRResourceMetadata[],
    cluster: {} as EMRCluster,
    applications: [] as string[],
    releaseLabels: [] as string[],
    loadingCluster: true,
    loadingClusters: false,
    loadingApplications: false,
    loadingReleaseLabels: false,
    selectClusterModalVisible: false,
};

export const createEMRCluster = createAsyncThunk(
    'emr/create',
    async (
        params: {
            projectName: string;
            environment_options: any;
        },
        { rejectWithValue }
    ) => {
        const { projectName, environment_options } = params;
        try {
            const response = await axios.post(`/project/${projectName}/emr`, environment_options);
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.response.data);
        }
    }
);

export const listEMRClusters = createAsyncThunk('emr/list', async (params: ServerRequestProps) => {
    return axios.get<PagedResponsePayload<EMRResourceMetadata>>(
        addPagingParams(`/project/${params.projectName}/emr`, params)
    );
});

export const listEMRApplications = createAsyncThunk(
    'emr/applications',
    async () => {
        return await axios.get<string[]>('/emr/applications');
    }
);

export const listEMRReleaseLabels = createAsyncThunk(
    'emr/release',
    async () => {
        return await axios.get<ListEMRReleaseLabelsProps>('/emr/release');
    }
);

export const getEMRCluster = createAsyncThunk('emr/get_cluster', async (clusterId: string) => {
    const response = await axios.get(`/emr/${clusterId}`);
    return response.data;
});

export const terminateEMRCluster = createAsyncThunk('emr/terminate', async (clusterId: string) => {
    const response = await axios.delete(`/emr/${clusterId}`);
    return response.data;
});

export const EMRClusterSlice = createSlice({
    name: 'emr',
    initialState,
    reducers: {
        toggleSelectClusterModal (state, action) {
            state.selectClusterModalVisible = action.payload;
        },
        clearClustersList (state) {
            state.clusters.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(listEMRClusters), (state, action) => {
                const { data } = action.payload;
                if (state.clusters) {
                    const allClusters = cloneDeep(state.clusters);
                    data.records.forEach((cluster: EMRResourceMetadata) => {
                        const existingIndex = allClusters.findIndex((c) => c.resourceId === cluster.resourceId);
                        if (existingIndex > -1) {
                            allClusters[existingIndex] = cluster;
                        } else {
                            allClusters.push(cluster);
                        }
                    });
                    return {
                        ...state,
                        loadingClusters: false,
                        clusters: allClusters,
                    };
                }
            })
            .addMatcher(isFulfilled(getEMRCluster), (state, action) => {
                return {
                    ...state,
                    loadingCluster: false,
                    cluster: {
                        ...action.payload.Cluster,
                        TerminationTime: action.payload.TerminationTime,
                    },
                };
            })
            .addMatcher(isFulfilled(listEMRApplications), (state, action) => {
                return {
                    ...state,
                    loadingApplications: false,
                    applications: action.payload.data,
                };
            })
            .addMatcher(isFulfilled(listEMRReleaseLabels), (state, action) => {
                return {
                    ...state,
                    loadingReleaseLabels: false,
                    releaseLabels: action.payload.data.ReleaseLabels,
                };
            })
            .addMatcher(isPending(getEMRCluster), (state) => {
                return {
                    ...state,
                    loadingCluster: true,
                };
            })
            .addMatcher(isRejected(getEMRCluster), (state) => {
                return {
                    ...state,
                    loadingCluster: true, // Continue loading until a call goes through
                    cluster: {} as EMRCluster,
                };
            })
            .addMatcher(isPending(listEMRClusters), (state) => {
                return {
                    ...state,
                    loadingClusters: true,
                };
            })
            .addMatcher(isPending(listEMRApplications), (state) => {
                return {
                    ...state,
                    loadingApplications: true,
                };
            })
            .addMatcher(isPending(listEMRReleaseLabels), (state) => {
                return {
                    ...state,
                    loadingReleaseLabels: true,
                };
            });

    },
});


type ListEMRReleaseLabelsProps = {
    ReleaseLabels: string[];
};


export const { toggleSelectClusterModal, clearClustersList } = EMRClusterSlice.actions;
export const selectEMRClusters = (state: any) => state.emr.clusters;
export const selectedEMRCluster = (state: any) => state.emr.cluster;
export const emrApplications = (state: any) => state.emr.applications;
export const emrReleaseLabels = (state: any) => state.emr.releaseLabels;
export const loadingReleaseLabels = (state: any) => state.emr.loadingReleaseLabels;
export const loadingCluster = (state: any) => state.emr.loadingCluster;
export const loadingClustersList = (state: any) => state.emr.loadingClusters;

export default EMRClusterSlice.reducer;
