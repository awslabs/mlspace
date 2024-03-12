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
import { createSlice, createAsyncThunk, isFulfilled, isPending } from '@reduxjs/toolkit';
import { addPagingParams } from '../../shared/util/url-utils';
import { ILogMessage } from '../../shared/model/log.model';
import { ServerRequestProps, PagedResponsePayload } from '../../shared/util/table-utils';
import { cloneDeep } from 'lodash';

const initialState = {
    logMessages: [] as ILogMessage[],
    loadingLogMessages: false,
};

export const getLogMessages = createAsyncThunk(
    'logMessages',
    async (params: ServerRequestProps) => {
        if (params.logRequestParameters) {
            let requestUrl;
            if (params.logRequestParameters.resourceType === 'job') {
                requestUrl = `/job/${params.logRequestParameters.jobType}/${params.logRequestParameters.resourceName}/logs`;
            } else if (params.logRequestParameters.resourceType === 'NotebookInstances') {
                requestUrl = `/notebook/${params.logRequestParameters.resourceName}/logs`;
            } else {
                requestUrl = `/endpoint/${params.logRequestParameters.resourceName}/logs`;
            }

            return axios.get<PagedResponsePayload<ILogMessage>>(
                addPagingParams(requestUrl, params)
            );
        }
    }
);

export const LogsSlice = createSlice({
    name: 'logs',
    initialState,
    reducers: {
        clearLogMessages (state) {
            state.logMessages.length = 0;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(getLogMessages), (state, action: any) => {
                const { data } = action.payload;
                const allMessages = cloneDeep(state.logMessages);
                (data.events || []).forEach((logMessage: ILogMessage) => {
                    const existingIndex = allMessages.findIndex(
                        (m) => m.eventId === logMessage.eventId
                    );
                    if (existingIndex > -1) {
                        allMessages[existingIndex] = logMessage;
                    } else {
                        allMessages.push(logMessage);
                    }
                });
                return {
                    ...state,
                    logMessages: allMessages,
                    loadingLogMessages: false,
                };
            })
            .addMatcher(isPending(getLogMessages), (state) => {
                return {
                    ...state,
                    loadingLogMessages: true,
                };
            })
            .addMatcher(isFulfilled(getLogMessages), (state) => {
                return {
                    ...state,
                    loadingLogMessages: false,
                };
            });
    },
});

export const logMessages = (state: any) => state.logs.logMessages;
export const loadingLogMessages = (state: any) => state.logs.loadingLogMessages;

export const { clearLogMessages } = LogsSlice.actions;

export default LogsSlice.reducer;
