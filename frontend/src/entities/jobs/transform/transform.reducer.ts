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
import { defaultValue, ITransform } from '../../../shared/model/transform.model';
import axios, { setProjectHeader } from '../../../shared/util/axios-utils';
import { addPagingParams } from '../../../shared/util/url-utils';
import { cloneDeep } from 'lodash';
import { ServerRequestProps, PagedResponsePayload } from '../../../shared/util/table-utils';
import { TransformJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

const initialState = {
    jobs: [] as TransformJobResourceMetadata[],
    job: defaultValue as ITransform,
    loadingTransformJobDetails: false,
    loadingTransformJobs: false,
};

// Actions

export const getBatchTransformJobs = createAsyncThunk(
    'transform_job/list_resources',
    async (params: ServerRequestProps) => {
        const requestUrl = `/project/${params.projectName}/jobs/transform`;
        return axios.get<PagedResponsePayload<TransformJobResourceMetadata>>(
            addPagingParams(requestUrl, params)
        );
    }
);

export const createBatchTransformJob = async (transform: ITransform) => {
    return axios.post('/job/transform', transform, setProjectHeader(transform.ProjectName));
};

export const describeBatchTransformJob = createAsyncThunk(
    'transform_job/describe',
    async (transformJobName: string | undefined) => {
        return axios.get(`/job/transform/${transformJobName}`);
    }
);

// slice

export const BatchTransformJobSlice = createSlice({
    name: 'transform',
    initialState,
    reducers: {
        clearTransformJobs (state) {
            state.jobs.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(getBatchTransformJobs), (state, action) => {
                const { data } = action.payload;
                const allTransformJobs = cloneDeep(state.jobs);
                data.records.forEach((job: TransformJobResourceMetadata) => {
                    const existingIndex = allTransformJobs.findIndex(
                        (t) => t.metadata.TransformJobArn === job.metadata.TransformJobArn
                    );
                    if (existingIndex > -1) {
                        allTransformJobs[existingIndex] = job;
                    } else {
                        allTransformJobs.push(job);
                    }
                });
                return {
                    ...state,
                    jobs: allTransformJobs,
                    loadingTransformJobs: false,
                };
            })
            .addMatcher(isPending(getBatchTransformJobs), (state) => {
                return {
                    ...state,
                    loadingTransformJobs: true,
                };
            })
            .addMatcher(
                isFulfilled(describeBatchTransformJob),
                (state, action: PayloadAction<ITransform>) => {
                    const { data } = action.payload;
                    data.duration = getDurationText(
                        data.CreationTime,
                        data.TransformStartTime,
                        data.TransformEndTime
                    );
                    return {
                        ...state,
                        job: data,
                        loadingTransformJobDetails: false,
                    };
                }
            )
            .addMatcher(isPending(describeBatchTransformJob), (state) => {
                return {
                    ...state,
                    loadingTransformJobDetails: true,
                };
            });
    },
});

export const getDurationText = (createTime: string, startTime?: string, endTime?: string) => {
    let duration = 0;
    let durationText = '';

    if (endTime && (createTime || startTime)) {
        duration = (Date.parse(endTime) - Date.parse(startTime || createTime)) / 1000;
    } else if (startTime) {
        duration = (Date.now() - Date.parse(startTime)) / 1000;
    } else if (createTime) {
        duration = (Date.now() - Date.parse(createTime)) / 1000;
    }

    if (duration % 60 > 0) {
        durationText = `${Math.round(duration / 60)} minutes`;
    } else {
        durationText = `${Math.round(duration)} seconds`;
    }

    return durationText;
};

// Reducer
export default BatchTransformJobSlice.reducer;
export const { clearTransformJobs } = BatchTransformJobSlice.actions;
export const loadingTransformJobsList = (state: any) => state.jobs.transform.loadingTransformJobs;
export const loadingTransformJobDetails = (state: any) =>
    state.jobs.transform.loadingTransformJobDetails;
