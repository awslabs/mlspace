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

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EntityState } from '../../../shared/reducers/reducer.utils';
import { IProject } from '../../../shared/model/project.model';

const initialState: EntityState<IProject> = {
    loading: false,
    errorMessage: null,
    entities: [],
    selectedEntity: undefined,
    entity: {},
    updating: false,
    updateSuccess: false,
};

const projectCardSlice = createSlice({
    name: 'projectCard',
    initialState,
    reducers: {
        selectProject (state, action: PayloadAction<IProject | undefined>) {
            state.selectedEntity = action.payload;
        },
    },
});

export const { selectProject } = projectCardSlice.actions;
export default projectCardSlice.reducer;
