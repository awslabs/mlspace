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
import axios from '../../shared/util/axios-utils';
import { defaultConfiguration, IAppConfiguration } from '../../shared/model/app.configuration.model';

const initialState = {
    loadingAppConfigUpdate: false,
    loadingAppConfigList: false,
    loadingAppConfig: false,
    appConfigList: [],
    appConfig: defaultConfiguration,
};

// Actions
export const getConfiguration = createAsyncThunk(
    'app_config/get_configuration',
    async (props: GetAppConfigurationProps) => {
        const searchParams = new URLSearchParams();
        searchParams.set('configScope', props.configScope);
        const requestUrl = `/app-config?${searchParams.toString()}`;
        
        return await axios.get<IAppConfiguration[]>(requestUrl);
    }
);

export const listConfigurations = createAsyncThunk(
    'app_config/list_configurations',
    async (props: ListAppConfigurationProps) => {
        const searchParams = new URLSearchParams();
        searchParams.set('configScope', props.configScope);
        if (props.numVersions) {
            searchParams.set('numVersions', props.numVersions.toString());
        }
        const requestUrl = `/app-config?${searchParams.toString()}`;
        
        return await axios.get<IAppConfiguration[]>(requestUrl);
    }
);


export const updateConfiguration = createAsyncThunk('app_config/update_app_config', async (newConfiguration: AppConfigurationProps) => {
    const requestUrl = '/app-config';

    return axios.post<IAppConfiguration>(requestUrl, newConfiguration.appConfiguration);
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
            .addMatcher(isFulfilled(getConfiguration), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    loadingAppConfig: false,
                    appConfig: data[0],
                };
            })
            .addMatcher(isFulfilled(listConfigurations), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    loadingAppConfigList: false,
                    appConfigList: data,
                };
            })
            .addMatcher(isFulfilled(updateConfiguration), (state) => {
                return {
                    ...state,
                    loadingAppConfigUpdate: false,
                };
            })
            .addMatcher(isPending(updateConfiguration), (state) => {
                return {
                    ...state,
                    loadingAppConfigUpdate: true,
                };
            })
            .addMatcher(isPending(getConfiguration), (state) => {
                return {
                    ...state,
                    loadingAppConfig: true,
                };
            })
            .addMatcher(isPending(listConfigurations), (state) => {
                return {
                    ...state,
                    loadingAppConfigList: true,
                };
            });
            
    },
});

// Interfaces
type AppConfigurationProps = {
    appConfiguration: IAppConfiguration;
};
type ListAppConfigurationProps = {
    configScope: string;
    numVersions: number;
};
type GetAppConfigurationProps = {
    configScope: string;
};

// Reducer
export default AppConfigSlice.reducer;
export const { updateEntity } = AppConfigSlice.actions;
export const loadingAppConfigList = (state: any) => state.appConfig.loadingAppConfigList;
export const loadingAppConfig = (state: any) => state.loadingAppConfig;
export const loadingAppConfigUpdate = (state: any): boolean => state.appConfig.loadingAppConfigUpdate;
export const appConfigList = (state: any): IAppConfiguration[] => state.appConfig.appConfigList;
export const appConfig = (state: any): IAppConfiguration => state.appConfig.appConfig;
