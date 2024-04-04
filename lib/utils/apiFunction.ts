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

import { Duration, Stack } from 'aws-cdk-lib';
import {
    AuthorizationType,
    Cors,
    IAuthorizer,
    IResource,
    IRestApi,
    LambdaIntegration,
} from 'aws-cdk-lib/aws-apigateway';
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { IRole } from 'aws-cdk-lib/aws-iam';
import { Code, Function, ILayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import {
    ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
    DATASETS_TABLE_NAME,
    MANAGE_IAM_ROLES,
    PROJECTS_TABLE_NAME,
    PROJECT_USERS_TABLE_NAME,
    RESOURCE_METADATA_TABLE_NAME,
    RESOURCE_SCHEDULE_TABLE_NAME,
    SYSTEM_TAG,
    USERS_TABLE_NAME,
    LAMBDA_CONFIGS,
} from '../constants';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export type MLSpacePythonLambdaFunction = {
    id?: string;
    name: string;
    resource?: string;
    description: string;
    path: string;
    method: string;
    environment?: {
        [key: string]: string;
    };
};

export function registerAPIEndpoint (
    stack: Stack,
    api: IRestApi,
    authorizer: IAuthorizer,
    role: IRole,
    notebookRoleName: string,
    lambdaSourcePath: string,
    layers: ILayerVersion[],
    funcDef: MLSpacePythonLambdaFunction,
    vpc: IVpc,
    securityGroups: ISecurityGroup[],
    permissionsBoundaryArn?: string
) {
    const functionId = `mls-lambda-${funcDef.id || [funcDef.resource, funcDef.name].join('-')}`;
    const handler = new Function(stack, functionId, {
        functionName: functionId,
        runtime: Runtime.PYTHON_3_11,
        handler: `ml_space_lambda.${funcDef.resource}.lambda_functions.${funcDef.name}`,
        code: Code.fromAsset(lambdaSourcePath),
        description: funcDef.description,
        environment: {
            DATASETS_TABLE: DATASETS_TABLE_NAME,
            PROJECTS_TABLE: PROJECTS_TABLE_NAME,
            PROJECT_USERS_TABLE: PROJECT_USERS_TABLE_NAME,
            USERS_TABLE: USERS_TABLE_NAME,
            RESOURCE_SCHEDULE_TABLE: RESOURCE_SCHEDULE_TABLE_NAME,
            RESOURCE_METADATA_TABLE: RESOURCE_METADATA_TABLE_NAME,
            SYSTEM_TAG: SYSTEM_TAG,
            MANAGE_IAM_ROLES: MANAGE_IAM_ROLES ? 'True' : '',
            NOTEBOOK_ROLE_NAME: notebookRoleName,
            PERMISSIONS_BOUNDARY_ARN: permissionsBoundaryArn || '',
            ...funcDef.environment,
            ...ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
        },
        timeout: Duration.seconds(180),
        memorySize: 512,
        role,
        layers,
        vpc,
        securityGroups,
        architecture: mapStringToArchitecture(LAMBDA_CONFIGS.architecture),
    });
    const functionResource = getOrCreateResource(stack, api.root, funcDef.path.split('/'));
    functionResource.addMethod(funcDef.method, new LambdaIntegration(handler), {
        authorizer,
        authorizationType: AuthorizationType.CUSTOM,
    });
}

function getOrCreateResource (stack: Stack, parentResource: IResource, path: string[]): IResource {
    let resource = parentResource.getResource(path[0]);
    if (!resource) {
        resource = parentResource.addResource(path[0]);
        resource.addCorsPreflight({
            allowOrigins: Cors.ALL_ORIGINS,
            allowHeaders: [
                ...Cors.DEFAULT_HEADERS,
                'x-mlspace-dataset-scope',
                'x-mlspace-dataset-type',
                'x-mlspace-project',
            ],
        });
    }
    if (path.length > 1) {
        return getOrCreateResource(stack, resource, path.slice(1));
    }
    return resource;
}

// Mapping string to Architecture enum
export const mapStringToArchitecture = (arch: string): lambda.Architecture => {
    switch (arch) {
        case 'arm64':
            return lambda.Architecture.ARM_64;
        case 'x86_64':
            return lambda.Architecture.X86_64;
        default:
            throw new Error(`Unsupported architecture: ${arch}`);
    }
};
