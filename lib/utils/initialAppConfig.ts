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
                'isEnabled': {'BOOL': 'False'}, 
                'text': {'S': 'CHANGEME'}, 
                'textColor': {'S': 'Red'}, 
                'backgroundColor': {'S': 'White'}
            }}, 
            'EMRConfig': {'M': {
                'autoScaling': {'M': {
                    'minInstances': {'N': '2'}, 
                    'maxInstances': {'N': '15'},
                    'scaleOut': {'M': {
                        'cooldown': {'N': '300'}, 
                        'increment': {'N': '1'}, 
                        'evalPeriods': {'N': '1'},
                        'percentageMemAvailable': {'N': '15'}}}, 
                    'scaleIn': {'M': {
                        'cooldown': {'N': '300'}, 
                        'increment': {'N': '-1'}, 
                        'evalPeriods': {'N': '1'}, 
                        'percentageMemAvailable': {'N': '75'}}}, 
                }}, 
                    'cluster-sizes': {'L': [
                        {'M': {
                            'name': {'S': 'Small'},
                            'size': {'N': '3'},
                            'masterType': {'S': 'm5.xlarge'},
                            'coreType': {'S': 'm5.xlarge'},
                        }},
                        {'M': {
                            'name': {'S': 'Medium'},
                            'size': {'N': '5'},
                            'masterType': {'S': 'm5.xlarge'},
                            'coreType': {'S': 'm5.xlarge'},
                        }},
                        {'M': {
                            'name': {'S': 'Large'},
                            'size': {'N': '7'},
                            'masterType': {'S': 'm5.xlarge'},
                            'coreType': {'S': 'p3.8xlarge'},
                        }}
                    ]},
                    'applications': {'L': [
                        {'M': {'name': {'S': 'Hadoop'}}}, 
                        {'M': {'name': {'S': 'Spark'}}}, 
                        {'M': {'name': {'S': 'Ganglia'}}}, 
                        {'M': {'name': {'S': 'Hive'}}}, 
                        {'M': {'name': {'S': 'Tez'}}}, 
                        {'M': {'name': {'S': 'Presto'}}}, 
                        {'M': {'name': {'S': 'Livy'}}}
                    ]}
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
    }
}

