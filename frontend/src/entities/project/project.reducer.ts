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
import { Permission } from 'src/shared/model/user.model';
import { GetProjectRequestProperties, IProject } from '../../shared/model/project.model';
import axios from '../../shared/util/axios-utils';

const initialState = {
    loading: false,
    projects: [],
    project: {} as IProject,
    showModal: false,
    addableUsers: false,
    permissions: [] as Permission[],
    resourceCounts: {}
};

// Actions

/**
 * Update project {@param projectName}. Only description and suspended state can be updated.
 *
 * @param project the project to update
 */
export const updateProject = createAsyncThunk(
    'project/update',
    async (project: IProject, thunkApi) => {
        try {
            const payload = {
                description: project.description,
                suspended: project.suspended,
                metadata: project.metadata,
            };
            const response = await axios.put(`/project/${project.name}`, payload);
            return response.data;
        } catch (err: any) {
            return thunkApi.rejectWithValue(err?.response?.data || err);
        }
    }
);

/**
 * Delete project {@param projectName}
 *
 * @param projectName the name of the project to delete
 */
export const deleteProject = createAsyncThunk(
    'project/delete',
    async (projectName: string, thunkApi) => {
        try {
            const response = await axios.delete(`/project/${projectName}`);
            return response.data;
        } catch (err: any) {
            return thunkApi.rejectWithValue(err?.response?.data || err);
        }
    }
);

export const listProjectsForUser = createAsyncThunk('project/list_projects_for_user', async () => {
    return axios.get<IProject[]>('/project');
});

export const getProject = createAsyncThunk('project/get_project', async ({ projectName, includeResourceCounts = false }: GetProjectRequestProperties) => {
    return axios.get<IProject[]>(`/project/${projectName}?includeResourceCounts=${includeResourceCounts}`);
});

export const createProject = async (project: IProject) => {
    const payload = {
        ...project,
        suspended: false,
    };
    return axios.post('/project', JSON.stringify(payload));
};

// slice

export const ProjectSlice = createSlice({
    name: 'project',
    initialState,
    reducers: {
        updateProjectDescription (state, action: PayloadAction<string>) {
            state.project.description = action.payload;
        },
        showProjectUsersModal (state, action: PayloadAction<boolean>) {
            state.showModal = action.payload;
        },
        toggleAddableUsers (state, action: PayloadAction<boolean>) {
            state.addableUsers = action.payload;
        },
        resetCurrentProject (state) {
            state.project = {} as IProject;
        },
    },
    extraReducers (builder) {
        builder
            .addMatcher(isFulfilled(getProject), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    loading: false,
                    project: data.project,
                    permissions: data.permissions,
                    resourceCounts: data.resourceCounts
                };
            })
            .addMatcher(isPending(getProject), (state) => {
                return {
                    ...state,
                    loading: true,
                };
            })
            .addMatcher(isFulfilled(listProjectsForUser), (state, action: any) => {
                const { data } = action.payload;
                return {
                    ...state,
                    loading: false,
                    projects: data,
                };
            })
            .addMatcher(isRejected(getProject), (state) => {
                return {
                    ...state,
                    loading: false,
                    project: {},
                };
            });
    },
});

// Reducer
export default ProjectSlice.reducer;
export const {
    updateProjectDescription,
    showProjectUsersModal,
    toggleAddableUsers,
    resetCurrentProject,
} = ProjectSlice.actions;
export const userProjects = (state: any) => state.project.projects;
