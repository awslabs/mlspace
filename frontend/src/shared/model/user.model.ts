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

import { Mode } from '@cloudscape-design/global-styles';

export const DEFAULT_PAGE_SIZE = 10;

export enum Permission {
    PROJECT_OWNER = 'MO',
    COLLABORATOR = 'CO',
    ADMIN = 'PMO',
}

export enum Timezone {
    LOCAL = 'Local',
    UTC = 'UTC',
}

export type IPreferences = {
    timezone?: Timezone;
    displayMode?: Mode;
    pageSize?: Map<string, number>;
};

export type IUser = {
    username: string;
    email: string;
    displayName: string;
    suspended: boolean;
    permissions?: Permission[];
    lastLogin?: number;
    preferences?: IPreferences;
};

export const defaultValue: Readonly<IUser> = {};
