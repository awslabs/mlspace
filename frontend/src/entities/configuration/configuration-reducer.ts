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
    isRejected,
    PayloadAction,
} from '@reduxjs/toolkit';
import axios from '../../shared/util/axios-utils';
import {setEnabledServices} from '../../shared/layout/navigation/navigation.reducer';
import { defaultConfiguration, IAppConfiguration } from '../../shared/model/app.configuration.model';

const initialState = {
    appConfigList: [],
    appConfig: defaultConfiguration,
    failedToLoadConfig: false,
};

// Actions
export const getConfiguration = (configScope: string) => {
    return listConfigurations({ configScope, numVersions: 1});
};

export const listConfigurations = createAsyncThunk(
    'app_config/list_configurations',
    async (props: ListAppConfigurationProps, { dispatch }) => {
        const searchParams = new URLSearchParams();
        searchParams.set('configScope', props.configScope);
        if (props.numVersions) {
            searchParams.set('numVersions', props.numVersions.toString());
        }
        const requestUrl = `/app-config?${searchParams}`;
        
        const response =  await axios.get<IAppConfiguration[]>(requestUrl);
        dispatch(setEnabledServices(response.data[0].configuration.EnabledServices));

        return response;
    }
);

export const updateConfiguration = createAsyncThunk('app_config/update_app_config', 
    async (newConfiguration: AppConfigurationProps, { rejectWithValue }) => {
        const requestUrl = '/app-config';
        try {
            return await axios.post<IAppConfiguration>(requestUrl, newConfiguration.appConfiguration);
        } catch (err) {
            return rejectWithValue(err.response);
        }
    });

// slice
export const AppConfigSlice = createSlice({
    name: 'appConfig',
    initialState,
    reducers: {
        updateEntity (state, action: PayloadAction<IAppConfiguration>) {
            state.appConfig = action.payload;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(listConfigurations), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    appConfig: data[0],
                    appConfigList: data,
                    failedToLoadConfig: false,
                };
            })
            .addMatcher(isRejected(listConfigurations), (state) => {
                return {
                    ...state,
                    failedToLoadConfig: true,
                };
            });
    },
});

// Types
type AppConfigurationProps = {
    appConfiguration: IAppConfiguration;
};
type ListAppConfigurationProps = {
    configScope: string;
    numVersions: number;
};


// Reducer
export default AppConfigSlice.reducer;
export const { updateEntity } = AppConfigSlice.actions;
export const appConfigList = (state: any): IAppConfiguration[] => state.appConfig.appConfigList;
export const appConfig = (state: any): IAppConfiguration => state.appConfig.appConfig;
export const failedToLoadConfig = (state: any): boolean => state.appConfig.failedToLoadConfig;
