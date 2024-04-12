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

export class TranslateApiStack extends Stack {
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
                name: 'translate_text',
                resource: 'translate_realtime',
                description:
                    'Perform a real-time translation of a source text, with a source and target language',
                path: 'translate/realtime/text',
                method: 'POST',
            },
            {
                name: 'translate_document',
                resource: 'translate_realtime',
                description:
                    'Perform a real-time translation of a source document, with a source and target language',
                path: 'translate/realtime/document',
                method: 'POST',
            },
            {
                name: 'describe',
                resource: 'batch_translate',
                description: 'Describe a Batch Translate job',
                path: 'batch-translate/{jobId}',
                method: 'GET',
            },
            {
                name: 'create',
                resource: 'batch_translate',
                description: 'Create a Batch Translate job in an MLSpace project',
                path: 'batch-translate',
                method: 'POST',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                    DATA_BUCKET: props.dataBucketName,
                    TRANSLATE_DATE_ROLE_ARN: props.applicationRole.roleArn,
                },
            },
            {
                name: 'stop',
                resource: 'batch_translate',
                description: 'Stop a Batch Translate job',
                path: 'batch-translate/{jobId}/stop',
                method: 'POST',
            },
            {
                name: 'list_languages',
                resource: 'metadata',
                description: 'List the supported languages for AWS Translate',
                path: 'translate/list-languages',
                method: 'GET',
            },
            {
                name: 'list',
                resource: 'custom_terminology',
                description: 'List pages of Custom Terminologies for AWS Translate',
                path: 'translate/custom-terminologies',
                method: 'GET',
            },
        ];

        apis.forEach((f) => {
            registerAPIEndpoint(
                this,
                restApi,
                props.authorizer,
                props.applicationRole,
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
