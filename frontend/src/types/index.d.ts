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

import { ApplyThemeParams } from '@cloudscape-design/components/theming';

export type CallbackFunction<T = any, R = void> = (props?: T) => R;

declare global {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Window {
        env: {
            OIDC_URL: string;
            OIDC_REDIRECT_URI: string;
            OIDC_CLIENT_NAME: string;
            LAMBDA_ENDPOINT: string;
            DATASET_BUCKET: string;
            MANAGE_IAM_ROLES?: boolean;
            SHOW_MIGRATION_OPTIONS?: boolean;
            APPLICATION_NAME?: string;
            AWS_REGION: string;
            BACKGROUND_REFRESH_INTERVAL: number;
        };
        gitInfo?: {
            revisionTag?: string;
            gitHash?: string;
        };
        custom_theme: ApplyThemeParams;
    }
}