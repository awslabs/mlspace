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

import { ServerRequestProps } from './table-utils';

export const focusOnCreateButton = (projectName?: string) => {
    const prevPath = window.history.state?.usr?.prevPath;
    if (
        `${window.location.hash}/create` === prevPath ||
        (projectName === undefined && '#/project/create' === prevPath)
    ) {
        return true;
    }
    return false;
};

export const addPagingParams = (requestUrl: string, params: ServerRequestProps): string => {
    const queryParams: string[] = [];
    if (params.pageSize) {
        queryParams.push(`pageSize=${encodeURIComponent(params.pageSize)}`);
    }
    if (params.nextToken) {
        queryParams.push(`nextToken=${encodeURIComponent(params.nextToken)}`);
    }
    if (params.logRequestParameters) {
        if (params.logRequestParameters.endTime) {
            queryParams.push(`endTime=${encodeURIComponent(params.logRequestParameters.endTime)}`);
        }
        if (params.logRequestParameters.startTime) {
            queryParams.push(
                `startTime=${encodeURIComponent(params.logRequestParameters.startTime)}`
            );
        }
        if (params.logRequestParameters.endpointVariant) {
            queryParams.push(
                `endpointVariant=${encodeURIComponent(params.logRequestParameters.endpointVariant)}`
            );
        }
    }
    if (params.resourceStatus) {
        queryParams.push(`resourceStatus=${encodeURIComponent(params.resourceStatus)}`);
    }
    if (queryParams.length > 0) {
        requestUrl += `?${queryParams.join('&')}`;
    }
    return requestUrl;
};
