/*
 * Your use of this service is governed by the terms of the AWS Customer Agreement
 * (https://aws.amazon.com/agreement/) or other agreement with AWS governing your use of
 * AWS services. Each license to use the service, including any related source code component,
 * is valid for use associated with the related specific task-order contract as defined by
 * 10 U.S.C. 3401 and 41 U.S.C. 4101.
 *
 * Copyright 2023 Amazon.com, Inc. or its affiliates. All Rights Reserved. This is AWS Content
 * subject to the terms of the AWS Customer Agreement.
 */

import { ApplyThemeParams } from '@cloudscape-design/components/theming';

export type CallbackFunction = (props?) => void;

declare global {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Window {
        env: {
            OIDC_URL: string;
            OIDC_REDIRECT_URI: string;
            OIDC_CLIENT_NAME: string;
            LAMBDA_ENDPOINT: string;
            DATASET_BUCKET: string;
            SYSTEM_BANNER?: {
                text: string,
                backgroundColor: string;
                fontColor: string;
            };
            MANAGE_IAM_ROLES?: boolean;
            SHOW_MIGRATION_OPTIONS?: boolean;
            ENABLE_TRANSLATE?: boolean;
            ENABLE_GROUNDTRUTH?: boolean;
            APPLICATION_NAME?: string;
        };
        gitInfo?: {
            revisionTag?: string;
            gitHash?: string;
        };
        custom_theme: ApplyThemeParams;
    }
}
