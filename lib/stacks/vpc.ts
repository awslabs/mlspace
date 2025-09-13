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
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { VPCConstruct } from '../constructs/vpcConstruct';
import { MLSpaceConfig } from '../utils/configTypes';

export type VPCStackProps = {
    readonly deployCFNEndpoint: boolean;
    readonly deployCWEndpoint: boolean;
    readonly deployCWLEndpoint: boolean;
    readonly deployDDBEndpoint: boolean;
    readonly deployEMREndpoint: boolean;
    readonly deployS3Endpoint: boolean;
    readonly deploySTSEndpoint: boolean;
    readonly deployTranslateEndpoint: boolean;
    readonly isIso?: boolean;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class VPCStack extends Stack {
    public readonly vpc: IVpc;
    public readonly vpcSecurityGroupId: string;
    public readonly vpcSecurityGroup: ISecurityGroup;

    constructor (parent: App, name: string, props: VPCStackProps) {
        super(parent, name, {
            terminationProtection: false,
            ...props,
        });

        const vpcConstruct = new VPCConstruct(this, name, props);
        
        this.vpc = vpcConstruct.vpc;
        this.vpcSecurityGroupId = vpcConstruct.vpcSecurityGroupId;
        this.vpcSecurityGroup = vpcConstruct.vpcSecurityGroup;
    }
}
