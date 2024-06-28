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
import _ = require('lodash');
import {
    ACCESS_LOGS_BUCKET_NAME,
    ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
    APIGATEWAY_CLOUDWATCH_ROLE_ARN,
    APPLICATION_NAME,
    APP_ROLE_ARN,
    AWS_ACCOUNT,
    AWS_REGION,
    BACKGROUND_REFRESH_INTERVAL,
    BUCKET_DEPLOYMENT_ROLE_ARN,
    COMMON_LAYER_ARN_PARAM,
    CONFIG_BUCKET_NAME,
    CREATE_MLSPACE_CLOUDTRAIL_TRAIL,
    DATASETS_TABLE_NAME,
    DATA_BUCKET_NAME,
    EMR_DEFAULT_ROLE_ARN,
    EMR_EC2_INSTANCE_ROLE_ARN,
    EMR_SECURITY_CONFIG_NAME,
    EMR_EC2_SSH_KEY,
    ENABLE_ACCESS_LOGGING,
    ENABLE_GROUNDTRUTH,
    ENABLE_TRANSLATE,
    EXISTING_KMS_MASTER_KEY_ARN,
    EXISTING_VPC_DEFAULT_SECURITY_GROUP,
    EXISTING_VPC_ID,
    EXISTING_VPC_NAME,
    IAM_RESOURCE_PREFIX,
    IDP_ENDPOINT_SSM_PARAM,
    INTERNAL_OIDC_URL,
    KEY_MANAGER_ROLE_NAME,
    KMS_INSTANCE_CONDITIONS_POLICY_ARN,
    LAMBDA_ARCHITECTURE,
    LAMBDA_RUNTIME,
    LOGS_BUCKET_NAME,
    MANAGE_IAM_ROLES,
    MLSPACE_LIFECYCLE_CONFIG_NAME,
    NEW_USERS_SUSPENDED,
    ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN,
    JOB_INSTANCE_CONSTRAINT_POLICY_ARN,
    NOTEBOOK_PARAMETERS_FILE_NAME,
    NOTEBOOK_ROLE_ARN,
    NOTIFICATION_DISTRO,
    OIDC_CLIENT_NAME,
    OIDC_REDIRECT_URI,
    OIDC_URL,
    OIDC_VERIFY_SIGNATURE,
    OIDC_VERIFY_SSL,
    PERMISSIONS_BOUNDARY_POLICY_NAME,
    PROJECTS_TABLE_NAME,
    PROJECT_USERS_TABLE_NAME,
    RESOURCE_METADATA_TABLE_NAME,
    RESOURCE_SCHEDULE_TABLE_NAME,
    APP_CONFIGURATION_TABLE_NAME,
    RESOURCE_TERMINATION_INTERVAL,
    S3_READER_ROLE_ARN,
    SYSTEM_TAG,
    USERS_TABLE_NAME,
    WEBSITE_BUCKET_NAME,
    SYSTEM_BANNER_BACKGROUND_COLOR,
    SYSTEM_BANNER_TEXT,
    SYSTEM_BANNER_TEXT_COLOR,
    SYSTEM_ROLE_ARN,
} from '../constants';
import * as fs from 'fs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';

export type MLSpaceConfig = {
    //Table names
    DATASETS_TABLE_NAME: string,
    PROJECTS_TABLE_NAME: string,
    PROJECT_USERS_TABLE_NAME: string,
    USERS_TABLE_NAME: string,
    RESOURCE_SCHEDULE_TABLE_NAME: string,
    RESOURCE_METADATA_TABLE_NAME: string,
    APP_CONFIGURATION_TABLE_NAME: string,
    //Bucket names
    CONFIG_BUCKET_NAME: string,
    DATA_BUCKET_NAME: string,
    LOGS_BUCKET_NAME: string,
    ACCESS_LOGS_BUCKET_NAME: string,
    WEBSITE_BUCKET_NAME:string,
    //Notebook settings
    MLSPACE_LIFECYCLE_CONFIG_NAME: string,
    NOTEBOOK_PARAMETERS_FILE_NAME: string,
    // EMR settings
    EMR_SECURITY_CONFIG_NAME: string,
    EMR_EC2_SSH_KEY: string,
    // OIDC settings
    IDP_ENDPOINT_SSM_PARAM: string,
    INTERNAL_OIDC_URL: string,
    OIDC_VERIFY_SSL: boolean,
    OIDC_VERIFY_SIGNATURE: boolean,
    OIDC_REDIRECT_URI: string,
    // Other properties not handled in config.json
    SYSTEM_TAG: string,
    IAM_RESOURCE_PREFIX: string,
    APPLICATION_NAME: string,
    PERMISSIONS_BOUNDARY_POLICY_NAME: string,
    KEY_MANAGER_ROLE_NAME: string,
    NOTIFICATION_DISTRO: string,
    EXISTING_KMS_MASTER_KEY_ARN: string,
    APIGATEWAY_CLOUDWATCH_ROLE_ARN: string,
    COMMON_LAYER_ARN_PARAM: string,
    ADDITIONAL_LAMBDA_ENVIRONMENT_VARS: { [key: string]: string }
    MANAGE_IAM_ROLES: boolean,
    ENABLE_ACCESS_LOGGING: boolean,
    CREATE_MLSPACE_CLOUDTRAIL_TRAIL: boolean,
    ENABLE_TRANSLATE: boolean,
    ENABLE_GROUNDTRUTH: boolean,
    RESOURCE_TERMINATION_INTERVAL: number,
    NEW_USERS_SUSPENDED: boolean,
    LAMBDA_ARCHITECTURE: Architecture,
    LAMBDA_RUNTIME: Runtime,
    SYSTEM_ROLE_ARN: string,
    //Properties that can optionally be set in config.json
    AWS_ACCOUNT: string,
    AWS_REGION: string,
    OIDC_URL:  string,
    OIDC_CLIENT_NAME: string,
    EXISTING_VPC_NAME: string,
    EXISTING_VPC_ID: string,
    EXISTING_VPC_DEFAULT_SECURITY_GROUP: string,
    S3_READER_ROLE_ARN: string,
    BUCKET_DEPLOYMENT_ROLE_ARN: string,
    ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN: string,
    JOB_INSTANCE_CONSTRAINT_POLICY_ARN: string,
    KMS_INSTANCE_CONDITIONS_POLICY_ARN: string,

    NOTEBOOK_ROLE_ARN: string,
    APP_ROLE_ARN: string,
    EMR_DEFAULT_ROLE_ARN: string,
    EMR_EC2_INSTANCE_ROLE_ARN: string,
    SYSTEM_BANNER_BACKGROUND_COLOR: string,
    SYSTEM_BANNER_TEXT: string,
    SYSTEM_BANNER_TEXT_COLOR: string,
    BACKGROUND_REFRESH_INTERVAL: number,
};

const validateRequiredProperty = (val: string, name: string) => {
    if (!val) {
        throw new Error(`${name} is a required property. \nPlease run 'npm run config'` +
        'and select the Basic Configuration option, which will walk you through setting up all required fields');
    }
};

/**
 * Generates an MLSpaceConfig object containing settings from config.json (if it exists), 
 * or defaulting to settings in constants.ts if that property hasn't been set
 * in config.json
 */
export function generateConfig () {
    const config: MLSpaceConfig = {
        // Table names
        DATASETS_TABLE_NAME: DATASETS_TABLE_NAME,
        PROJECTS_TABLE_NAME: PROJECTS_TABLE_NAME,
        PROJECT_USERS_TABLE_NAME: PROJECT_USERS_TABLE_NAME,
        USERS_TABLE_NAME: USERS_TABLE_NAME,
        RESOURCE_SCHEDULE_TABLE_NAME: RESOURCE_SCHEDULE_TABLE_NAME,
        RESOURCE_METADATA_TABLE_NAME: RESOURCE_METADATA_TABLE_NAME,
        APP_CONFIGURATION_TABLE_NAME: APP_CONFIGURATION_TABLE_NAME,
        // Bucket names
        CONFIG_BUCKET_NAME: CONFIG_BUCKET_NAME,
        DATA_BUCKET_NAME: DATA_BUCKET_NAME,
        LOGS_BUCKET_NAME: LOGS_BUCKET_NAME,
        ACCESS_LOGS_BUCKET_NAME: ACCESS_LOGS_BUCKET_NAME,
        WEBSITE_BUCKET_NAME: WEBSITE_BUCKET_NAME,
        // Notebook settings
        MLSPACE_LIFECYCLE_CONFIG_NAME: MLSPACE_LIFECYCLE_CONFIG_NAME,
        NOTEBOOK_PARAMETERS_FILE_NAME: NOTEBOOK_PARAMETERS_FILE_NAME,
        ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN: ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN,
        JOB_INSTANCE_CONSTRAINT_POLICY_ARN: JOB_INSTANCE_CONSTRAINT_POLICY_ARN,
        // EMR settings
        EMR_SECURITY_CONFIG_NAME: EMR_SECURITY_CONFIG_NAME,
        EMR_EC2_SSH_KEY: EMR_EC2_SSH_KEY,
        // OIDC settings
        IDP_ENDPOINT_SSM_PARAM: IDP_ENDPOINT_SSM_PARAM,
        INTERNAL_OIDC_URL: INTERNAL_OIDC_URL,
        OIDC_VERIFY_SSL: OIDC_VERIFY_SSL,
        OIDC_VERIFY_SIGNATURE: OIDC_VERIFY_SIGNATURE,
        OIDC_REDIRECT_URI: OIDC_REDIRECT_URI,
        // Other properties not prompted for in config-helper
        SYSTEM_TAG: SYSTEM_TAG,
        IAM_RESOURCE_PREFIX: IAM_RESOURCE_PREFIX,
        APPLICATION_NAME: APPLICATION_NAME,
        PERMISSIONS_BOUNDARY_POLICY_NAME: PERMISSIONS_BOUNDARY_POLICY_NAME,
        NOTIFICATION_DISTRO: NOTIFICATION_DISTRO,
        EXISTING_KMS_MASTER_KEY_ARN: EXISTING_KMS_MASTER_KEY_ARN,
        APIGATEWAY_CLOUDWATCH_ROLE_ARN: APIGATEWAY_CLOUDWATCH_ROLE_ARN,
        COMMON_LAYER_ARN_PARAM: COMMON_LAYER_ARN_PARAM,
        ADDITIONAL_LAMBDA_ENVIRONMENT_VARS: ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
        MANAGE_IAM_ROLES: MANAGE_IAM_ROLES,
        ENABLE_ACCESS_LOGGING: ENABLE_ACCESS_LOGGING,
        CREATE_MLSPACE_CLOUDTRAIL_TRAIL: CREATE_MLSPACE_CLOUDTRAIL_TRAIL,
        ENABLE_TRANSLATE: ENABLE_TRANSLATE,
        ENABLE_GROUNDTRUTH: ENABLE_GROUNDTRUTH,
        RESOURCE_TERMINATION_INTERVAL: RESOURCE_TERMINATION_INTERVAL,
        LAMBDA_ARCHITECTURE: LAMBDA_ARCHITECTURE,
        LAMBDA_RUNTIME: LAMBDA_RUNTIME,
        SYSTEM_ROLE_ARN: SYSTEM_ROLE_ARN,
        KMS_INSTANCE_CONDITIONS_POLICY_ARN: KMS_INSTANCE_CONDITIONS_POLICY_ARN,
        //Properties that are prompted for in the config-helper wizard
        AWS_ACCOUNT: AWS_ACCOUNT,
        AWS_REGION: AWS_REGION,
        OIDC_URL: OIDC_URL,
        OIDC_CLIENT_NAME: OIDC_CLIENT_NAME,
        KEY_MANAGER_ROLE_NAME: KEY_MANAGER_ROLE_NAME,
        EXISTING_VPC_NAME: EXISTING_VPC_NAME,
        EXISTING_VPC_ID: EXISTING_VPC_ID,
        EXISTING_VPC_DEFAULT_SECURITY_GROUP: EXISTING_VPC_DEFAULT_SECURITY_GROUP,
        S3_READER_ROLE_ARN: S3_READER_ROLE_ARN,
        BUCKET_DEPLOYMENT_ROLE_ARN: BUCKET_DEPLOYMENT_ROLE_ARN,
        NOTEBOOK_ROLE_ARN: NOTEBOOK_ROLE_ARN,
        APP_ROLE_ARN: APP_ROLE_ARN,
        EMR_DEFAULT_ROLE_ARN: EMR_DEFAULT_ROLE_ARN,
        EMR_EC2_INSTANCE_ROLE_ARN: EMR_EC2_INSTANCE_ROLE_ARN,
        SYSTEM_BANNER_BACKGROUND_COLOR: SYSTEM_BANNER_BACKGROUND_COLOR,
        SYSTEM_BANNER_TEXT: SYSTEM_BANNER_TEXT,
        SYSTEM_BANNER_TEXT_COLOR: SYSTEM_BANNER_TEXT_COLOR,
        NEW_USERS_SUSPENDED: NEW_USERS_SUSPENDED,
        BACKGROUND_REFRESH_INTERVAL: BACKGROUND_REFRESH_INTERVAL
    };


    //Check for properties set in config.json and default to that value if it exists
    if (fs.existsSync('lib/config.json')) {
        const fileConfig: MLSpaceConfig = JSON.parse(
            fs.readFileSync('lib/config.json').toString('utf8')
        );
        _.merge(config, fileConfig);
    }
    //Check if the cluster-config file exists, and if it does use the ec2-key value
    if (fs.existsSync('lib/resources/config/cluster-config.json')) {
        const clusterConfig = JSON.parse(
            fs.readFileSync('lib/resources/config/cluster-config.json').toString('utf8')
        );
        //Skip if ec2-key isn't defined or it's set to EC2_KEY which is the (invalid) default value
        if (clusterConfig['ec2-key'] && clusterConfig['ec2-key'] !== 'EC2_KEY') {
            config.EMR_EC2_SSH_KEY = clusterConfig['ec2-key'];
        }
    }

    validateRequiredProperty(config.AWS_ACCOUNT, 'AWS_ACCOUNT');
    validateRequiredProperty(config.OIDC_URL, 'OIDC_URL');
    validateRequiredProperty(config.OIDC_CLIENT_NAME, 'OIDC_CLIENT_NAME');
    validateRequiredProperty(config.AWS_REGION, 'AWS_REGION');

    if (!config.EXISTING_KMS_MASTER_KEY_ARN) {
        validateRequiredProperty(config.KEY_MANAGER_ROLE_NAME, 'KEY_MANAGER_ROLE_NAME');
    }

    return config;
}
