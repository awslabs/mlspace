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

export class GroupsApiStack extends Stack {
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
                resource: 'group',
                description: 'List all MLSpace groups',
                path: 'group',
                method: 'GET',
            },
            {
                name: 'create',
                resource: 'group',
                description: 'Create a new MLSpace group',
                path: 'group',
                method: 'POST',
            },
            {
                name: 'group_users',
                resource: 'group',
                description: 'Lists users that belong to a group',
                path: 'group/{groupName}/users',
                method: 'GET',
            },
            {
                name: 'add_users',
                resource: 'group',
                description: 'Adds users to a group',
                path: 'group/{groupName}/users',
                method: 'POST',
            },
            {
                name: 'delete',
                resource: 'group',
                description: 'Delete an MLSpace group',
                path: 'group/{groupName}',
                method: 'DELETE',
            },
            {
                name: 'get',
                resource: 'group',
                description: 'Gets the corresponding group object',
                path: 'group/{groupName}',
                method: 'GET',
            },
            {
                name: 'remove_user',
                resource: 'group',
                description: 'Removes a user from a group',
                path: 'group/{groupName}/users/{username}',
                method: 'DELETE',
            },
            {
                name: 'update',
                resource: 'group',
                description: 'Updates group state (suspended/active)',
                path: 'group/{groupName}',
                method: 'PUT',
            },
        ];

        apis.forEach((f) => {
            const system_permissions = ['remove_user', 'update', 'delete'];
            registerAPIEndpoint(
                this,
                restApi,
                props.authorizer,
                system_permissions.includes(f.name) ? props.systemRole : props.applicationRole,
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
