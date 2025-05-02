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
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import {
    MLSpacePythonLambdaFunction,
    registerAPIEndpoint,
} from '../../utils/apiFunction';
import { ApiStackProperties } from './restApi';

export class ConfigurationProfilesApiStack extends Stack {
    constructor(parent: App, id: string, props: ApiStackProperties) {
        super(parent, id, {
            terminationProtection: false,
            ...props,
        });

        // Common layer for Python Lambdas
        const commonLayer = LayerVersion.fromLayerVersionArn(
            this,
            'mls-common-lambda-layer',
            StringParameter.valueForStringParameter(
                this,
                props.mlspaceConfig.COMMON_LAYER_ARN_PARAM
            )
        );

        // Import existing RestApi
        const restApi = RestApi.fromRestApiAttributes(this, 'RestApi', {
            restApiId: props.restApiId,
            rootResourceId: props.rootResourceId,
        });

        // API definitions for Dynamic Configuration Profiles
        const apis: MLSpacePythonLambdaFunction[] = [
            {
                name: 'list_profiles',
                resource: 'config_profiles',
                description: 'List all dynamic configuration profiles',
                path: 'config-profiles',
                method: 'GET',
            },
            {
                name: 'get_profile',
                resource: 'config_profiles',
                description: 'Retrieve a single configuration profile by ID',
                path: 'config-profiles/{profileId}',
                method: 'GET',
            },
            {
                name: 'create_profile',
                resource: 'config_profiles',
                description: 'Create a new dynamic configuration profile',
                path: 'config-profiles',
                method: 'POST',
            },
            {
                name: 'update_profile',
                resource: 'config_profiles',
                description: 'Update an existing configuration profile',
                path: 'config-profiles/{profileId}',
                method: 'PUT',
            },
            {
                name: 'delete_profile',
                resource: 'config_profiles',
                description: 'Delete a configuration profile if not in use',
                path: 'config-profiles/{profileId}',
                method: 'DELETE',
            },
        ];

        // Only systemRole (admin) may invoke all config-profiles APIs
        const systemPermissions = apis.map((f) => f.name);

        apis.forEach((f) => {
            registerAPIEndpoint(
                this,
                restApi,
                props.authorizer,
                systemPermissions.includes(f.name)
                    ? props.systemRole
                    : props.applicationRole,
                props.applicationRole.roleName,
                props.notebookInstanceRole.roleName,
                props.lambdaSourcePath,
                [commonLayer],
                f,
                props.mlSpaceVPC,
                props.securityGroups,
                props.mlspaceConfig,
                props.permissionsBoundaryArn
            );
        });
    }
}
