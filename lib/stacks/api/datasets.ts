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

export class DatasetsApiStack extends Stack {
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
                name: 'presigned_url',
                resource: 'dataset',
                description: 'Generates presigned url for MLSpace Dataset',
                path: 'dataset/presigned-url',
                method: 'POST',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'create_dataset',
                resource: 'dataset',
                description: 'Creates a new dataset',
                path: 'dataset/create',
                method: 'POST',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                id: 'dataset-personal',
                name: 'list_resources',
                resource: 'dataset',
                description: 'List all global, group, and private datasets for user',
                path: 'dataset',
                method: 'GET',
            },
            {
                name: 'edit',
                resource: 'dataset',
                description: 'Edits dataset',
                path: 'dataset/{type}/{scope}/{datasetName}',
                method: 'PUT',
            },
            {
                name: 'get',
                resource: 'dataset',
                description: 'Gets dataset details',
                path: 'dataset/{type}/{scope}/{datasetName}',
                method: 'GET',
            },
            {
                name: 'delete',
                resource: 'dataset',
                description: 'Removes a dataset from an MLSpace project',
                path: 'dataset/{type}/{scope}/{datasetName}',
                method: 'DELETE',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'delete_file',
                resource: 'dataset',
                description: 'Removes a file from a dataset',
                // use a greedy path here so object keys containing '/' are fully matched
                path: 'dataset/{type}/{scope}/{datasetName}/{file+}',
                method: 'DELETE',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'list_files',
                resource: 'dataset',
                description: 'List all file in a dataset',
                path: 'dataset/{type}/{scope}/{datasetName}/files',
                method: 'GET',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
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
