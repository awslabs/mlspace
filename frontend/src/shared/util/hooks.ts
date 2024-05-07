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

import { useCallback, useEffect, useState } from 'react';

/**
 * A custom hook that runs an action periodically in the background to refresh data.
 * It sets a minimum delay of 2 seconds before setting the `isBackgroundRefreshing` 
 * state back to `false`, providing a better user experience by avoiding rapid changes in the UI state.
 * 
 * @param {Function} action - The function to run periodically to refresh data 
 * @param {Array} deps - The dependencies of the action function
 * @param {boolean} condition - A condition that must be true for the action to run
*/
export function useBackgroundRefresh (action: () => void, deps: readonly unknown[] = [], condition = true): boolean {
    const callbackAction = useCallback(action, [action, ...deps]);
    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
    
    useEffect(() => {
        if (condition) {
            const timerId = setInterval(async () => {
                setIsBackgroundRefreshing(true);
                const now = new Date().valueOf();
                await callbackAction();
                const waitTime = Math.max(0, -(new Date().valueOf() - now) + 2000);
                setTimeout(() => {
                    setIsBackgroundRefreshing(false);
                }, waitTime);
            }, (window.env.BACKGROUND_REFRESH_INTERVAL || 60) * 1000);

            
            return () => {
                clearInterval(timerId);
            };
        }
    }, [action, callbackAction, condition, isBackgroundRefreshing]);
    return isBackgroundRefreshing;
}
