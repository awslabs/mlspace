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

import { createSlice } from '@reduxjs/toolkit';
import { mlsBaseQuery } from '../../shared/util/axios-utils';
import { IGroup, IGroupWithPermissions } from '../../shared/model/group.model';
import { IGroupUser } from '../../shared/model/groupUser.model';
import { IDataset } from '../../shared/model';
import { IProjectGroup } from '../../shared/model/projectGroup.model';
import { createApi } from '@reduxjs/toolkit/query/react';
import { PagedRequest, PagedResponse } from '../../modules/table/table-hook';
import { DatasetResource } from '../../modules/dataset/dataset-browser.reducer';

const initialState = {
    allGroups: [] as IGroup[],
    currentGroupUsers: [] as IGroupUser[],
    currentGroupProjects: [] as IProjectGroup[],
    currentGroupDatasets: [] as IDataset[],
    loading: false,
    datasetsLoading: false,
    projectsLoading: false
};

export type AddGroupUserRequest = {
    groupName: string;
    usernames: string[];
};

type MLSServerRequestProperties = {
    adminGetAll?: boolean
};

export const groupApi = createApi({
    reducerPath: 'group2',
    baseQuery:  mlsBaseQuery(),
    endpoints: (builder) => ({
        createGroup: builder.mutation<string, IGroup>({
            query: (group) => ({
                url: '/group',
                data: group,
                method: 'POST'
            }),
            invalidatesTags: ['group']
        }),

        getAllGroups: builder.query<IGroup[], MLSServerRequestProperties | void>({
            query: (request) => ({
                url: '/group',
                params: {
                    adminGetAll: request?.adminGetAll
                },
            }),
            providesTags: ['group']
        }),

        getDatasetContents: builder.query<PagedResponse<DatasetResource>, Partial<PagedRequest>>({
            query: (request) => {
                const searchParams = new URLSearchParams();
                if (request.nextToken) {
                    searchParams.append('nextToken', request.nextToken);
                }
                if (request.pageSize) {
                    searchParams.append('pageSize', String(request.pageSize));
                }

                return {
                    url: `/v2/dataset/group/group/mlsDataset20240723v001/files?${searchParams}`
                };
            },
            serializeQueryArgs: ({queryArgs}) => {
                return JSON.stringify(queryArgs);
            },
            transformResponse: (baseQueryReturnValue) => {
                return {
                    ...baseQueryReturnValue,
                    items: baseQueryReturnValue.contents
                };
            },
        }),

        getGroup: builder.query<IGroupWithPermissions, string>({
            query: (groupName) => ({
                url: `/group/${groupName}`,
            }),
            providesTags: ['group'],
        }),

        getGroupUsers: builder.query<IGroupUser[],string>({
            query: (groupName) => ({
                url: `/group/${groupName}/users`,
            }),
            providesTags: ['group/users']
        }),

        getGroupDatasets: builder.query<IDataset[],string>({
            query: (groupName) => ({
                url: `/group/${groupName}/datasets`,
            }),
            providesTags: ['group/datasets']
        }),

        getGroupProjects: builder.query<IProjectGroup[],string>({
            query: (groupName) => ({
                url: `/group/${groupName}/projects`,
            }),
            providesTags: ['group/projects']
        }),

        addGroupUsers: builder.mutation<string,AddGroupUserRequest>({
            query: (request) => ({
                url: `/group/${request.groupName}/users`,
                data: request,
                method: 'POST'
            }),
            invalidatesTags: ['group/users']
        }),

        removeGroupUser: builder.mutation<string,IGroupUser>({
            query: (groupUser) => ({
                url: `/group/${groupUser.group}/users/${encodeURIComponent(groupUser.user || '')}`,
                method: 'DELETE'
            }),
            invalidatesTags: ['group/users']
        }),

        updateGroup: builder.mutation<string, IGroup>({
            query: (group) => ({
                url: `/group/${group.name}`,
                data: group,
                method: 'PUT'
            }),
            invalidatesTags: ['group']
        }),

        deleteGroup: builder.mutation<string,string>({
            query: (groupName) => ({
                url: `/group/${groupName}`,
                method: 'DELETE'
            }),
            invalidatesTags: ['group']
        }),
    }),
});

export const GroupSlice = createSlice({
    name: 'group',
    initialState,
    reducers: {}
});

export default GroupSlice.reducer;
export const { useGetGroupQuery, useGetGroupUsersQuery, useGetGroupDatasetsQuery, useGetGroupProjectsQuery, useAddGroupUsersMutation, useRemoveGroupUserMutation, useCreateGroupMutation, useUpdateGroupMutation, useGetAllGroupsQuery, useDeleteGroupMutation, useGetDatasetContentsQuery } = groupApi;