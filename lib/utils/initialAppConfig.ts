import { MLSpaceConfig } from "./configTypes";


export function generateAppConfig (mlspaceConfig: MLSpaceConfig) {
    const date = new Date();
    return {
        'versionId': {'N': '0'}, 
        'changedBy': {'S': 'InitialConfig'}, 
        'configScope': {'S': 'global'}, 
        'changeReason': {'S': 'Initial deployment default config'},
        'changedAt': {'S': Math.round(date.getTime() / 1000).toString()},
        'configuration': {'M': {
            'EnabledServices': {'M': {
                'cluster': {'BOOL': 'True'}, 
                'endpoint': {'BOOL': 'True'}, 
                'labeling-job': {'BOOL': mlspaceConfig.ENABLE_GROUNDTRUTH ? 'True' : 'False'}, 
                'transform-job': {'BOOL': 'True'}, 
                'notebook-instance': {'BOOL': 'True'}, 
                'real-time-translate': {'BOOL': mlspaceConfig.ENABLE_TRANSLATE ? 'True' : 'False'}, 
                'training-job': {'BOOL': 'True'}, 
                'batch-translate-job': {'BOOL': mlspaceConfig.ENABLE_TRANSLATE ? 'True' : 'False'}, 
                'model': {'BOOL': 'True'}, 
                'hpo-job': {'BOOL': 'True'}, 
                'endpoint-config': {'BOOL': 'True'}
            }}, 
            'ProjectCreation': {'M': {
                'AdminOnly': {'BOOL': 'False'}, 
                'AllowedGroups': {'L': 
                [

                ]}
            }}, 
            'SystemBanner': {'M': {
                'Enabled': {'BOOL': 'False'}, 
                'Text': {'S': 'CHANGEME'}, 
                'TextColor': {'S': 'Red'}, 
                'BackgroundColor': {'S': 'White'}}}, 
            'EMRConfig': {'M': {
                'auto-scaling': {'M': {
                    'min-instances': {'N': '2'}, 
                    'scale-out': {'M': {
                        'cooldown': {'N': '300'}, 
                        'increment': {'N': '1'}, 
                        'eval-periods': {'N': '1'},
                        'percentage-mem-available': {'N': '15'}}}, 
                    'scale-in': {'M': {
                        'cooldown': {'N': '300'}, 
                        'increment': {'N': '-1'}, 
                        'eval-periods': {'N': '1'}, 
                        'percentage-mem-available': {'N': '75'}}}, 
                        'max-instances': {'N': '15'}}}, 
                    'cluster-sizes': {'L': [
                        {'M': {
                            'name': {'S': 'Small'},
                            'size': {'N': '3'},
                            'master-type': {'S': 'm5.xlarge'},
                            'core-type': {'S': 'm5.xlarge'},
                        }},
                        {'M': {
                            'name': {'S': 'Medium'},
                            'size': {'N': '5'},
                            'master-type': {'S': 'm5.xlarge'},
                            'core-type': {'S': 'm5.xlarge'},
                        }},
                        {'M': {
                            'name': {'S': 'Large'},
                            'size': {'N': '7'},
                            'master-type': {'S': 'm5.xlarge'},
                            'core-type': {'S': 'p3.8xlarge'},
                        }}
                    ]},
                    'applications': {'L': [
                        {'M': {'Name': {'S': 'Hadoop'}}}, 
                        {'M': {'Name': {'S': 'Spark'}}}, 
                        {'M': {'Name': {'S': 'Ganglia'}}}, 
                        {'M': {'Name': {'S': 'Hive'}}}, 
                        {'M': {'Name': {'S': 'Tez'}}}, 
                        {'M': {'Name': {'S': 'Presto'}}}, 
                        {'M': {'Name': {'S': 'Livy'}}}
                    ]}
                }
            }, 
            'DisabledInstanceTypes': {'M': {
                'training-job': {'L': 
                [

                ]}, 
                'endpoint': {'L': 
                [

                ]}, 
                'transform-job': {'L': 
                [

                ]}, 
                'notebook-instance': {'L': 
                [

                ]}
            }
        }
    }}, 
    }
}

