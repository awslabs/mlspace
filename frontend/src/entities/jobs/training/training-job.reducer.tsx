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
    createSlice,
    createAsyncThunk,
    isFulfilled,
    isPending,
    isRejected,
} from '@reduxjs/toolkit';
import { LoadingStatus } from '../../../shared/loading-status';
import axios, { setProjectHeader } from '../../../shared/util/axios-utils';
import { PagedResponsePayload, ServerRequestProps } from '../../../shared/util/table-utils';
import { ITrainingJob } from './training-job.model';
import { addPagingParams } from '../../../shared/util/url-utils';
import { cloneDeep } from 'lodash';
import { TrainingJobResourceMetadata } from '../../../shared/model/resource-metadata.model';
import {arnStringToObject} from '../../../shared/util/arn-utils';

const initialState = {
    job: {} as ITrainingJob,
    jobs: [] as TrainingJobResourceMetadata[],
    images: {
        status: LoadingStatus.INITIAL,
        values: {},
    },
    loadingTrainingJobs: false,
    responseText: undefined,
    loadingDetails: false,
};

// Actions
export const createTrainingJob = createAsyncThunk(
    'jobs/training/create',
    async (trainingJob: any, { rejectWithValue }) => {
        try {
            const response = await axios.post<any>(
                '/job/training',
                trainingJob,
                setProjectHeader(trainingJob.ProjectName)
            );
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.response.data);
        }
    }
);

export const listTrainingJobs = createAsyncThunk(
    'jobs/training/list',
    async (params: ServerRequestProps) => {
        const requestUrl = `project/${params.projectName}/jobs/training`;
        return axios.get<PagedResponsePayload<TrainingJobResourceMetadata>>(
            addPagingParams(requestUrl, params)
        );
    }
);

export const describeTrainingJob = createAsyncThunk(
    'jobs/training/detail',
    async (trainingJobName: string) => {
        const response : ITrainingJob = await axios.get(`job/training/${trainingJobName}`).then((response) => response.data);

        // Create the TuningJobName from the TuningJobArn
        if (response.TuningJobArn){
            response.TuningJobName = arnStringToObject(response.TuningJobArn).resourceId;
        }
        return response;
    }
);

export const listBuiltinTrainingImages = createAsyncThunk('jobs/training/images', async () => {
    return axios.get('/model/images?imageScope=training').then((response) => response.data);
});

// Slice
export const TrainingJobsSlice = createSlice({
    name: 'training',
    initialState,
    reducers: {
        clearTrainingJobs (state) {
            state.jobs.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isPending(listTrainingJobs), (state) => {
                return {
                    ...state,
                    loadingTrainingJobs: true,
                };
            })
            .addMatcher(isRejected(createTrainingJob), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    responseText: data,
                };
            })
            .addMatcher(isFulfilled(listTrainingJobs), (state, action) => {
                const { data } = action.payload;
                const allJobs = cloneDeep(state.jobs);
                data.records.forEach((trainingJob: TrainingJobResourceMetadata) => {
                    const existingIndex = allJobs.findIndex(
                        (j) => j.metadata.TrainingJobArn === trainingJob.metadata.TrainingJobArn
                    );
                    if (existingIndex > -1) {
                        allJobs[existingIndex] = trainingJob;
                    } else {
                        allJobs.push(trainingJob);
                    }
                });

                return {
                    ...state,
                    jobs: allJobs,
                    loadingTrainingJobs: false,
                };
            })
            .addMatcher(isPending(listBuiltinTrainingImages), (state) => {
                return {
                    ...state,
                    images: {
                        ...state.images,
                        status: LoadingStatus.PENDING,
                    },
                };
            })
            .addMatcher(isFulfilled(listBuiltinTrainingImages), (state, action: any) => {
                return {
                    ...state,
                    images: {
                        values: action.payload,
                        status: LoadingStatus.FULFILLED,
                    },
                };
            })
            .addMatcher(isFulfilled(describeTrainingJob), (state, action) => {
                return {
                    ...state,
                    job: action.payload,
                    loadingDetails: false,
                };
            })
            .addMatcher(isPending(describeTrainingJob), (state) => {
                return {
                    ...state,
                    loadingDetails: true,
                };
            });
    },
});

// Reducer
export const selectTrainingJob = (state: any) => state.jobs.training.job;
export const selectBuiltinTrainingImages = (state: any) => state.jobs.training.images;
export const loadingTrainingJobDetails = (state: any) => state.jobs.training.loadingDetails;
export const loadingTrainingJobs = (state: any) => state.jobs.training.loadingTrainingJobs;

export const { clearTrainingJobs } = TrainingJobsSlice.actions;

export default TrainingJobsSlice.reducer;
