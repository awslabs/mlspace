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

export class GroupMembershipHistoryApiConstruct extends Construct {
    constructor (scope: Stack, id: string, props: ApiStackProperties) {
        super(scope, id);

        // Get common layer based on arn from SSM due to issues with cross stack references
        const commonLambdaLayer = LayerVersion.fromLayerVersionArn(
            scope,
            'mls-common-lambda-layer',
            StringParameter.valueForStringParameter(scope, props.mlspaceConfig.COMMON_LAYER_ARN_PARAM)
        );

        const restApi = RestApi.fromRestApiAttributes(scope, 'RestApi', {
            restApiId: props.restApiId,
            rootResourceId: props.rootResourceId,
        });

        const apis: MLSpacePythonLambdaFunction[] = [
            {
                name: 'list_all_for_group',
                resource: 'group_membership_history',
                description: 'List all group membership history for a specific group',
                path: 'group-membership-history/{groupName}',
                method: 'GET',
            },
        ];

        apis.forEach((f) => {
            const system_permissions = ['remove_user', 'update', 'delete'];
            registerAPIEndpoint(
                scope,
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
