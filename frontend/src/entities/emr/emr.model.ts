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

export type EMRClusterSummary = Pick<
    EMRClusterFull,
    'Name' | 'Status' | 'NormalizedInstanceHours' | 'Id'
>;

export type EMRStatus = {
    Timeline: {
        ReadyDateTime: string;
        CreationDateTime: string;
    };
    State: EMRStatusState;
    StateChangeReason: {
        Message: string;
    };
};

export enum EMRStatusState {
    STARTING = 'STARTING',
    BOOTSTRAPPING = 'BOOTSTRAPPING',
    RUNNING = 'RUNNING',
    WAITING = 'WAITING',
    TERMINATING = 'TERMINATING',
    TERMINATED = 'TERMINATED',
    TERMINATED_WITH_ERRORS = 'TERMINATED_WITH_ERRORS',
}

type EMRInstanceFleetCluster = Omit<EMRClusterFull, 'InstanceGroups' | 'ScaleDownBehavior'>;
type EMRUniformInstanceGroupsCluster = Omit<EMRClusterFull, 'InstanceFleets'>;
export type EMRCluster = EMRInstanceFleetCluster | EMRUniformInstanceGroupsCluster;

type EMRClusterFull = {
    Status: EMRStatus;
    Ec2InstanceAttributes: {
        ServiceAccessSecurityGroup: string;
        EmrManagedMasterSecurityGroup: string;
        IamInstanceProfile: string;
        Ec2KeyName: string;
        Ec2AvailabilityZone: string;
        Ec2SubnetId: string;
        EmrManagedSlaveSecurityGroup: string;
    };
    Name: string;
    ServiceRole: string;
    Tags: [];
    TerminationProtected: true;
    ReleaseLabel: string;
    NormalizedInstanceHours: number;
    InstanceGroups: [
        {
            RequestedInstanceCount: number;
            Status: {
                Timeline: {
                    ReadyDateTime: number;
                    CreationDateTime: number;
                    EndDateTime: number;
                };
                State: EMRStatusState;
                StateChangeReason: {
                    Message: '';
                };
            };
            Name: string;
            InstanceGroupType: string;
            Id: string;
            Configurations: [];
            InstanceType: string;
            Market: 'ON_DEMAND' | 'SPOT';
            RunningInstanceCount: number;
        },
        {
            RequestedInstanceCount: number;
            Status: {
                Timeline: {
                    ReadyDateTime: number;
                    CreationDateTime: number;
                    EndDateTime: number;
                };
                State: string;
                StateChangeReason: {
                    Message: '';
                };
            };
            Name: string;
            InstanceGroupType: string;
            Id: string;
            Configurations: [];
            InstanceType: string;
            Market: 'ON_DEMAND' | 'SPOT';
            RunningInstanceCount: number;
        }
    ];
    InstanceFleets: [
        {
            Status: {
                Timeline: {
                    ReadyDateTime: number;
                    CreationDateTime: number;
                };
                State: EMRStatusState;
                StateChangeReason: {
                    Message: '';
                };
            };
            ProvisionedSpotCapacity: number;
            Name: string;
            InstanceFleetType: string;
            LaunchSpecifications: {
                SpotSpecification: {
                    TimeoutDurationMinutes: number;
                    TimeoutAction: 'TERMINATE_CLUSTER' | 'SWITCH_TO_ONDEMAND';
                };
            };
            TargetSpotCapacity: number;
            ProvisionedOnDemandCapacity: number;
            InstanceTypeSpecifications: [
                {
                    BidPrice: string;
                    InstanceType: string;
                    WeightedCapacity: number;
                }
            ];
            Id: string;
            TargetOnDemandCapacity: number;
        }
    ];
    Applications: [
        {
            Name: string;
        }
    ];
    ScaleDownBehavior: string;
    VisibleToAllUsers: true;
    BootstrapActions: [];
    MasterPublicDnsName: string;
    AutoTerminate: false;
    Id: string;
    Configurations: [
        {
            Properties: { [key: string]: string };
            Classification: string;
        }
    ];
    TerminationTime?: number;
    Owner: string;
};
