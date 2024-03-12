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

import { createSlice, createAsyncThunk, isFulfilled, isPending } from '@reduxjs/toolkit';
import axios, { setProjectHeader } from '../../../shared/util/axios-utils';
import { ILabelingJob, ILabelingJobCreate, ILabelingJobWorkteam } from './labeling-job.model';
import { LabelingJobResourceMetadata } from '../../../shared/model/resource-metadata.model';
import { PagedResponsePayload, ServerRequestProps } from '../../../shared/util/table-utils';
import { addPagingParams } from '../../../shared/util/url-utils';
import { cloneDeep } from 'lodash';
import { ILabelingJobLabel } from './create/labeling-job-create';

const initialState = {
    job: {} as ILabelingJob,
    jobs: [] as LabelingJobResourceMetadata[],
    teams: [] as ILabelingJobWorkteam[],
    loadingLabelingJobs: false,
    loadingDetails: false,
    loadingTeams: false,
};

export type CreateLabelingJobThunkPayload = {
    ProjectName: string;
    TaskType: string;
    Labels: ILabelingJobLabel[];
    ShortInstruction: string;
    FullInstruction: string;
    Description: string;
    JobDefinition: ILabelingJobCreate;
};

// Actions
export const createLabelingJobThunk = createAsyncThunk(
    'jobs/labeling/create',
    async (labelingJob: CreateLabelingJobThunkPayload) => {
        return axios
            .post('/job/labeling', labelingJob, setProjectHeader(labelingJob.ProjectName))
            .then((response) => response.data)
            .catch((reason) => {
                return {
                    error: true,
                    reason: reason.response.data,
                };
            });
    }
);

export const describeLabelingJob = createAsyncThunk(
    'jobs/labeling/detail',
    async (labelingJobName: string) => {
        return axios.get(`job/labeling/${labelingJobName}`).then((response) => response.data);
    }
);

export const listLabelingJobs = createAsyncThunk(
    'jobs/labeling/list',
    async (params: ServerRequestProps) => {
        const requestUrl = `project/${params.projectName}/jobs/labeling`;
        return axios.get<PagedResponsePayload<LabelingJobResourceMetadata>>(
            addPagingParams(requestUrl, params)
        );
    }
);

export const listLabelingWorkTeams = createAsyncThunk(
    'jobs/labeling/teams',
    async (projectName: string) => {
        const requestUrl = `project/${projectName}/jobs/labeling/teams`;
        return axios.get<ILabelingJobWorkteam[]>(requestUrl);
    }
);

// Slice
export const LabelingJobsSlice = createSlice({
    name: 'labeling',
    initialState,
    reducers: {
        clearLabelingJobs (state) {
            state.jobs.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(describeLabelingJob), (state, action) => {
                return {
                    ...state,
                    job: action.payload,
                    loadingDetails: false,
                };
            })
            .addMatcher(isPending(describeLabelingJob), (state) => {
                return {
                    ...state,
                    loadingDetails: true,
                };
            })
            .addMatcher(isFulfilled(listLabelingJobs), (state, action) => {
                const { data } = action.payload;
                const allJobs = cloneDeep(state.jobs);
                data.records.forEach((labelingJob: LabelingJobResourceMetadata) => {
                    const existingIndex = allJobs.findIndex(
                        (j) => j.metadata.LabelingJobArn === labelingJob.metadata.LabelingJobArn
                    );
                    if (existingIndex > -1) {
                        allJobs[existingIndex] = labelingJob;
                    } else {
                        allJobs.push(labelingJob);
                    }
                });

                return {
                    ...state,
                    jobs: allJobs,
                    loadingLabelingJobs: false,
                };
            })
            .addMatcher(isPending(listLabelingJobs), (state) => {
                return {
                    ...state,
                    loadingLabelingJobs: true,
                };
            })
            .addMatcher(isFulfilled(listLabelingWorkTeams), (state, action) => {
                const { data } = action.payload;

                return {
                    ...state,
                    teams: data,
                    loadingTeams: false,
                };
            })
            .addMatcher(isPending(listLabelingWorkTeams), (state) => {
                return {
                    ...state,
                    loadingTeams: true,
                };
            });
    },
});

export const selectLabelingJob = (state: any) => state.jobs.labeling.job;
export const loadingLabelingJobDetails = (state: any) => state.jobs.labeling.loadingDetails;
export const loadingLabelingJobs = (state: any) => state.jobs.training.loadingLabelingJobs;
export const loadingLabelingWorkTeams = (state: any) =>
    state.jobs.labeling.loadingLabelingWorkTeams;
export const selectLabelingWorkTeams = (state: any) => state.jobs.labeling.teams;

export const { clearLabelingJobs } = LabelingJobsSlice.actions;

export default LabelingJobsSlice.reducer;
