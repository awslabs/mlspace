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

export const initCap = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const humanReadableMemoryLabel = (memoryInMB: number): string => {
    return `${memoryInMB / 1024} GB`;
};

export const enumToOptions = (source: object, capitalize?: boolean) => {
    return Object.values(source).map((entry) => {
        return {
            label: capitalize ? initCap(entry) : entry,
            value: entry,
        };
    });
};
