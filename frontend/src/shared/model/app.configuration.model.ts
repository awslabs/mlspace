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
export type IServiceInstanceTypes = {
    notebook: string[];
    endpoint: string[];
    trainingJob: string[];
    transformJob: string[];
};

export type IEnabledServices = {
    batchTranslate: boolean;
    realtimeTranslate: boolean;
    emrCluster: boolean;
    endpoint: boolean;
    endpointConfig: boolean;
    hpoJob: boolean;
    labelingJob: boolean;
    model: boolean;
    notebook: boolean;
    trainingJob: boolean;
    transformJob: boolean;
};

export type IEMRConfig = {
    clusterSizes: ClusterSize[];
    autoScaling: AutoScaling;
    applications: Application[];
};

export type ClusterSize = {
    name: string;
    size: number;
    masterType: string;
    coreType: string;
};

export type AutoScaling = {
    minInstances: number;
    maxInstances: number;
    scaleOut: ScalingPolicy;
    scaleIn: ScalingPolicy;
};

export type ScalingPolicy = {
    increment: number;
    percentageMemAvailable: number;
    evalPeriods: number;
    cooldown: number;
};

export type Application = {
    name: string;
};

export type IProjectCreation = {
    isAdminOnly: boolean;
    allowedGroups: string[];
};

export type ISystemBanner = {
    isEnabled: boolean;
    textColor: string;
    backgroundColor: string;
    text: string;
};

export type BaseSettings = {
    EnabledInstanceTypes: IServiceInstanceTypes;
    EnabledServices: IEnabledServices;
    EMRConfig: IEMRConfig;
};

export type AppSettings = BaseSettings & {
    ProjectCreation: IProjectCreation;
    SystemBanner: ISystemBanner;
};

export type BaseConfiguration = {
    configScope: string;
    versionId: number;
    createdAt: number;
    changedBy: string;
    changeReason: string;
};

export type IAppConfiguration = BaseConfiguration & {
    configuration: AppSettings;
};

export const defaultConfiguration: IAppConfiguration = {
    configScope: '',
    versionId: 0,
    createdAt: 0,
    changedBy: '',
    changeReason: '',
    configuration: {
        EnabledInstanceTypes: {
            notebook: [],
            endpoint: [],
            trainingJob: [],
            transformJob: []
        },
        EnabledServices: {
            batchTranslate: false,
            realtimeTranslate: false,
            emrCluster: false,
            endpoint: false,
            endpointConfig: false,
            hpoJob: false,
            labelingJob: false,
            model: false,
            notebook: false,
            trainingJob: false,
            transformJob: false,
        },
        EMRConfig: {
            clusterSizes: [{
                name: '',
                size: 0,
                masterType: '',
                coreType: ''
            }],
            autoScaling: {
                minInstances: 0,
                maxInstances: 0,
                scaleOut: {
                    increment: 0,
                    percentageMemAvailable: 0,
                    evalPeriods: 0,
                    cooldown: 0
                },
                scaleIn: {
                    increment: 0,
                    percentageMemAvailable: 0,
                    evalPeriods: 0,
                    cooldown: 0
                }
            },
            applications: [{
                name: ''
            }]
        },
        ProjectCreation: {
            isAdminOnly: true,
            allowedGroups: []
        },
        SystemBanner: {
            isEnabled: false,
            backgroundColor: '',
            textColor: '',
            text: ''
        }
    }
};
