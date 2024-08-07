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

import * as fs from 'fs';


export function generateAppConfig () {
    //Create a default clusterConfig in case cluster-config.json doesn't exist
    let clusterConfig = {
        'Small': {
            'size' : 3,
            'master-type' : 'm5.xlarge',
            'core-type' : 'm5.xlarge'
        },
        'Medium': {
            'size' : 5,
            'master-type' : 'm5.xlarge',
            'core-type' : 'm5.xlarge'
        },
        'Large': {
            'size' : 7,
            'master-type' : 'm5.xlarge',
            'core-type' : 'p3.8xlarge'
        },
        'auto-scaling': {
            'min-instances' : 2,
            'max-instances': 15,
            'scale-out': {
                'increment': 1,
                'percentage-mem-available': 15.0,
                'eval-periods': 1,
                'cooldown': 300
            },
            'scale-in': {
                'increment': -1,
                'percentage-mem-available': 75.0,
                'eval-periods': 1,
                'cooldown': 300
            }
        },
        'applications' : [
            {
                'Name': 'Hadoop'
            },
            {
                'Name': 'Spark'
            },
            {
                'Name': 'Ganglia'
            },
            {
                'Name': 'Hive'
            },
            {
                'Name': 'Tez'
            },
            {
                'Name': 'Presto'
            },
            {
                'Name': 'Livy'
            }
        ]
    };
    const applicationList = [];
    //Check for properties set in config.json and default to that value if it exists
    if (fs.existsSync('lib/resources/config/cluster-config.json')) {
        clusterConfig = JSON.parse(
            fs.readFileSync('lib/resources/config/cluster-config.json').toString('utf8')
        );
    }
    // This may not be set in the user's cluster-config (if it existed)
    if (clusterConfig['applications']) {
        for (const application of clusterConfig['applications']) {
            applicationList.push({'M': {'Name': {'S': application['Name']}}});
        }
    }
    const clusterTypes = [];
    //List of high level keys to skip since they won't be cluster types
    const skipKeys = ['ami', 'release', 'log-location', 'ec2-key', 'applications', 'auto-scaling'];
    let key: keyof typeof clusterConfig;
    for (key in clusterConfig){
        if (!skipKeys.includes(key)) {
            const clusterType = clusterConfig[key];
            const masterType = 'master-type';
            const coreType = 'core-type';
            clusterTypes.push({'M': {
                'name': {'S': key},
                'size': {'N': String(clusterType['size' as keyof typeof clusterType])},
                'masterType': {'S': clusterType[masterType as keyof typeof clusterType]},
                'coreType': {'S': clusterType[coreType as keyof typeof clusterType]},
            }});
        }
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
                'realtimeTranslate': {'BOOL': 'False'},
                'batchTranslate': {'BOOL': 'False'},
                'emrCluster': {'BOOL': 'True'},
                'endpoint': {'BOOL': 'True'},
                'endpointConfig': {'BOOL': 'True'},
                'labelingJob': {'BOOL': 'True'},
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
                'isEnabled': {'BOOL': 'False'},
                'text': {'S': ''},
                'textColor': {'S': ''},
                'backgroundColor': {'S': ''}
            }},
            'EMRConfig': {'M': {
                'autoScaling': {'M': {
                    'minInstances': {'N': String(clusterConfig['auto-scaling']['min-instances'])},
                    'maxInstances': {'N': String(clusterConfig['auto-scaling']['max-instances'])},
                    'scaleOut': {'M': {
                        'cooldown': {'N': String(clusterConfig['auto-scaling']['scale-out']['cooldown'])},
                        'increment': {'N': String(clusterConfig['auto-scaling']['scale-out']['increment'])},
                        'evalPeriods': {'N': String(clusterConfig['auto-scaling']['scale-out']['eval-periods'])},
                        'percentageMemAvailable': {'N': String(clusterConfig['auto-scaling']['scale-out']['percentage-mem-available'])}}},
                    'scaleIn': {'M': {
                        'cooldown': {'N': String(clusterConfig['auto-scaling']['scale-in']['cooldown'])},
                        'increment': {'N': String(clusterConfig['auto-scaling']['scale-in']['increment'])},
                        'evalPeriods': {'N': String(clusterConfig['auto-scaling']['scale-in']['eval-periods'])},
                        'percentageMemAvailable': {'N': String(clusterConfig['auto-scaling']['scale-in']['percentage-mem-available'])}}},
                }},
                'clusterTypes': {'L': clusterTypes},
                'applications': {'L': applicationList}
            }
            },
            'EnabledInstanceTypes': {'M': {
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
        }}
    };
}

