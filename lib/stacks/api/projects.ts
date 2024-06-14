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

export class ProjectsApiStack extends Stack {
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
                resource: 'project',
                description: 'List all MLSpace projects',
                path: 'project',
                method: 'GET',
            },
            {
                name: 'create',
                resource: 'project',
                description: 'Create a new MLSpace project',
                path: 'project',
                method: 'POST',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'project_users',
                resource: 'project',
                description: 'Lists users that belong to a project',
                path: 'project/{projectName}/users',
                method: 'GET',
            },
            {
                name: 'add_users',
                resource: 'project',
                description: 'Adds users to a project',
                path: 'project/{projectName}/users',
                method: 'POST',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'update_project_user',
                resource: 'project',
                description: 'Change the role of an MLSpace user within a project',
                path: 'project/{projectName}/users/{username}',
                method: 'PUT',
            },
            {
                name: 'delete',
                resource: 'project',
                description: 'Delete an MLSpace project',
                path: 'project/{projectName}',
                method: 'DELETE',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'get',
                resource: 'project',
                description: 'Gets the corresponding project object',
                path: 'project/{projectName}',
                method: 'GET',
            },
            {
                name: 'remove_user',
                resource: 'project',
                description: 'Removes a user from a project',
                path: 'project/{projectName}/users/{username}',
                method: 'DELETE',
                environment: {
                    DATA_BUCKET: props.dataBucketName,
                },
            },
            {
                name: 'update',
                resource: 'project',
                description: 'Updates project state (suspended/active)',
                path: 'project/{projectName}',
                method: 'PUT',
            },
            {
                name: 'list_resources',
                resource: 'training_job',
                description: 'List training jobs',
                path: 'project/{projectName}/jobs/training',
                method: 'GET',
            },
            {
                name: 'list_resources',
                resource: 'transform_job',
                description: 'Lists transform jobs',
                path: 'project/{projectName}/jobs/transform',
                method: 'GET',
            },
            {
                name: 'list_resources',
                resource: 'hpo_job',
                description: 'Lists HPO jobs',
                path: 'project/{projectName}/jobs/hpo',
                method: 'GET',
            },
            {
                name: 'list_resources',
                resource: 'labeling_job',
                description: 'List Ground Truth labeling jobs',
                path: 'project/{projectName}/jobs/labeling',
                method: 'GET',
            },
            {
                name: 'list_workteams',
                resource: 'labeling_job',
                description: 'Describes a Ground Truth workteams',
                path: 'project/{projectName}/jobs/labeling/teams',
                method: 'GET',
            },
            {
                name: 'list_resources',
                resource: 'notebook',
                description: 'List all notebook instances in MLSpace',
                path: 'project/{projectName}/notebooks',
                method: 'GET',
            },
            {
                name: 'list_resources',
                resource: 'model',
                description: 'List models',
                path: 'project/{projectName}/models',
                method: 'GET',
            },
            {
                name: 'list_resources',
                resource: 'endpoint',
                description: 'Lists endpoints',
                path: 'project/{projectName}/endpoints',
                method: 'GET',
            },
            {
                name: 'list_resources',
                resource: 'endpoint_config',
                description: 'Lists endpoint configs',
                path: 'project/{projectName}/endpoint-configs',
                method: 'GET',
            },
            {
                name: 'list_resources',
                resource: 'dataset',
                description: 'List all datasets associated with the specified project',
                path: 'project/{projectName}/datasets',
                method: 'GET',
            },
            {
                name: 'list_all',
                resource: 'emr',
                description: 'List all EMR Clusters in MLSpace',
                path: 'project/{projectName}/emr',
                method: 'GET',
            },
            {
                name: 'create',
                resource: 'emr',
                description: 'Create an EMR Cluster in an MLSpace project',
                path: 'project/{projectName}/emr',
                method: 'POST',
                environment: {
                    BUCKET: props.configBucketName,
                    S3_KEY: props.notebookParamFileKey,
                    EMR_SECURITY_CONFIGURATION: props.mlspaceConfig.EMR_SECURITY_CONFIG_NAME,
                    EMR_EC2_ROLE_NAME: props.emrEC2RoleName || '',
                    EMR_SERVICE_ROLE_NAME: props.emrServiceRoleName || '',
                    EMR_EC2_SSH_KEY: props.mlspaceConfig.EMR_EC2_SSH_KEY,
                    DATA_BUCKET: props.dataBucketName,
                    LOG_BUCKET: props.cwlBucketName,
                },
            },
            {
                name: 'list',
                resource: 'batch_translate',
                description: 'List pages of Batch Translate jobs for a project in MLSpace',
                path: 'project/{projectName}/batch-translate-jobs',
                method: 'GET',
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
