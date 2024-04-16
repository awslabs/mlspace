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

export const convertBytesToHumanReadable = (size: number) => {
    const i: number = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return size > 0 ?
        // Using Console S3 Table as an example: 1 decimal normal, 0 decimal for empty
        (size / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i] :
        '0 B';
};

export const convertEpochToHumanReadable = (epoch: number) => {
    return new Date(epoch).toUTCString();
};
