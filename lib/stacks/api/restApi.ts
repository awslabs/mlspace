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

import { App, Stack, StackProps } from 'aws-cdk-lib';
import {
    IAuthorizer,
    RequestAuthorizer,
} from 'aws-cdk-lib/aws-apigateway';
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { IManagedPolicy, IRole } from 'aws-cdk-lib/aws-iam';
import { MLSpaceConfig } from '../../utils/configTypes';
import { RestApiConstruct } from '../../constructs/api/restApiConstruct';


export type ApiStackProperties = {
    readonly restApiId: string;
    readonly rootResourceId: string;
    readonly dataBucketName: string;
    readonly cwlBucketName: string;
    readonly applicationRole: IRole;
    readonly systemRole: IRole;
    readonly notebookInstanceRole: IRole;
    readonly endpointConfigInstanceConstraintPolicy?: IManagedPolicy,
    readonly jobInstanceConstraintPolicy?: IManagedPolicy,
    readonly mlspaceKmsInstanceConditionsPolicy?: IManagedPolicy,
    readonly configBucketName: string;
    readonly notebookParamFileKey: string;
    readonly deploymentEnvironmentName: string;
    readonly authorizer: IAuthorizer;
    readonly lambdaSourcePath: string;
    readonly mlSpaceVPC: IVpc;
    readonly securityGroups: ISecurityGroup[];
    readonly permissionsBoundaryArn?: string;
    readonly emrEC2RoleName?: string;
    readonly emrServiceRoleName?: string;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export type RestApiStackProperties = {
    readonly frontEndAssetsPath: string;
    readonly lambdaSourcePath: string;
    readonly dataBucketName: string;
    readonly websiteBucketName: string;
    readonly websiteS3ReaderRole: IRole;
    readonly mlSpaceAppRole: IRole;
    readonly verifyOIDCTokenSignature: boolean;
    readonly mlSpaceVPC: IVpc;
    readonly lambdaSecurityGroups: ISecurityGroup[];
    readonly isIso?: boolean;
    readonly enableTranslate: boolean;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class RestApiStack extends Stack {
    public mlspaceRequestAuthorizer: RequestAuthorizer;
    public mlSpaceRestApiId: string;
    public mlSpaceRestApiRootResourceId: string;

    constructor (parent: App, id: string, props: RestApiStackProperties) {
        super(parent, id, {
            terminationProtection: false,
            ...props,
        });
       
        const restApiConstruct = new RestApiConstruct(this, id + 'Resources', props);
        
        this.mlspaceRequestAuthorizer = restApiConstruct.mlspaceRequestAuthorizer;
        this.mlSpaceRestApiId = restApiConstruct.mlSpaceRestApiId;
        this.mlSpaceRestApiRootResourceId = restApiConstruct.mlSpaceRestApiRootResourceId;

    }
}
