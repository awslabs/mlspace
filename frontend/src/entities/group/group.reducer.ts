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

import { createAsyncThunk, createSlice, isFulfilled, isPending } from '@reduxjs/toolkit';
import axios from '../../shared/util/axios-utils';
import { IGroup } from '../../shared/model/group.model';
import { IGroupUser } from '../../shared/model/groupUser.model';

const initialState = {
    allGroups: [] as IGroup[],
    loading: false,
};


export const getAllGroups = createAsyncThunk('group/fetch_all_groups', async () => {
    return axios.get<IGroup[]>('/group');
});

export const getGroup = createAsyncThunk('group/fetch_group', async (groupName: string) => {
    return axios.get<IGroup>(`/group/${groupName}`);
});

export const deleteGroup = createAsyncThunk('group/delete_group', async (groupName: string) => {
    const requestUrl = `/group/${groupName}`;
    return axios.delete(requestUrl);
});

export const createGroup = createAsyncThunk('group/create_group', async (group: IGroup) => {
    return axios.post('/group', JSON.stringify(group));
});

export const updateGroup = createAsyncThunk('group/update_group', async (group: IGroup) => {
    const requestUrl = `/group/${group.name}`;
    return axios.put(requestUrl, JSON.stringify(group));
});

export const getGroupUsers = createAsyncThunk('group/group_users', async (groupName: string) => {
    const requestUrl = `/group/${groupName}/users`;
    return axios.get<IGroupUser[]>(requestUrl);
});

export const GroupSlice = createSlice({
    name: 'group',
    initialState,
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(getAllGroups), (state, action) => {
                return {
                    ...state,
                    allGroups: action.payload.data,
                    loading: false,
                };
            })
            .addMatcher(isFulfilled(deleteGroup, createGroup, updateGroup, getGroup, getGroupUsers), (state) => {
                return {
                    ...state,
                    loading: false,
                };
            })
            .addMatcher(isPending(getAllGroups, deleteGroup, createGroup, updateGroup, getGroup, getGroupUsers), (state) => {
                return {
                    ...state,
                    loading: true,
                };
            });
    },
});

export default GroupSlice.reducer;