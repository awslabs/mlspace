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
import { defaultNotebook, IEMRBackedNotebook, INotebook } from '../../shared/model/notebook.model';
import axios, { setProjectHeader } from '../../shared/util/axios-utils';
import { PagedResponsePayload, ServerRequestProps } from '../../shared/util/table-utils';
import { NotebookResourceMetadata } from '../../shared/model/resource-metadata.model';
import { cloneDeep } from 'lodash';
import { addPagingParams } from '../../shared/util/url-utils';

const initialState = {
    loadingNotebookInstance: false,
    loadingNotebookList: false,
    notebookList: [] as NotebookResourceMetadata[],
    notebook: defaultNotebook,
    responseText: undefined,
    lifecycleConfigs: [] as string[],
    loadingNotebookOptions: false,
    loadingAction: false,
};

type NotebookNameAndProjectName = {
    notebookName: string;
    projectName: string;
};

// Actions

export const listNotebookInstances = createAsyncThunk(
    'notebook/list_resources',
    async (params: ServerRequestProps) => {
        let requestUrl = '/notebook';
        if (params.projectName) {
            requestUrl = `/project/${params.projectName}/notebooks`;
        }
        return axios.get<PagedResponsePayload<NotebookResourceMetadata>>(
            addPagingParams(requestUrl, params)
        );
    }
);

export const describeNotebookInstance = createAsyncThunk(
    'notebook/describe',
    async (notebookInstanceName: string) => {
        const requestUrl = `/notebook/${notebookInstanceName}`;
        return axios.get<INotebook>(requestUrl);
    }
);

export const createNotebookInstance = createAsyncThunk(
    'notebook/create',
    async ({ notebookInstance, projectName }: NotebookProps, { rejectWithValue }) => {
        const requestUrl = '/notebook';
        const payload: any = {
            NotebookInstanceName: notebookInstance.NotebookInstanceName,
            ProjectName: projectName,
            InstanceType: notebookInstance.InstanceType,
            VolumeSizeInGB: notebookInstance.VolumeSizeInGB,
            NotebookInstanceLifecycleConfigName:
                notebookInstance.NotebookInstanceLifecycleConfigName,
            NotebookDailyStopTime: notebookInstance.NotebookDailyStopTime,
        };

        if (notebookInstance.clusterId) {
            payload.clusterId = notebookInstance.clusterId;
        }
        try {
            const response = await axios.post<INotebook>(
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

export const startNotebookInstance = createAsyncThunk(
    'notebook/start',
    async ({ notebookName, projectName }: NotebookNameAndProjectName, { rejectWithValue }) => {
        try {
            await axios.post<INotebook>(
                `/notebook/${notebookName}/start`,
                undefined,
                setProjectHeader(projectName)
            );
        } catch (err: any) {
            return rejectWithValue(err.response.data);
        }
    }
);

export const stopNotebookInstance = createAsyncThunk(
    'notebook/stop',
    async ({ notebookName, projectName}: NotebookNameAndProjectName, { rejectWithValue }) => {
        try {
            await axios.post<INotebook>(
                `/notebook/${notebookName}/stop`,
                undefined,
                setProjectHeader(projectName)
            );
        } catch (err: any) {
            return rejectWithValue(err.response.data);
        }
    }
);

export const updateNotebookInstance = createAsyncThunk(
    'notebook/edit',
    async (notebookInstance: INotebook & IEMRBackedNotebook, { rejectWithValue }) => {
        const requestUrl = `/notebook/${notebookInstance.NotebookInstanceName}`;
        const payload: any = {
            NotebookInstanceName: notebookInstance.NotebookInstanceName,
            InstanceType: notebookInstance.InstanceType,
            NotebookInstanceLifecycleConfigName:
                notebookInstance.NotebookInstanceLifecycleConfigName,
            VolumeSizeInGB: notebookInstance.VolumeSizeInGB,
            NotebookDailyStopTime: notebookInstance.NotebookDailyStopTime,
        };
        if (notebookInstance.clusterId) {
            payload.clusterId = notebookInstance.clusterId;
        }
        try {
            const response = await axios.put<INotebook>(requestUrl, payload);
            return response.data;
        } catch (err: any) {
            return rejectWithValue(err.response.data);
        }
    }
);

export const deleteNotebookInstance = createAsyncThunk(
    'notebook/delete',
    async (notebookInstanceName: string) => {
        const requestUrl = `/notebook/${notebookInstanceName}`;
        return axios.delete(requestUrl);
    }
);

export const getNotebookOptions = createAsyncThunk('notebook/options', async () => {
    return axios.get<string[]>('/metadata/notebook-options');
});

export const NotebookSlice = createSlice({
    name: 'notebook',
    initialState,
    reducers: {
        updateEntity (state, action: PayloadAction<INotebook>) {
            state.notebook = action.payload;
        },
        clearNotebookList (state) {
            state.notebookList.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(listNotebookInstances), (state, action) => {
                const { data } = action.payload;
                if (state.notebookList) {
                    const allNotebooks = cloneDeep(state.notebookList);
                    data.records.forEach((notebook: NotebookResourceMetadata) => {
                        const existingIndex = allNotebooks.findIndex(
                            (n) =>
                                n.metadata.NotebookInstanceArn ===
                                notebook.metadata.NotebookInstanceArn
                        );
                        if (existingIndex > -1) {
                            allNotebooks[existingIndex] = notebook;
                        } else {
                            allNotebooks.push(notebook);
                        }
                    });
                    return {
                        ...state,
                        loadingNotebookList: false,
                        notebookList: allNotebooks,
                    };
                }
            })
            .addMatcher(isFulfilled(describeNotebookInstance), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    loadingNotebookInstance: false,
                    notebook: data,
                };
            })
            .addMatcher(isFulfilled(getNotebookOptions), (state, action: any) => {
                const { lifecycleConfigs }: any = action.payload.data;
                return {
                    ...state,
                    loadingNotebookOptions: false,
                    lifecycleConfigs: lifecycleConfigs,
                };
            })
            .addMatcher(
                isFulfilled(
                    startNotebookInstance,
                    stopNotebookInstance,
                    deleteNotebookInstance,
                    createNotebookInstance
                ),
                (state) => {
                    return {
                        ...state,
                        loadingAction: false,
                    };
                }
            )
            .addMatcher(
                isPending(
                    startNotebookInstance,
                    stopNotebookInstance,
                    deleteNotebookInstance,
                    createNotebookInstance
                ),
                (state) => {
                    return {
                        ...state,
                        loadingAction: true,
                    };
                }
            )
            .addMatcher(isPending(describeNotebookInstance), (state) => {
                return {
                    ...state,
                    loadingNotebookInstance: true,
                };
            })
            .addMatcher(isPending(listNotebookInstances), (state) => {
                return {
                    ...state,
                    loadingNotebookList: true,
                };
            })
            .addMatcher(isPending(getNotebookOptions), (state) => {
                return {
                    ...state,
                    loadingNotebookOptions: true,
                };
            })
            .addMatcher(
                isRejected(
                    updateNotebookInstance,
                    getNotebookOptions,
                    listNotebookInstances,
                    describeNotebookInstance,
                    startNotebookInstance,
                    stopNotebookInstance,
                    deleteNotebookInstance,
                    createNotebookInstance
                ),
                (state, action: any) => {
                    let data: any = undefined;
                    if (action.payload) {
                        data = action.payload;
                    }
                    return {
                        ...state,
                        loadingNotebookInstance: false,
                        loadingAction: false,
                        responseText: data,
                        loadingNotebookOptions: false,
                        loadingNotebookList: false,
                    };
                }
            );
    },
});

// Interfaces
export type NotebookProps = {
    projectName: string;
    notebookInstance: INotebook & IEMRBackedNotebook;
};

export type NotebookStartProps = {
    notebookInstanceName: string;
    projectName: string;
};

// Reducer
export default NotebookSlice.reducer;
export const { updateEntity, clearNotebookList } = NotebookSlice.actions;
export const notebookLifecycleConfigs = (state: any) => state.notebook.lifecycleConfigs;
export const loadingNotebookOptions = (state: any) => state.notebook.loadingNotebookOptions;
export const loadingNotebookInstance = (state: any) => state.notebook.loadingNotebookInstance;
export const loadingNotebookList = (state: any) => state.notebook.loadingNotebookList;
export const notebookList = (state: any) => state.notebook.notebookList || [];
export const notebookInstance = (state: any) => state.notebook.notebook;
export const loadingNotebookAction = (state: any) => state.notebook.loadingAction;
