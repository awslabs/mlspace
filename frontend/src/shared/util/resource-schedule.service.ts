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

import axios from '../../shared/util/axios-utils';
import { Timezone } from '../model/user.model';

export const modifyResourceTerminationSchedule = async (
    resourceType: 'emr' | 'endpoint' | 'notebook',
    resourceId: string,
    terminationTime?: Date
) => {
    const requestUrl = `/${resourceType}/${resourceId}/schedule`;
    return axios.put<any>(requestUrl, {
        terminationTime: terminationTime && terminationTime.getTime() / 1000,
    });
};

export const getTerminationHourDate = (newStopTime: string, timezone = Timezone.LOCAL) => {
    const newHour = Number(newStopTime.split(':')[0]);
    const newMin = Number(newStopTime.split(':')[1]);
    const stopTime = new Date();
    if (timezone === Timezone.UTC) {
        if (
            stopTime.getUTCHours() > newHour ||
            (stopTime.getUTCHours() === newHour && stopTime.getUTCMinutes() >= newMin)
        ) {
            stopTime.setUTCDate(stopTime.getUTCDate() + 1);
        }
        stopTime.setUTCHours(newHour);
        stopTime.setUTCMinutes(newMin);
        stopTime.setUTCSeconds(0);
    } else {
        if (
            stopTime.getHours() > newHour ||
            (stopTime.getHours() === newHour && stopTime.getMinutes() >= newMin)
        ) {
            stopTime.setDate(stopTime.getDate() + 1);
        }
        stopTime.setHours(newHour);
        stopTime.setMinutes(newMin);
        stopTime.setSeconds(0);
    }
    // Convert from ms to s for python and truncate
    return stopTime;
};
