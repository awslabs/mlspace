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

export class NotebooksApiConstruct extends Construct {
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
                id: 'notebook-personal',
                name: 'list_resources',
                resource: 'notebook',
                description: 'Gets all notebooks a user has access to',
                path: 'notebook',
                method: 'GET',
            },
            {
                name: 'describe',
                resource: 'notebook',
                description: 'Describe a sagemaker notebook instance',
                path: 'notebook/{notebookName}',
                method: 'GET',
            },
            {
                name: 'edit',
                resource: 'notebook',
                description: 'Update a sagemaker notebook instance',
                path: 'notebook/{notebookName}',
                method: 'PUT',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                },
            },
            {
                name: 'create',
                resource: 'notebook',
                description: 'Create a sagemaker notebook instance in an MLSpace project',
                path: 'notebook',
                method: 'POST',
                environment: {
                    BUCKET: props.configBucketName,
                    DATA_BUCKET: props.dataBucketName,
                    ENVIRONMENT: props.deploymentEnvironmentName,
                    ROLE_ARN: props.notebookInstanceRole.roleArn,
                    S3_KEY: props.notebookParamFileKey,
                },
            },
            {
                name: 'delete',
                resource: 'notebook',
                description: 'Delete a sagemaker notebook instance in an MLSpace project',
                path: 'notebook/{notebookName}',
                method: 'DELETE',
            },
            {
                name: 'start',
                resource: 'notebook',
                description: 'Starts a sagemaker notebook instance in an MLSpace project',
                path: 'notebook/{notebookName}/start',
                method: 'POST',
            },
            {
                name: 'stop',
                resource: 'notebook',
                description: 'Stop a sagemaker notebook instance in an MLSpace project',
                path: 'notebook/{notebookName}/stop',
                method: 'POST',
            },
            {
                name: 'presigned_url',
                resource: 'notebook',
                description: 'Gets a presigned URL to open a sagemaker notebook instance',
                path: 'notebook/{notebookName}/url',
                method: 'GET',
            },
            {
                id: 'notebooks-get-logs',
                name: 'get',
                resource: 'logs',
                description: 'Returns the log events for the specified notebook',
                path: 'notebook/{notebookName}/logs',
                method: 'GET',
            },
            {
                name: 'set_resource_termination',
                resource: 'resource_scheduler',
                description: 'Update the termination time of a SageMaker Notebook',
                path: 'notebook/{notebookName}/schedule',
                method: 'PUT',
                id: 'resource_scheduler-set-notebook-termination',
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
