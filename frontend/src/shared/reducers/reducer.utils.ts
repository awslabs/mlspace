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
    AnyAction,
    AsyncThunk,
    ActionReducerMapBuilder,
    createSlice,
    SliceCaseReducers,
    ValidateSliceCaseReducers,
    AsyncThunkAction,
    isFulfilled,
} from '@reduxjs/toolkit';
import { AsyncThunkFulfilledActionCreator } from '@reduxjs/toolkit/dist/createAsyncThunk';
import { AxiosResponse } from 'axios';

/**
 * Model for redux actions with pagination
 */
export type IQueryParams = { query?: string; page?: number; size?: number; sort?: string };

/**
 * Useful types for working with actions
 */
type GenericAsyncThunk = AsyncThunk<unknown, unknown, any>;
export type PendingAction = ReturnType<GenericAsyncThunk['pending']>;
export type RejectedAction = ReturnType<GenericAsyncThunk['rejected']>;
export type FulfilledAction = ReturnType<GenericAsyncThunk['fulfilled']>;

/**
 * Check if the async action type is rejected
 */
/* istanbul ignore next */
export function isRejectedAction (action: AnyAction) {
    return action.type.endsWith('/rejected');
}

/**
 * Check if the async action type is pending
 */
/* istanbul ignore next */
export function isPendingAction (action: AnyAction) {
    return action.type.endsWith('/pending');
}

/**
 * Check if the async action type is completed
 */
/* istanbul ignore next */
export function isFulfilledAction (action: AnyAction) {
    return action.type.endsWith('/fulfilled');
}

export function isSuccessfulResponse<T, Returned extends AxiosResponse<T>, ThunkArg, ThunkApiConfig extends object> (response: Awaited<ReturnType<AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig>>>): response is ReturnType<AsyncThunkFulfilledActionCreator<Returned, ThunkArg>>  {
    if (isFulfilled(response)) {
        if (200 <= response.payload.status && response.payload.status < 300) {
            return true;
        }
    }

    return false;
}

export type EntityState<T> = {
    loading: boolean;
    errorMessage: string | null;
    entities: ReadonlyArray<T>;
    filteredEntities?: ReadonlyArray<T>;
    entity: T;
    selectedEntity?: T;
    links?: any;
    updating: boolean;
    totalItems?: number;
    updateSuccess: boolean;
    showModal?: boolean;
    addableUsers?: boolean;
    allFiles?: ReadonlyArray<T>;
};

/**
 * A wrapper on top of createSlice from Redux Toolkit to extract
 * common reducers and matchers used by entities
 */
export const createEntitySlice = <T, Reducers extends SliceCaseReducers<EntityState<T>>>({
    name = '',
    initialState,
    reducers,
    extraReducers,
    skipRejectionHandling,
}: {
    name: string;
    initialState: EntityState<T>;
    reducers?: ValidateSliceCaseReducers<EntityState<T>, Reducers>;
    extraReducers: (builder: ActionReducerMapBuilder<EntityState<T>>) => void;
    skipRejectionHandling?: boolean;
}) => {
    return createSlice({
        name,
        initialState,
        reducers: {
            /**
             * Reset the entity state to initial state
             */
            reset () {
                return initialState;
            },
            /* istanbul ignore next */
            selectEntity () {
                return initialState;
            },
            /* istanbul ignore next */
            updateEntity () {
                return initialState;
            },
            showProjectUsersModal () {
                return initialState;
            },
            toggleAddModelModal () {
                return initialState;
            },
            toggleAddableUsers () {
                return initialState;
            },
            toggleManageFilesModal () {
                return initialState;
            },
            ...reducers,
        },
        extraReducers (builder) {
            extraReducers(builder);
            /*
             * Common rejection logic is handled here.
             * If you want to add your own rejection logic, pass `skipRejectionHandling: true`
             * while calling `createEntitySlice`
             * */
            if (!skipRejectionHandling) {
                builder.addMatcher(isRejectedAction, (state, action) => {
                    state.loading = false;
                    state.updating = false;
                    state.updateSuccess = false;
                    state.errorMessage = action.error.message;
                });
            }
        },
    });
};
