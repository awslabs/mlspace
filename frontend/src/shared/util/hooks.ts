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
        if (condition) {
            const timerId = setInterval(() => {
                setIsBackgroundRefreshing(true);
                callbackAction();
            }, (window.env.BACKGROUND_REFRESH_INTERVAL || 60) * 1000);
            
            return () => {
                clearInterval(timerId);
            };
        }
    }, [callbackAction, condition]);
    return isBackgroundRefreshing;
}
