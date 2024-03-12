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

import axios, { setProjectHeader } from '../../../shared/util/axios-utils';
import { createSlice, createAsyncThunk, isFulfilled, isPending } from '@reduxjs/toolkit';
import { LoadingStatus } from '../../../shared/loading-status';
import { IHPOJob } from './hpo-job.model';
import { JobNameAndProject } from '../job.model';
import { addPagingParams } from '../../../shared/util/url-utils';
import { ServerRequestProps, PagedResponsePayload } from '../../../shared/util/table-utils';
import { cloneDeep } from 'lodash';
import { HPOJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

const initialState = {
    jobs: [] as HPOJobResourceMetadata[],
    loadingJobsList: false,
    detail: {
        status: LoadingStatus.INITIAL,
        value: null,
    },
    loadingHPOJob: false,
};

export type CreateHPOJobThunkPayload = {
    ProjectName: string;
    UserName: string;
    HPOJobDefinition: IHPOJob;
};

// Actions
export const createHPOJobThunk = createAsyncThunk(
    'jobs/hpo/create',
    async (hpoJob: CreateHPOJobThunkPayload) => {
        return axios
            .post('/job/hpo', hpoJob, setProjectHeader(hpoJob.ProjectName))
            .then((response) => response.data)
            .catch((reason) => {
                return {
                    error: true,
                    reason: reason.response.data,
                };
            });
    }
);

export const describeHPOJob = createAsyncThunk('jobs/hpo/describe', async (hpoJobName: string) => {
    return axios.get(`/job/hpo/${hpoJobName}`).then((response) => response.data);
});

export const stopHPOJob = createAsyncThunk(
    'jobs/hpo/stop',
    async ({ jobName, projectName }: JobNameAndProject) => {
        return axios
            .post(`/job/hpo/${jobName}/stop`, undefined, setProjectHeader(projectName))
            .then((response) => response.data);
    }
);

export const describeHPOJobChildren = createAsyncThunk(
    'jobs/hpo/describe',
    async (hpoJobName: string) => {
        return axios
            .get(`/job/hpo/${hpoJobName}/training-jobs`)
            .then((response) => response.data.TrainingJobSummaries);
    }
);

export const listHPOJobs = createAsyncThunk('jobs/hpo/list', async (params: ServerRequestProps) => {
    const requestUrl = `/project/${params.projectName}/jobs/hpo`;
    return axios.get<PagedResponsePayload<HPOJobResourceMetadata>>(
        addPagingParams(requestUrl, params)
    );
});

// Slice
export const HPOJobsSlice = createSlice({
    name: 'hpo',
    initialState,
    reducers: {
        clearHPOJobs (state) {
            state.jobs.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(listHPOJobs), (state, action) => {
                const { data } = action.payload;
                const allJobs = cloneDeep(state.jobs);
                data.records.forEach((hpoJob: HPOJobResourceMetadata) => {
                    const existingIndex = allJobs.findIndex(
                        (j) => j.resourceId === hpoJob.resourceId
                    );
                    if (existingIndex > -1) {
                        allJobs[existingIndex] = hpoJob;
                    } else {
                        allJobs.push(hpoJob);
                    }
                });
                return {
                    ...state,
                    jobs: allJobs,
                    loadingJobsList: false,
                };
            })
            .addMatcher(isPending(listHPOJobs), (state) => {
                return {
                    ...state,
                    loadingJobsList: true,
                };
            })
            .addMatcher(isFulfilled(describeHPOJob), (state) => {
                return {
                    ...state,
                    loadingHPOJob: false,
                };
            })
            .addMatcher(isPending(describeHPOJob), (state) => {
                return {
                    ...state,
                    loadingHPOJob: true,
                };
            });
    },
});

// Reducer
export const selectHPOJobs = (state: any) => state.jobs.hpo.jobs;
export const loadingJobs = (state: any) => state.jobs.hpo.loadingJobsList;
export const loadingHPOJob = (state: any) => state.jobs.hpo.loadingHPOJob;

export const { clearHPOJobs } = HPOJobsSlice.actions;

export default HPOJobsSlice.reducer;
