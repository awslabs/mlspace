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

import { MLSpaceConfig } from './configTypes';
import * as fs from 'fs';


export function generateAppConfig (mlspaceConfig: MLSpaceConfig) {
    //Check for properties set in config.json and default to that value if it exists
    let clusterConfig = undefined;
    let applicationList = [];
    if (fs.existsSync('lib/resources/config/cluster-config.json')) {
        clusterConfig = JSON.parse(
            fs.readFileSync('lib/resources/config/cluster-config.json').toString('utf8')
        );
        if (clusterConfig['applications']) {
            for (const application of clusterConfig['applications']) {
                applicationList.push({'M': {'name': {'S': application['Name']}}});
            }
        }
    } else {
        applicationList = [
            {'M': {'name': {'S': 'Hadoop'}}},
            {'M': {'name': {'S': 'Spark'}}},
            {'M': {'name': {'S': 'Ganglia'}}},
            {'M': {'name': {'S': 'Hive'}}},
            {'M': {'name': {'S': 'Tez'}}},
            {'M': {'name': {'S': 'Presto'}}},
            {'M': {'name': {'S': 'Livy'}}}
        ];
    }

    const date = new Date();
    return {
        'versionId': {'N': '0'},
        'changedBy': {'S': 'InitialConfig'},
        'configScope': {'S': 'global'},
        'changeReason': {'S': 'Initial deployment default config'},
        'createdAt': {'S': Math.round(date.getTime() / 1000).toString()},
        'configuration': {'M': {
            'EnabledServices': {'M': {
                'realtimeTranslate': {'BOOL': mlspaceConfig.ENABLE_TRANSLATE ? 'True' : 'False'},
                'batchTranslate': {'BOOL': mlspaceConfig.ENABLE_TRANSLATE ? 'True' : 'False'},
                'emrCluster': {'BOOL': 'True'},
                'endpoint': {'BOOL': 'True'},
                'endpointConfig': {'BOOL': 'True'},
                'labelingJob': {'BOOL': mlspaceConfig.ENABLE_GROUNDTRUTH ? 'True' : 'False'},
                'transformJob': {'BOOL': 'True'},
                'notebook': {'BOOL': 'True'},
                'trainingJob': {'BOOL': 'True'},
                'model': {'BOOL': 'True'},
                'hpoJob': {'BOOL': 'True'},
            }},
            'ProjectCreation': {'M': {
                'isAdminOnly': {'BOOL': 'False'},
                'allowedGroups': {'L':
                [

                ]}
            }},
            'SystemBanner': {'M': {
                'isEnabled': {'BOOL': mlspaceConfig.SYSTEM_BANNER_TEXT !== ''},
                'text': {'S': mlspaceConfig.SYSTEM_BANNER_TEXT},
                'textColor': {'S': mlspaceConfig.SYSTEM_BANNER_TEXT_COLOR},
                'backgroundColor': {'S': mlspaceConfig.SYSTEM_BANNER_BACKGROUND_COLOR}
            }},
            'EMRConfig': {'M': {
                'autoScaling': {'M': {
                    'minInstances': {'N': clusterConfig['auto-scaling']['min-instances'] || '2'},
                    'maxInstances': {'N': clusterConfig['auto-scaling']['max-instances'] || '15'},
                    'scaleOut': {'M': {
                        'cooldown': {'N': clusterConfig['auto-scaling']['scale-out']['cooldown'] || '300'},
                        'increment': {'N': clusterConfig['auto-scaling']['scale-out']['increment'] || '1'},
                        'evalPeriods': {'N': clusterConfig['auto-scaling']['scale-out']['eval-periods'] || '1'},
                        'percentageMemAvailable': {'N': clusterConfig['auto-scaling']['scale-out']['percentage-mem-available'] || '15'}}},
                    'scaleIn': {'M': {
                        'cooldown': {'N': clusterConfig['auto-scaling']['scale-in']['cooldown'] || '300'},
                        'increment': {'N': clusterConfig['auto-scaling']['scale-in']['increment'] || '-1'},
                        'evalPeriods': {'N': clusterConfig['auto-scaling']['scale-in']['eval-periods'] || '1'},
                        'percentageMemAvailable': {'N': clusterConfig['auto-scaling']['scale-in']['percentage-mem-available'] || '75'}}},
                }},
                'clusterSizes': {'L': [
                    {'M': {
                        'name': {'S': clusterConfig['Small'] || 'Small'},
                        'size': {'N': clusterConfig['Small']['size'] || '3'},
                        'masterType': {'S': clusterConfig['Small']['master-type'] || 'm5.xlarge'},
                        'coreType': {'S': clusterConfig['Small']['core-type'] || 'm5.xlarge'},
                    }},
                    {'M': {
                        'name': {'S': clusterConfig['Medium'] || 'Medium'},
                        'size': {'N': clusterConfig['Medium']['size'] || '5'},
                        'masterType': {'S': clusterConfig['Medium']['master-type'] || 'm5.xlarge'},
                        'coreType': {'S': clusterConfig['Medium']['core-type'] || 'm5.xlarge'},
                    }},
                    {'M': {
                        'name': {'S': clusterConfig['Large'] || 'Large'},
                        'size': {'N': clusterConfig['Large']['size'] || '7'},
                        'masterType': {'S': clusterConfig['Large']['master-type'] || 'm5.xlarge'},
                        'coreType': {'S': clusterConfig['Large']['core-type'] || 'p3.8xlarge'},
                    }}
                ]},
                'applications': {'L': applicationList}
            }
            },
            'DisabledInstanceTypes': {'M': {
                'trainingJob': {'L':
                [

                ]},
                'endpoint': {'L':
                [

                ]},
                'transformJob': {'L':
                [

                ]},
                'notebook': {'L':
                [

                ]}
            }
            }
        }},
    };
}

