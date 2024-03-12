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
import { DeleteModalProps } from './delete-modal';
import { ResourceScheduleModalProps } from './resource-schedule-modal';
import { UpdateModalProps } from './update-modal';

const initialState = {
    deleteModal: undefined as DeleteModalProps | undefined,
    updateModal: undefined as UpdateModalProps | undefined,
    resourceScheduleModal: undefined as ResourceScheduleModalProps | undefined,
};

const modalSlice = createSlice({
    name: 'modal',
    initialState,
    reducers: {
        setDeleteModal (state, action: PayloadAction<DeleteModalProps>) {
            state.deleteModal = action.payload;
        },
        setUpdateModal (state, action: PayloadAction<UpdateModalProps>) {
            state.updateModal = action.payload;
        },
        setResourceScheduleModal (state, action: PayloadAction<ResourceScheduleModalProps>) {
            state.resourceScheduleModal = action.payload;
        },
        dismissModal (state) {
            state.updateModal = undefined;
            state.deleteModal = undefined;
            state.resourceScheduleModal = undefined;
        },
    },
});

// Reducer
export const { setDeleteModal, dismissModal, setUpdateModal, setResourceScheduleModal } =
    modalSlice.actions;
export default modalSlice.reducer;
