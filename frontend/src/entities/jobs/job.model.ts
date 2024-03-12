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

export enum JobStatus {
    InProgress = 'InProgress',
    Completed = 'Completed',
    Failed = 'Failed',
    Stopping = 'Stopping',
    Stopped = 'Stopped',
}

export enum SecondaryStatus {
    Starting = 'Starting',
    Downloading = 'Downloading',
    Training = 'Training',
    Uploading = 'Uploading',
    Completed = 'Completed',
    Failed = 'Failed',
    MaxRuntimeExceeded = 'MaxRuntimeExceeded',
    Stopped = 'Stopped',
    Stopping = 'Stopping',
}

export type JobNameAndProject = {
    jobName: string;
    projectName: string;
};
