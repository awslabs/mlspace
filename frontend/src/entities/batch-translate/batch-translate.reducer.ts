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
    isRejected,
    PayloadAction,
} from '@reduxjs/toolkit';
import axios, { setProjectHeader } from '../../shared/util/axios-utils';
import { PagedResponsePayload, ServerRequestProps } from '../../shared/util/table-utils';
import { cloneDeep } from 'lodash';
import { addPagingParams } from '../../shared/util/url-utils';
import { defaultBatchJob, IBatchTranslate } from '../../shared/model/translate.model';
import { BatchTranslateResourceMetadata } from '../../shared/model/resource-metadata.model';

const initialState = {
    loadingBatchTranslateJob: false,
    loadingBatchTranslateJobList: false,
    batchTranslateJobList: [] as BatchTranslateResourceMetadata[],
    batchTranslateJob: defaultBatchJob,
    responseText: undefined,
};

// Actions
export const listBatchTranslateJobs = createAsyncThunk(
    'batch-translate/list',
    async (params: ServerRequestProps) => {
        const requestUrl = `/project/${params.projectName}/batch-translate-jobs`;
        return axios.get<PagedResponsePayload<BatchTranslateResourceMetadata>>(
            addPagingParams(requestUrl, params)
        );
    }
);

export const describeBatchTranslateJob = createAsyncThunk(
    'batch-translate/describe',
    async (jobId: string) => {
        const requestUrl = `batch-translate/${jobId}`;
        return axios.get<IBatchTranslate>(requestUrl);
    }
);

export const createBatchTranslateJob = createAsyncThunk(
    'batch-translate/create',
    async ({ batchTranslateJob, projectName }: BatchTranslateProps, { rejectWithValue }) => {
        const requestUrl = '/batch-translate';
        const payload: any = {
            JobName: batchTranslateJob.JobName,
            ProjectName: projectName,
            InputDataConfig: batchTranslateJob.InputDataConfig,
            OutputDataConfig: batchTranslateJob.OutputDataConfig,
            SourceLanguageCode: batchTranslateJob.SourceLanguageCode,
            TargetLanguageCodes: batchTranslateJob.TargetLanguageCodes,
            TerminologyNames: batchTranslateJob.TerminologyNames,
            Settings: batchTranslateJob.Settings,
        };

        try {
            const response = await axios.post<IBatchTranslate>(
                requestUrl,
                payload,
                setProjectHeader(projectName)
            );
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.response.data);
        }
    }
);

export const stopBatchTranslateJob = createAsyncThunk(
    'batch-translate/stop',
    async (jobId: string) => {
        const requestUrl = `/batch-translate/${jobId}/stop`;
        return axios.post<IBatchTranslate>(requestUrl);
    }
);

export const BatchTranslateSlice = createSlice({
    name: 'batchTranslateJob',
    initialState,
    reducers: {
        updateEntity (state, action: PayloadAction<IBatchTranslate>) {
            state.batchTranslateJob = action.payload;
        },
        clearBatchTranslateJobList (state) {
            state.batchTranslateJobList.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(listBatchTranslateJobs), (state, action) => {
                const { data } = action.payload;
                if (state.batchTranslateJobList) {
                    const allBatchTranslateJobs = cloneDeep(state.batchTranslateJobList);
                    data.records.forEach((batchTranslateJob: BatchTranslateResourceMetadata) => {
                        const existingIndex = allBatchTranslateJobs.findIndex(
                            (b) => b.resourceId === batchTranslateJob.resourceId
                        );
                        if (existingIndex > -1) {
                            allBatchTranslateJobs[existingIndex] = batchTranslateJob;
                        } else {
                            allBatchTranslateJobs.push(batchTranslateJob);
                        }
                    });
                    return {
                        ...state,
                        loadingBatchTranslateJobList: false,
                        batchTranslateJobList: allBatchTranslateJobs,
                    };
                }
            })
            .addMatcher(isFulfilled(describeBatchTranslateJob), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    loadingBatchTranslateJob: false,
                    batchTranslateJob: data.TextTranslationJobProperties,
                };
            })
            .addMatcher(isFulfilled(createBatchTranslateJob, stopBatchTranslateJob), (state) => {
                return {
                    ...state,
                    loadingAction: false,
                };
            })
            .addMatcher(isPending(createBatchTranslateJob, stopBatchTranslateJob), (state) => {
                return {
                    ...state,
                    loadingAction: true,
                };
            })
            .addMatcher(isPending(describeBatchTranslateJob), (state) => {
                return {
                    ...state,
                    loadingBatchTranslateJob: true,
                };
            })
            .addMatcher(isPending(listBatchTranslateJobs), (state) => {
                return {
                    ...state,
                    loadingBatchTranslateJobList: true,
                };
            })
            .addMatcher(
                isRejected(
                    listBatchTranslateJobs,
                    describeBatchTranslateJob,
                    createBatchTranslateJob,
                    stopBatchTranslateJob
                ),
                (state, action: any) => {
                    let data: any = undefined;
                    if (action.payload) {
                        data = action.payload;
                    }
                    return {
                        ...state,
                        loadingBatchTranslateJob: false,
                        loadingAction: false,
                        responseText: data,
                    };
                }
            );
    },
});

// Interfaces
type BatchTranslateProps = {
    projectName: string;
    batchTranslateJob: IBatchTranslate;
};

// Reducer
export default BatchTranslateSlice.reducer;
export const { updateEntity, clearBatchTranslateJobList } = BatchTranslateSlice.actions;
export const loadingBatchTranslateJob = (state: any) =>
    state.batchTranslateJob.loadingBatchTranslateJob;
export const loadingBatchTranslateJobList = (state: any) =>
    state.batchTranslateJob.loadingBatchTranslateJobList;
export const batchTranslateJobList = (state: any) =>
    state.batchTranslateJob.batchTranslateJobList || [];
export const selectedBatchTranslateJob = (state: any) => state.batchTranslateJob.batchTranslateJob;
