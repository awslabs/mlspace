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
import { DEFAULT_PAGE_SIZE, IUser } from '../../shared/model/user.model';
import { IProjectUser } from '../../shared/model/projectUser.model';
import axios, { axiosCatch, mlsBaseQuery } from '../../shared/util/axios-utils';
import { IGroupUser } from '../../shared/model/groupUser.model';
import { createApi } from '@reduxjs/toolkit/query/react';

export const userApi = createApi({
    reducerPath: 'user2',
    baseQuery: mlsBaseQuery(),
    endpoints: (builder) => ({
        getCurrentUser: builder.query<IUser,void>({
            query: () => ({
                url: '/current-user'
            }),
        })
    })
});

const initialState = {
    allUsers: [] as IUser[],
    projectUsers: [] as IProjectUser[],
    addUserModal: false,
    currentUser: {} as IUser,
    loading: false,
};

// Actions
export const getPageSizeForUser = (user : IUser, tableName? : string) => {
    const pageSizes : Map<string, number> = new Map(Object.entries(user?.preferences?.pageSize || {}));
    if (tableName && pageSizes?.has(tableName)) {
        return pageSizes.get(tableName);
    } else {
        return DEFAULT_PAGE_SIZE;
    }
};

export const getUser = createAsyncThunk('user/fetch_user', async (username: string) => {
    return axios.get<IUser>(`/user/${username}`);
});

export const getUserGroups = createAsyncThunk('user/fetch_user_groups', async (username: string) => {
    return axios.get<IGroupUser[]>(`/user/${username}/groups`);
});

export const getUserProjects = createAsyncThunk('user/fetch_user_projects', async (username: string) => {
    return axios.get<IProjectUser[]>(`/user/${username}/projects`);
});

export const getCurrentUser = () => {
    return axios.get<IUser>('/current-user');
};

export const getAllUsers = createAsyncThunk('user/fetch_all_users', async (includeSuspended?: boolean) => {
    const params = new URLSearchParams();
    if (includeSuspended) {
        params.append('includeSuspended', 'true');
    }
    return axios.get<IUser[]>(`/user${params.size > 0 ? '?' + params.toString() : ''}`);
});

export const getUsersInProject = createAsyncThunk(
    'user/fetch_entity_list',
    async (projectName: string) => {
        const requestUrl = `project/${projectName}/users`;
        return axios.get<IProjectUser[]>(requestUrl);
    }
);

export const addUsersToProject = createAsyncThunk(
    'user/add_users_to_project',
    async (data: UserProjectData) => {
        const requestUrl = `project/${data.projectName}/users`;
        return axios.post<IUser>(requestUrl, { usernames: data.usernames });
    }
);

export const removeUserFromProject = createAsyncThunk(
    'user/remove_user_from_project',
    async (data: IProjectUser) => {
        const requestUrl = `/project/${data.project}/users/${encodeURIComponent(data.user || '')}`;
        return axios.delete(requestUrl).catch(axiosCatch);
    }
);

export const updateUsersInProject = createAsyncThunk(
    'user/update_user_role',
    async (projectUser: IProjectUser) => {
        const requestUrl = `/project/${projectUser.project}/users/${encodeURIComponent(projectUser.user || '')}`;
        return axios.put<IProjectUser>(requestUrl, projectUser);
    }
);

export const updateUser = createAsyncThunk(
    'user/update_user',
    async (user: IUser) => {
        const requestUrl = `/user/${encodeURIComponent(user.username || '')}`;
        return await axios.put<IUser>(requestUrl, user);
    }
);

// slice

export const UserSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        toggleAddUserModal (state, action) {
            state.addUserModal = action.payload;
        },
        setCurrentUser (state, action) {
            state.currentUser = action.payload;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(getAllUsers), (state, action) => {
                return {
                    ...state,
                    allUsers: action.payload.data,
                    loading: false,
                };
            })
            .addMatcher(isFulfilled(getUsersInProject), (state, action) => {
                const { data } = action.payload;
                return {
                    ...state,
                    projectUsers: data,
                    loading: false,
                };
            })
            .addMatcher(isFulfilled(addUsersToProject), (state) => {
                return {
                    ...state,
                    loading: false,
                };
            })
            .addMatcher(isFulfilled(removeUserFromProject), (state) => {
                return {
                    ...state,
                    loading: false,
                };
            })
            .addMatcher(isFulfilled(updateUser), (state, action) => {
                // Only update the user state if the user is updating themselves
                // Admins updating other users should not assume the user identity of that user
                if (state.currentUser.username === action.payload.data.username){
                    return {
                        ...state,
                        currentUser: action.payload.data
                    };
                }
            })
            .addMatcher(isPending(getAllUsers), (state) => {
                return {
                    ...state,
                    loading: true,
                };
            })
            .addMatcher(isPending(getUsersInProject), (state) => {
                return {
                    ...state,
                    loading: true,
                };
            })
            .addMatcher(isPending(addUsersToProject), (state) => {
                return {
                    ...state,
                    loading: true,
                };
            })
            .addMatcher(isPending(removeUserFromProject), (state) => {
                return {
                    ...state,
                    loading: true,
                };
            });
    },
});

// Interfaces
export type UserProjectData = {
    usernames?: string[];
    projectName: string;
};

export type UserAndProject = {
    users: IUser[];
    projectName: string | undefined;
};

export const selectCurrentUser = (state: any): IUser => state.user.currentUser;

// Reducer
export default UserSlice.reducer;
export const { toggleAddUserModal, setCurrentUser } = UserSlice.actions;
export const { useGetCurrentUserQuery } = userApi;