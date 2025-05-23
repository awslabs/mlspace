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

export class InferenceApiConstruct extends Construct {
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
                name: 'create',
                resource: 'model',
                description: 'Creates a new model',
                path: 'model',
                method: 'POST',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                },
            },
            {
                name: 'describe',
                resource: 'model',
                description: 'Returns the description of a given model',
                path: 'model/{modelName}',
                method: 'GET',
            },
            {
                name: 'list_images',
                resource: 'model',
                description: 'Gets ECR paths for models',
                path: 'model/images',
                method: 'GET',
            },
            {
                name: 'delete',
                resource: 'model',
                description: 'Delete a model',
                path: 'model/{modelName}',
                method: 'DELETE',
            },
            {
                name: 'create',
                resource: 'endpoint',
                description: 'Creates a new endpoint',
                path: 'endpoint',
                method: 'POST',
            },
            {
                name: 'describe',
                resource: 'endpoint',
                description: 'Returns the description of an endpoint',
                path: 'endpoint/{endpointName}',
                method: 'GET',
            },
            {
                name: 'update',
                resource: 'endpoint',
                description: 'Updates an existing endpoint with a new endpoint config',
                path: 'endpoint/{endpointName}',
                method: 'PUT',
            },
            {
                name: 'delete',
                resource: 'endpoint',
                description: 'Deletes an Endpoint',
                path: 'endpoint/{endpointName}',
                method: 'DELETE',
            },
            {
                id: 'endpoint-get-logs',
                name: 'get',
                resource: 'logs',
                description: 'Returns the log events for the specified endpoint',
                path: 'endpoint/{endpointName}/logs',
                method: 'GET',
            },
            {
                name: 'create',
                resource: 'endpoint_config',
                description: 'Creates a new endpoint config',
                path: 'endpoint-config',
                method: 'POST',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                },
            },
            {
                name: 'describe',
                resource: 'endpoint_config',
                description: 'Returns the description of an endpoint config',
                path: 'endpoint-config/{endpointConfigName}',
                method: 'GET',
            },
            {
                name: 'delete',
                resource: 'endpoint_config',
                description: 'Deletes an endpoint config',
                path: 'endpoint-config/{endpointConfigName}',
                method: 'DELETE',
            },
            {
                name: 'set_resource_termination',
                resource: 'resource_scheduler',
                description: 'Update the termination time of a SageMaker Endpoint',
                path: 'endpoint/{endpointName}/schedule',
                method: 'PUT',
                id: 'resource_scheduler-set-endpoint-termination',
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
