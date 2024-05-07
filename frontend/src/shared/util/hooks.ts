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

import { DebouncedFunc, debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * A custom hook that runs an action periodically in the background to refresh data.
 *
 * @param {Function} action - The function to run periodically to refresh data
 * @param {Array} deps - The dependencies of the action function
 * @param {boolean} condition - A condition that must be true for the action to run
 * @returns {boolean} isBackgroundRefreshing - Whether the background refresh is currently running
*/
export function useBackgroundRefresh (action: () => void, deps: readonly unknown[] = [], condition = true): boolean {

    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
    const callbackAction = useCallback(action, [action, ...deps]);

    useEffect(() => {
        // Only start a periodic refresh if the condition is met
        if (condition) {
            const timerId = setInterval(() => {
                // Once the condition is no longer met we can stop refreshing
                if (!condition) {
                    clearInterval(timerId);
                    return;
                }
                setIsBackgroundRefreshing(true);
                callbackAction();
            }, (window.env.BACKGROUND_REFRESH_INTERVAL || 60) * 1000);
            return () => {
                clearInterval(timerId);
            };
        }
        // We only want to recreate the interval if the condition changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [condition]);
    return isBackgroundRefreshing;
}

/**
 * Creates a debounced function that delays invoking {@link callback} until after {@link delay} milliseconds have elapsed since
 * the last time the debounced function was invoked.
 * 
 * NOTE: The returned function has {@link callback} as a dependency so it is up to the caller to ensure {@link callback} doesn't
 * change or is memoized.
 * 
 * @param {Function} callback The function to debounce.
 * @param {number} delay The number of milliseconds to delay.
 * @returns {Function} The memoized and debounced function.
 */
export function useDebounce<T extends (...args: any[]) => void> (callback: T, delay = 300): DebouncedFunc<T> {
    // useMemo is necessary because useCallback doesn't understand the dependencies for the debounced function
    const debounced = useMemo(() => debounce(callback, delay), [callback, delay]);
    
    return useCallback(debounced, [debounced]);
}