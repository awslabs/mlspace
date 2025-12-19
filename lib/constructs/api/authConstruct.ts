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

import { Stack } from 'aws-cdk-lib';
import { LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { MLSpacePythonLambdaFunction, registerAPIEndpoint } from '../../utils/apiFunction';
import { ApiStackProperties } from './restApiConstruct';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class AuthApiConstruct extends Construct {
    constructor (scope: Stack, id: string, props: ApiStackProperties) {
        super(scope, id);

        // Get common layer based on arn from SSM due to issues with cross stack references
        const commonLambdaLayer = LayerVersion.fromLayerVersionArn(
            scope,
            'mls-auth-common-lambda-layer',
            StringParameter.valueForStringParameter(scope, props.mlspaceConfig.COMMON_LAYER_ARN_PARAM)
        );

        const restApi = RestApi.fromRestApiAttributes(scope, 'AuthRestApi', {
            restApiId: props.restApiId,
            rootResourceId: props.rootResourceId,
        });

        // Common environment variables for all auth endpoints
        const authCommonEnv = {
            AUTH_SESSION_TABLE_NAME: props.mlspaceConfig.AUTH_SESSION_TABLE_NAME,
            AUTH_IDP_TYPE: props.mlspaceConfig.AUTH_IDP_TYPE,
            AUTH_PRIMARY_DOMAIN: props.mlspaceConfig.AUTH_PRIMARY_DOMAIN,
            AUTH_SYNC_DOMAINS: props.mlspaceConfig.AUTH_SYNC_DOMAINS,
            AUTH_SESSION_TTL_HOURS: props.mlspaceConfig.AUTH_SESSION_TTL_HOURS.toString(),
            AUTH_ENCRYPTION_KEY_SSM_PARAM: props.mlspaceConfig.AUTH_ENCRYPTION_KEY_SSM_PARAM,
            AUTH_STATE_ENCRYPTION_KEY_SSM_PARAM: props.mlspaceConfig.AUTH_STATE_ENCRYPTION_KEY_SSM_PARAM,
        };

        // OIDC-specific environment variables
        const oidcEnv = {
            AUTH_OIDC_URL: props.mlspaceConfig.AUTH_OIDC_URL,
            AUTH_OIDC_CLIENT_ID: props.mlspaceConfig.AUTH_OIDC_CLIENT_ID,
            AUTH_OIDC_CLIENT_SECRET_SSM_PARAM: props.mlspaceConfig.AUTH_OIDC_CLIENT_SECRET_SSM_PARAM,
            AUTH_OIDC_VERIFY_SSL: props.mlspaceConfig.AUTH_OIDC_VERIFY_SSL ? 'True' : 'False',
            AUTH_OIDC_VERIFY_SIGNATURE: props.mlspaceConfig.AUTH_OIDC_VERIFY_SIGNATURE ? 'True' : 'False',
        };

        const apis: MLSpacePythonLambdaFunction[] = [
            {
                name: 'login',
                resource: 'auth',
                description: 'Initiates authentication flow by redirecting to Identity Provider',
                path: 'auth/login',
                method: 'POST',
                environment: {
                    ...authCommonEnv,
                    ...oidcEnv,
                },
                noAuthorizer: true,
            },
            {
                name: 'callback',
                resource: 'auth',
                description: 'Handles Identity Provider callback (GET)',
                path: 'auth/callback',
                method: 'GET',
                environment: {
                    ...authCommonEnv,
                    ...oidcEnv,
                },
                noAuthorizer: true,
            },
            {
                name: 'callback_post',
                resource: 'auth',
                description: 'Handles Identity Provider callback (POST)',
                path: 'auth/callback',
                method: 'POST',
                environment: {
                    ...authCommonEnv,
                    ...oidcEnv,
                },
                noAuthorizer: true,
            },
            {
                name: 'logout',
                resource: 'auth',
                description: 'Terminates user session and optionally logs out from IdP',
                path: 'auth/logout',
                method: 'POST',
                environment: {
                    ...authCommonEnv,
                    ...oidcEnv,
                },
                noAuthorizer: true,
            },
            {
                name: 'identity',
                resource: 'auth',
                description: 'Retrieves current user identity and authentication status',
                path: 'auth/identity',
                method: 'GET',
                environment: {
                    ...authCommonEnv,
                    ...oidcEnv,
                },
                noAuthorizer: true,
            },
            {
                name: 'sync',
                resource: 'auth',
                description: 'Handles cross-domain cookie synchronization',
                path: 'auth/sync',
                method: 'GET',
                environment: {
                    ...authCommonEnv,
                },
                noAuthorizer: true,
            },
        ];

        apis.forEach((f) => {
            registerAPIEndpoint(
                scope,
                restApi,
                props.authorizer,
                props.applicationRole,
                props.applicationRole.roleName,
                props.notebookInstanceRole.roleName,
                props.lambdaSourcePath,
                [commonLambdaLayer],
                f,
                props.mlSpaceVPC,
                props.securityGroups,
                props.mlspaceConfig,
                props.permissionsBoundaryArn
            );
        });
    }
}