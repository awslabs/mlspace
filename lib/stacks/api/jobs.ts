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

export class JobsApiStack extends Stack {
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
                name: 'list_training_jobs',
                resource: 'hpo_job',
                description: 'List HPO training jobs',
                path: 'job/hpo/{jobName}/training-jobs',
                method: 'GET',
            },
            {
                name: 'describe',
                resource: 'training_job',
                description: 'Returns the description of a given training job',
                path: 'job/training/{jobName}',
                method: 'GET',
            },
            {
                name: 'create',
                resource: 'training_job',
                description: 'Creates a new training job',
                path: 'job/training',
                method: 'POST',
                environment: {
                    ROLE_ARN: props.notebookInstanceRole.roleArn,
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                    ENVIRONMENT: props.deploymentEnvironmentName,
                },
            },
            {
                name: 'create',
                resource: 'transform_job',
                description: 'Creates a transform job',
                path: 'job/transform',
                method: 'POST',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                    ENVIRONMENT: props.deploymentEnvironmentName,
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'stop',
                resource: 'transform_job',
                description: 'Stop transform job',
                path: 'job/transform/{jobName}/stop',
                method: 'POST',
            },
            {
                name: 'describe',
                resource: 'transform_job',
                description: 'Describes a transform job',
                path: 'job/transform/{jobName}',
                method: 'GET',
            },
            {
                name: 'create',
                resource: 'hpo_job',
                description: 'Creates a HPO job',
                path: 'job/hpo',
                method: 'POST',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                    ENVIRONMENT: props.deploymentEnvironmentName,
                },
            },
            {
                name: 'stop',
                resource: 'hpo_job',
                description: 'Stop HPO job',
                path: 'job/hpo/{jobName}/stop',
                method: 'POST',
            },
            {
                name: 'describe',
                resource: 'hpo_job',
                description: 'Describes a HPO job',
                path: 'job/hpo/{jobName}',
                method: 'GET',
            },
            {
                id: 'job-get-logs',
                name: 'get',
                resource: 'logs',
                description: 'Returns the log events for the specified job',
                path: 'job/{jobType}/{jobName}/logs',
                method: 'GET',
            },
            {
                name: 'describe',
                resource: 'labeling_job',
                description: 'Describes a Ground Truth labeling job',
                path: 'job/labeling/{jobName}',
                method: 'GET',
            },
            {
                name: 'create',
                resource: 'labeling_job',
                description: 'Creates a Labeling job',
                path: 'job/labeling',
                method: 'POST',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                    ENVIRONMENT: props.deploymentEnvironmentName,
                },
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
