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

export type ILogMessage = {
    timestamp: number;
    message: string;
    logStreamName: string;
    eventId?: string;
};

export const defaultValue: Readonly<ILogMessage> = {
    timestamp: 0,
    logStreamName: '',
    message: '',
};

export type ILogRequestParams = {
    resourceType: string;
    jobType?: string;
    resourceName: string;
    startTime?: number;
    endTime?: number;
    endpointVariant?: string;
};

export type ILogsComponentOptions = {
    resourceType: string;
    jobType?: string;
    resourceName: string;
    resourceCreationTime?: string;
};
