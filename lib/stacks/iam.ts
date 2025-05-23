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
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import {
    IManagedPolicy,
    IRole,
} from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { MLSpaceConfig } from '../utils/configTypes';
import { IAMConstruct } from '../constructs/iamConstruct';

export type IAMStackProp = {
    readonly dataBucketName: string;
    readonly configBucketName: string;
    readonly websiteBucketName: string;
    readonly encryptionKey: IKey;
    readonly mlSpaceVPC: IVpc;
    readonly mlSpaceDefaultSecurityGroupId: string;
    readonly enableTranslate: boolean;
    readonly isIso?: boolean;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class IAMStack extends Stack {
    public mlSpaceAppRole: IRole;
    public mlSpaceNotebookRole: IRole;
    public s3ReaderRole: IRole;
    public mlSpacePermissionsBoundary?: IManagedPolicy;
    public emrServiceRoleName: string;
    public emrEC2RoleName: string;
    public mlspaceEndpointConfigInstanceConstraintPolicy?: IManagedPolicy;
    public mlspaceJobInstanceConstraintPolicy?: IManagedPolicy;
    public mlSpaceSystemRole: IRole;
    public mlspaceKmsInstanceConditionsPolicy: IManagedPolicy;

    constructor (parent: App, name: string, props: IAMStackProp) {
        super(parent, name, {
            terminationProtection: false,
            ...props,
        });

        const iamConstruct = new IAMConstruct(this, name, props);
        
        this.mlSpaceAppRole = iamConstruct.mlSpaceAppRole;
        this.mlSpaceNotebookRole = iamConstruct.mlSpaceNotebookRole;
        this.s3ReaderRole = iamConstruct.s3ReaderRole;
        this.mlSpacePermissionsBoundary = iamConstruct.mlSpacePermissionsBoundary;
        this.emrServiceRoleName = iamConstruct.emrServiceRoleName;
        this.emrEC2RoleName = iamConstruct.emrEC2RoleName;
        this.mlspaceEndpointConfigInstanceConstraintPolicy = iamConstruct.mlspaceEndpointConfigInstanceConstraintPolicy;
        this.mlspaceJobInstanceConstraintPolicy = iamConstruct.mlspaceJobInstanceConstraintPolicy;
        this.mlSpaceSystemRole = iamConstruct.mlSpaceSystemRole;
        this.mlspaceKmsInstanceConditionsPolicy = iamConstruct.mlspaceKmsInstanceConditionsPolicy;

    }
}
