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

export class EmrApiStack extends Stack {
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
                name: 'get',
                resource: 'emr',
                description: 'Describe an EMR Cluster',
                path: 'emr/{clusterId}',
                method: 'GET',
            },
            {
                name: 'delete',
                resource: 'emr',
                description: 'Delete an EMR Cluster',
                path: 'emr/{clusterId}',
                method: 'DELETE',
            },
            {
                name: 'set_resource_termination',
                resource: 'resource_scheduler',
                description: 'Update the termination time of an EMR Cluster',
                path: 'emr/{clusterId}/schedule',
                method: 'PUT',
                id: 'resource_scheduler-set-emr-termination',
            },
            {
                name: 'list_applications',
                resource: 'emr',
                description: 'List all applications available to install and configure when launching a cluster',
                path: 'emr/applications',
                method: 'GET',
            },
            {
                name: 'list_release_labels',
                resource: 'emr',
                description: 'List of available EMR release labels',
                path: 'emr/release',
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
