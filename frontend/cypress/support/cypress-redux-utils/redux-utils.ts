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

import { legacy_createStore as createStore } from '@reduxjs/toolkit';
import { defaultConfiguration } from '../../../src/shared/model/app.configuration.model';
import _ from 'lodash';
import { Store } from '@reduxjs/toolkit';

// TODO: Remove this file in favor of 'redux-mock-store'

/**
 * 
 * @param state The current state
 * @param action Must be an object with a 'type' property
 * @returns 
 */
export function mockedReducer (state = {}, action) {
    return state = _.merge(state, action.updates);
}

/**
 * Creates a mocked store object with a base appConfig setup
 * @param storeAdditions 
 * @returns 
 */
export function createMockedStore (storeAdditions = {}) {
    // _.cloneDeep turns the defaultConfiguration into a plain object (removes type) for successful merges
    const base_config = _.cloneDeep({ appConfig: { appConfig: defaultConfiguration }});
    return createStore(mockedReducer, _.merge(base_config, storeAdditions));
}

/**
 * Merges provided updates with the mocked store
 * @param store 
 * @param updates 
 */
export function updateMockedStore (store : Store, updates = {}) {
    store.dispatch({type: 'type', updates: updates});
}

/**
 * Merges provided appConfig updates with the store's current appConfig
 * @param store The mocked store
 * @param updates 
 */
export function updateMockedStoreAppConfig (store : Store, updates = {}) {
    updateMockedStore(store, { appConfig: { appConfig: updates}});
}