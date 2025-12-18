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
import { Construct } from 'constructs';
import { VPCStackProps } from '../stacks/vpc';
import { createRegionInformationProvider } from '../utils/rip';

export class VPCConstruct extends Construct {
    public readonly vpc: IVpc;
    public readonly vpcSecurityGroupId: string;
    public readonly vpcSecurityGroup: ISecurityGroup;

    constructor (scope: Stack, id: string, props: VPCStackProps) {
        super(scope, id);

        const regionInformation = createRegionInformationProvider().getRegionInformation(scope.region);
        console.log(regionInformation);

        if (props.mlspaceConfig.EXISTING_VPC_NAME && 
            props.mlspaceConfig.EXISTING_VPC_ID && 
            props.mlspaceConfig.EXISTING_VPC_DEFAULT_SECURITY_GROUP) {
            this.vpc = Vpc.fromLookup(scope, 'imported-vpc', {
                vpcId: props.mlspaceConfig.EXISTING_VPC_ID,
                vpcName: props.mlspaceConfig.EXISTING_VPC_NAME,
            });
            this.vpcSecurityGroupId = props.mlspaceConfig.EXISTING_VPC_DEFAULT_SECURITY_GROUP;
        } else {
            const mlSpaceVPC = new Vpc(scope, 'MLSpace-VPC', {
                enableDnsHostnames: true,
                enableDnsSupport: true,
                availabilityZones: regionInformation.availabilityZones,
                restrictDefaultSecurityGroup: false,
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

            if (props.deployDDBEndpoint && regionInformation.isSupported('vpc/GatewayVpcEndpointAwsService', 'DYNAMODB')) {
                this.vpc.addGatewayEndpoint('mlspace-ddb-gateway-endpoint', {
                    service: GatewayVpcEndpointAwsService.DYNAMODB,
                });
            }

            if (props.deployCWEndpoint && regionInformation.isSupported('vpc/GatewayVpcEndpointAwsService', 'CLOUDWATCH_MONITORING')) {
                this.vpc.addInterfaceEndpoint('mlspace-cw-interface-endpoint', {
                    service: InterfaceVpcEndpointAwsService.CLOUDWATCH_MONITORING,
                    privateDnsEnabled: true,
                });
            }

            if (props.deployCWLEndpoint && !props.isIso) {
                this.vpc.addInterfaceEndpoint('mlspace-cwl-interface-endpoint', {
                    service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
                    privateDnsEnabled: true,
                });
            }

            this.vpc.addInterfaceEndpoint('mlspace-sm-api-interface-endpoint', {
                service: regionInformation.isSupported('vpc/InterfaceVpcEndpointService', 'SAGEMAKER_API') ?
                    new InterfaceVpcEndpointService(
                        [regionInformation.partitionPrefix, regionInformation.name, 'sagemaker.api'].join('.')
                    )
                    : InterfaceVpcEndpointAwsService.SAGEMAKER_API,
                privateDnsEnabled: true,
            });

            this.vpc.addInterfaceEndpoint('mlspace-sm-runtime-interface-endpoint', {
                service: regionInformation.isSupported('vpc/InterfaceVpcEndpointService', 'SAGEMAKER_RUNTIME') ?
                    new InterfaceVpcEndpointService(
                        [regionInformation.partitionPrefix, regionInformation.name, 'sagemaker.runtime'].join('.')
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

            if (props.deployTranslateEndpoint && !props.isIso) {
                this.vpc.addInterfaceEndpoint('mlspace-translate-interface-endpoint', {
                    service: InterfaceVpcEndpointAwsService.TRANSLATE,
                    privateDnsEnabled: true,
                });
            }

            if (props.deployEMREndpoint && !props.isIso) {
                this.vpc.addInterfaceEndpoint('mlspace-emr-interface-endpoint', {
                    service: InterfaceVpcEndpointAwsService.EMR,
                    privateDnsEnabled: true,
                });
            }
        }
        
        this.vpcSecurityGroup = SecurityGroup.fromSecurityGroupId(
            scope,
            'mls-vpc-default-sg',
            this.vpcSecurityGroupId
        );
    }
}
