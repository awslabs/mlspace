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

import { App, Stack } from 'aws-cdk-lib';
import { LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { MLSpacePythonLambdaFunction, registerAPIEndpoint } from '../../utils/apiFunction';
import { ApiStackProperties } from './restApi';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';

export class AdminApiStack extends Stack {
    constructor (parent: App, id: string, props: ApiStackProperties) {
        super(parent, id, {
            terminationProtection: false,
            ...props,
        });

        // Get common layer based on arn from SSM due to issues with cross stack references
        const commonLambdaLayer = LayerVersion.fromLayerVersionArn(
            this,
            'mls-common-lambda-layer',
            StringParameter.valueForStringParameter(this, props.mlspaceConfig.COMMON_LAYER_ARN_PARAM)
        );

        const restApi = RestApi.fromRestApiAttributes(this, 'RestApi', {
            restApiId: props.restApiId,
            rootResourceId: props.rootResourceId,
        });

        const apis: MLSpacePythonLambdaFunction[] = [
            {
                name: 'list_all',
                resource: 'user',
                description: 'Returns a list of all MLSpace users',
                path: 'user',
                method: 'GET',
            },
            {
                name: 'delete',
                resource: 'user',
                description: 'Removes an MLSpace user',
                path: 'user/{username}',
                method: 'DELETE',
            },
            {
                name: 'create',
                resource: 'user',
                description: 'Creates a user for the system',
                path: 'user',
                method: 'POST',
                environment: {
                    NEW_USER_SUSPENSION_DEFAULT: props.mlspaceConfig.NEW_USERS_SUSPENDED ? 'True' : 'False',
                },
            },
            {
                name: 'get',
                resource: 'user',
                description: 'Get an MLSpace user',
                path: 'user/{username}',
                method: 'GET',
            },
            {
                name: 'get_projects',
                resource: 'user',
                description: 'Get an MLSpace user\'s projects',
                path: 'user/{username}/projects',
                method: 'GET',
            },
            {
                name: 'get_groups',
                resource: 'user',
                description: 'Get an MLSpace user\'s groups',
                path: 'user/{username}/groups',
                method: 'GET',
            },
            {
                id: 'dataset-admin',
                name: 'list_resources',
                resource: 'dataset',
                description: 'List all global, group, and private datasets',
                path: 'admin/datasets',
                method: 'GET',
            },
            {
                name: 'update',
                resource: 'user',
                description: 'Update an MLSpace user',
                path: 'user/{username}',
                method: 'PUT',
            },
            {
                name: 'login',
                resource: 'user',
                description: 'Update an MLSpace users lastLogin attribute',
                path: 'login',
                method: 'PUT',
            },
            {
                name: 'current',
                resource: 'user',
                description: 'Retrieve the user record for the current user',
                path: 'current-user',
                method: 'GET',
            },
            {
                name: 'describe',
                resource: 'config',
                description:
                    'Get the current env config including env variables, param file, and notebook lifecycle config',
                path: 'config',
                method: 'GET',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.mlspaceConfig.NOTEBOOK_PARAMETERS_FILE_NAME,
                },
            },
            {
                name: 'create',
                resource: 'report',
                description: 'Generates a report of project resources and users for admins',
                path: 'report',
                method: 'POST',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'list',
                resource: 'report',
                description: 'Lists reports of project resources and users for admins',
                path: 'report',
                method: 'GET',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'download',
                resource: 'report',
                description: 'Get S3 URL of MLSpace report',
                path: 'report/{reportName}',
                method: 'GET',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'delete',
                resource: 'report',
                description: 'Deletes an MLSpace report',
                path: 'report/{reportName}',
                method: 'DELETE',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'sync_metadata',
                resource: 'migration',
                description: 'Sync resource metadata to MLSpace Resource Metadata table',
                path: 'admin/sync-metadata',
                method: 'POST',
            },
            {
                name: 'list_subnets',
                resource: 'metadata',
                description: 'List available subnets in which MLSpace resources can be launched',
                path: 'metadata/subnets',
                method: 'GET',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.mlspaceConfig.NOTEBOOK_PARAMETERS_FILE_NAME,
                },
            },
            {
                name: 'compute_types',
                resource: 'metadata',
                description: 'Describe available instance types for a sagemaker notebook',
                path: 'metadata/compute-types',
                method: 'GET',
            },
            {
                name: 'notebook_options',
                resource: 'metadata',
                description:
                    'Gets notebook instance types and lifecycle configs for create notebooks',
                path: 'metadata/notebook-options',
                method: 'GET',
            },
        ];

        apis.forEach((f) => {
            registerAPIEndpoint(
                this,
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
