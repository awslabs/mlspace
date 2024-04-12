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
    GatewayVpcEndpointAwsService,
    ISecurityGroup,
    IVpc,
    InterfaceVpcEndpointAwsService,
    InterfaceVpcEndpointService,
    SecurityGroup,
    SubnetType,
    Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { MLSpaceConfig } from '../utils/configTypes';

export type VPCStackProps = {
    readonly deployCFNEndpoint: boolean;
    readonly deployCWEndpoint: boolean;
    readonly deployCWLEndpoint: boolean;
    readonly deployDDBEndpoint: boolean;
    readonly deployS3Endpoint: boolean;
    readonly deploySTSEndpoint: boolean;
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

        const isIsoB = this.region === 'us-isob-east-1';
        const isIsoEast = this.region === 'us-iso-east-1';
        const isIsoWest = this.region === 'us-iso-west-1';

        if (props.mlspaceConfig.EXISTING_VPC_NAME && props.mlspaceConfig.EXISTING_VPC_ID && props.mlspaceConfig.EXISTING_VPC_DEFAULT_SECURITY_GROUP) {
            this.vpc = Vpc.fromLookup(this, 'imported-vpc', {
                vpcId: props.mlspaceConfig.EXISTING_VPC_ID,
                vpcName: props.mlspaceConfig.EXISTING_VPC_NAME,
            });
            this.vpcSecurityGroupId = props.mlspaceConfig.EXISTING_VPC_DEFAULT_SECURITY_GROUP;
        } else {
            const mlSpaceVPC = new Vpc(this, 'MLSpace-VPC', {
                enableDnsHostnames: true,
                enableDnsSupport: true,
                maxAzs: isIsoB ? 2 : 3,
                subnetConfiguration: [
                    {
                        cidrMask: 23,
                        name: 'MLSpace-Public',
                        subnetType: SubnetType.PUBLIC,
                    },
                    {
                        cidrMask: 23,
                        name: 'MLSpace-Private',
                        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                    },
                ],
            });

            this.vpc = mlSpaceVPC;
            this.vpcSecurityGroupId = mlSpaceVPC.vpcDefaultSecurityGroup;
            if (props.deployS3Endpoint) {
                this.vpc.addGatewayEndpoint('mlspace-S3-gateway-endpoint', {
                    service: GatewayVpcEndpointAwsService.S3,
                });
            }

            // DBB VPC endpoints exist iso-east but do in isob and iso-west
            if (props.deployDDBEndpoint && !isIsoEast) {
                this.vpc.addGatewayEndpoint('mlspace-ddb-gateway-endpoint', {
                    service: GatewayVpcEndpointAwsService.DYNAMODB,
                });
            }

            if (props.deployCWEndpoint && !props.isIso) {
                this.vpc.addInterfaceEndpoint('mlspace-cw-interface-endpoint', {
                    service: InterfaceVpcEndpointAwsService.CLOUDWATCH,
                    privateDnsEnabled: true,
                });
            }

            if (props.deployCWLEndpoint && !props.isIso) {
                this.vpc.addInterfaceEndpoint('mlspace-cwl-interface-endpoint', {
                    service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
                    privateDnsEnabled: true,
                });
            }

            let partitionPrefix;
            if (isIsoEast || isIsoWest) {
                // eslint-disable-next-line spellcheck/spell-checker
                partitionPrefix = 'gov.ic.c2s';
            } else if (isIsoB) {
                // eslint-disable-next-line spellcheck/spell-checker
                partitionPrefix = 'gov.sgov.sc2s';
            }

            this.vpc.addInterfaceEndpoint('mlspace-sm-api-interface-endpoint', {
                service: partitionPrefix
                    ? new InterfaceVpcEndpointService(
                        `${partitionPrefix}.${this.region}.sagemaker.api`
                    )
                    : InterfaceVpcEndpointAwsService.SAGEMAKER_API,
                privateDnsEnabled: true,
            });

            this.vpc.addInterfaceEndpoint('mlspace-sm-runtime-interface-endpoint', {
                service: partitionPrefix
                    ? new InterfaceVpcEndpointService(
                        `${partitionPrefix}.${this.region}.sagemaker.runtime`
                    )
                    : InterfaceVpcEndpointAwsService.SAGEMAKER_RUNTIME,
                privateDnsEnabled: true,
            });

            this.vpc.addInterfaceEndpoint('mlspace-sm-notebook-interface-endpoint', {
                service: InterfaceVpcEndpointAwsService.SAGEMAKER_NOTEBOOK,
                privateDnsEnabled: true,
            });

            if (props.deploySTSEndpoint && !props.isIso) {
                this.vpc.addInterfaceEndpoint('mlspace-sts-interface-endpoint', {
                    service: InterfaceVpcEndpointAwsService.STS,
                    privateDnsEnabled: true,
                });
            }

            if (props.deployCFNEndpoint && !props.isIso) {
                this.vpc.addInterfaceEndpoint('mlspace-cfn-interface-endpoint', {
                    service: InterfaceVpcEndpointAwsService.CLOUDFORMATION,
                    privateDnsEnabled: true,
                });
            }
        }
        this.vpcSecurityGroup = SecurityGroup.fromSecurityGroupId(
            this,
            'mls-vpc-default-sg}',
            this.vpcSecurityGroupId
        );
    }
}
