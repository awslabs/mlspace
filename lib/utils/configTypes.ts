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
    AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME,
    AUTH_IDP_TYPE,
    AUTH_OIDC_CLIENT_ID,
    AUTH_OIDC_CLIENT_SECRET_NAME,
    AUTH_OIDC_CLIENT_SECRET_VALUE,
    AUTH_OIDC_URL,
    AUTH_OIDC_USE_PKCE,
    AUTH_OIDC_VERIFY_SIGNATURE,
    AUTH_OIDC_VERIFY_SSL,
    AUTH_SESSION_TABLE_NAME,
    AUTH_SESSION_TTL_HOURS,
    AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME,
    AUTH_SYNC_DOMAINS,
    AUTH_KEY_VERSIONS_TO_KEEP,
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
    ENABLE_DDB_KMS_CMK_ENCRYPTION,
    EXISTING_KMS_MASTER_KEY_ARN,
    EXISTING_VPC_DEFAULT_SECURITY_GROUP,
    EXISTING_VPC_ID,
    EXISTING_VPC_NAME,
    VPC_IPV4_IPAM_POOL_ID,
    VPC_IPAM_IPV4_NETMASK_LENGTH,
    VPC_SUBNET_IPV4_CIDR_MASK,
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
    PROJECT_GROUPS_TABLE_NAME,
    RESOURCE_METADATA_TABLE_NAME,
    RESOURCE_SCHEDULE_TABLE_NAME,
    APP_CONFIGURATION_TABLE_NAME,
    GROUPS_TABLE_NAME,
    GROUPS_MEMBERSHIP_HISTORY_TABLE_NAME,
    GROUP_DATASETS_TABLE_NAME,
    GROUP_USERS_TABLE_NAME,
    RESOURCE_TERMINATION_INTERVAL,
    S3_READER_ROLE_ARN,
    SYSTEM_TAG,
    USERS_TABLE_NAME,
    WEBSITE_BUCKET_NAME,
    SYSTEM_ROLE_ARN,
    SHOW_MIGRATION_OPTIONS,
    WEB_CUSTOM_DOMAIN_NAME,
    ALLOW_LOCALHOST
} from '../constants';
import * as fs from 'fs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';

export type MLSpaceConfig = {
    //Table names
    DATASETS_TABLE_NAME: string,
    PROJECTS_TABLE_NAME: string,
    PROJECT_USERS_TABLE_NAME: string,
    PROJECT_GROUPS_TABLE_NAME: string,
    USERS_TABLE_NAME: string,
    RESOURCE_SCHEDULE_TABLE_NAME: string,
    RESOURCE_METADATA_TABLE_NAME: string,
    APP_CONFIGURATION_TABLE_NAME: string,
    GROUPS_TABLE_NAME: string,
    GROUPS_MEMBERSHIP_HISTORY_TABLE_NAME: string,
    GROUP_DATASETS_TABLE_NAME: string,
    GROUP_USERS_TABLE_NAME: string,
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
    // OIDC settings (legacy - deprecated, use AUTH_OIDC_URL instead)
    IDP_ENDPOINT_SSM_PARAM: string | undefined,
    INTERNAL_OIDC_URL: string | undefined,
    OIDC_VERIFY_SSL: boolean | undefined,
    OIDC_VERIFY_SIGNATURE: boolean | undefined,
    OIDC_REDIRECT_URI: string | undefined,
    // BFF Authentication settings
    AUTH_SESSION_TABLE_NAME: string,
    AUTH_IDP_TYPE: string,
    AUTH_OIDC_URL: string,
    AUTH_OIDC_CLIENT_ID: string,
    AUTH_OIDC_CLIENT_SECRET_NAME: string,
    AUTH_OIDC_CLIENT_SECRET_VALUE?: string, // Optional for deployment-time configuration
    AUTH_OIDC_USE_PKCE: boolean,
    AUTH_OIDC_VERIFY_SSL: boolean,
    AUTH_OIDC_VERIFY_SIGNATURE: boolean,
    AUTH_SYNC_DOMAINS: string,
    AUTH_SESSION_TTL_HOURS: number,
    AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME: string,
    AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME: string,
    AUTH_KEY_VERSIONS_TO_KEEP: number,
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
    ENABLE_DDB_KMS_CMK_ENCRYPTION: boolean,
    CREATE_MLSPACE_CLOUDTRAIL_TRAIL: boolean,
    RESOURCE_TERMINATION_INTERVAL: number,
    NEW_USERS_SUSPENDED: boolean,
    LAMBDA_ARCHITECTURE: Architecture,
    LAMBDA_RUNTIME: Runtime,
    SYSTEM_ROLE_ARN: string,
    COMMON_LAYER_PATH?: string,
    JWT_LAYER_PATH?: string
    //Properties that can optionally be set in config.json
    AWS_ACCOUNT: string,
    AWS_REGION: string,
    OIDC_URL:  string | undefined,
    OIDC_CLIENT_NAME: string | undefined
    ,
    EXISTING_VPC_NAME: string,
    EXISTING_VPC_ID: string,
    EXISTING_VPC_DEFAULT_SECURITY_GROUP: string,
    /** Optional IPAM pool for new VPC (IP version 4); empty = CDK default CIDR. */
    VPC_IPV4_IPAM_POOL_ID: string,
    /** VPC / mask length from IPAM when using VPC_IPV4_IPAM_POOL_ID. */
    VPC_IPAM_IPV4_NETMASK_LENGTH: number | undefined,
    /** Per-tier subnet mask for new VPC (public + private). */
    VPC_SUBNET_IPV4_CIDR_MASK: number,
    S3_READER_ROLE_ARN: string,
    BUCKET_DEPLOYMENT_ROLE_ARN: string,
    ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN: string,
    JOB_INSTANCE_CONSTRAINT_POLICY_ARN: string,
    KMS_INSTANCE_CONDITIONS_POLICY_ARN: string,

    NOTEBOOK_ROLE_ARN: string,
    APP_ROLE_ARN: string,
    EMR_DEFAULT_ROLE_ARN: string,
    EMR_EC2_INSTANCE_ROLE_ARN: string,
    BACKGROUND_REFRESH_INTERVAL: number,

    SHOW_MIGRATION_OPTIONS?: boolean,
    WEB_CUSTOM_DOMAIN_NAME?: string,
    ALLOW_LOCALHOST?: boolean
};

const validateRequiredProperty = (val: string, name: string) => {
    if (!val) {
        throw new Error(`${name} is a required property. \nPlease run 'npm run config'` +
        'and select the Basic Configuration option, which will walk you through setting up all required fields');
    }
};

type AuthOidcBooleanKey = 'AUTH_OIDC_VERIFY_SSL' | 'AUTH_OIDC_VERIFY_SIGNATURE' | 'AUTH_OIDC_USE_PKCE';

const AUTH_OIDC_BOOLEAN_FIELDS: { key: AuthOidcBooleanKey; fallback: boolean }[] = [
    { key: 'AUTH_OIDC_VERIFY_SSL', fallback: AUTH_OIDC_VERIFY_SSL },
    { key: 'AUTH_OIDC_VERIFY_SIGNATURE', fallback: AUTH_OIDC_VERIFY_SIGNATURE },
    { key: 'AUTH_OIDC_USE_PKCE', fallback: AUTH_OIDC_USE_PKCE },
];

/**
 * Parse a loose boolean (JSON merge may leave strings; deploy env is always a string).
 * Returns undefined if the value cannot be interpreted as boolean.
 */
function parseLooseBoolean (value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number' && !Number.isNaN(value)) {
        if (value === 0) {
            return false;
        }
        if (value === 1) {
            return true;
        }
        return undefined;
    }
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['true', '1', 'yes'].includes(v)) {
            return true;
        }
        if (['false', '0', 'no'].includes(v)) {
            return false;
        }
        return undefined;
    }
    return undefined;
}

/** Coerce OIDC boolean flags after config merge; then apply optional CDK deploy-time process.env overrides. */
function resolveAuthOidcBooleanFields (config: MLSpaceConfig) {
    for (const { key, fallback } of AUTH_OIDC_BOOLEAN_FIELDS) {
        const parsed = parseLooseBoolean(config[key]);
        config[key] = parsed !== undefined ? parsed : fallback;
    }
    for (const { key } of AUTH_OIDC_BOOLEAN_FIELDS) {
        const raw = process.env[key];
        if (raw === undefined || raw === '') {
            continue;
        }
        const parsed = parseLooseBoolean(raw);
        if (parsed === undefined) {
            throw new Error(
                `Invalid ${key} environment variable: "${raw}". Use true/false, 1/0, or yes/no.`
            );
        }
        config[key] = parsed;
    }
}

/**
 * Generates an MLSpaceConfig object containing settings from config.json (if it exists), 
 * or defaulting to settings in constants.ts if that property hasn't been set
 * in config.json
 */
export function generateConfig (accountId?: string) {
    const config: MLSpaceConfig = {
        // Table names
        DATASETS_TABLE_NAME: DATASETS_TABLE_NAME,
        PROJECTS_TABLE_NAME: PROJECTS_TABLE_NAME,
        PROJECT_USERS_TABLE_NAME: PROJECT_USERS_TABLE_NAME,
        PROJECT_GROUPS_TABLE_NAME: PROJECT_GROUPS_TABLE_NAME,
        USERS_TABLE_NAME: USERS_TABLE_NAME,
        RESOURCE_SCHEDULE_TABLE_NAME: RESOURCE_SCHEDULE_TABLE_NAME,
        RESOURCE_METADATA_TABLE_NAME: RESOURCE_METADATA_TABLE_NAME,
        APP_CONFIGURATION_TABLE_NAME: APP_CONFIGURATION_TABLE_NAME,
        GROUPS_TABLE_NAME: GROUPS_TABLE_NAME,
        GROUPS_MEMBERSHIP_HISTORY_TABLE_NAME: GROUPS_MEMBERSHIP_HISTORY_TABLE_NAME,
        GROUP_DATASETS_TABLE_NAME: GROUP_DATASETS_TABLE_NAME,
        GROUP_USERS_TABLE_NAME: GROUP_USERS_TABLE_NAME,
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
        // OIDC settings (legacy)
        IDP_ENDPOINT_SSM_PARAM: IDP_ENDPOINT_SSM_PARAM,
        INTERNAL_OIDC_URL: INTERNAL_OIDC_URL,
        OIDC_VERIFY_SSL: OIDC_VERIFY_SSL,
        OIDC_VERIFY_SIGNATURE: OIDC_VERIFY_SIGNATURE,
        OIDC_REDIRECT_URI: OIDC_REDIRECT_URI,
        // BFF Authentication settings
        AUTH_SESSION_TABLE_NAME: AUTH_SESSION_TABLE_NAME,
        AUTH_IDP_TYPE: AUTH_IDP_TYPE,
        AUTH_OIDC_URL: AUTH_OIDC_URL,
        AUTH_OIDC_CLIENT_ID: AUTH_OIDC_CLIENT_ID,
        AUTH_OIDC_CLIENT_SECRET_NAME: AUTH_OIDC_CLIENT_SECRET_NAME,
        AUTH_OIDC_CLIENT_SECRET_VALUE: AUTH_OIDC_CLIENT_SECRET_VALUE,
        AUTH_OIDC_USE_PKCE: AUTH_OIDC_USE_PKCE,
        AUTH_OIDC_VERIFY_SSL: AUTH_OIDC_VERIFY_SSL,
        AUTH_OIDC_VERIFY_SIGNATURE: AUTH_OIDC_VERIFY_SIGNATURE,
        AUTH_SYNC_DOMAINS: AUTH_SYNC_DOMAINS,
        AUTH_SESSION_TTL_HOURS: AUTH_SESSION_TTL_HOURS,
        AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME: AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME,
        AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME: AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME,
        AUTH_KEY_VERSIONS_TO_KEEP: AUTH_KEY_VERSIONS_TO_KEEP,
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
        ENABLE_DDB_KMS_CMK_ENCRYPTION: ENABLE_DDB_KMS_CMK_ENCRYPTION,
        CREATE_MLSPACE_CLOUDTRAIL_TRAIL: CREATE_MLSPACE_CLOUDTRAIL_TRAIL,
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
        VPC_IPV4_IPAM_POOL_ID: VPC_IPV4_IPAM_POOL_ID,
        VPC_IPAM_IPV4_NETMASK_LENGTH: VPC_IPAM_IPV4_NETMASK_LENGTH,
        VPC_SUBNET_IPV4_CIDR_MASK: VPC_SUBNET_IPV4_CIDR_MASK,
        S3_READER_ROLE_ARN: S3_READER_ROLE_ARN,
        BUCKET_DEPLOYMENT_ROLE_ARN: BUCKET_DEPLOYMENT_ROLE_ARN,
        NOTEBOOK_ROLE_ARN: NOTEBOOK_ROLE_ARN,
        APP_ROLE_ARN: APP_ROLE_ARN,
        EMR_DEFAULT_ROLE_ARN: EMR_DEFAULT_ROLE_ARN,
        EMR_EC2_INSTANCE_ROLE_ARN: EMR_EC2_INSTANCE_ROLE_ARN,
        NEW_USERS_SUSPENDED: NEW_USERS_SUSPENDED,
        BACKGROUND_REFRESH_INTERVAL: BACKGROUND_REFRESH_INTERVAL,

        SHOW_MIGRATION_OPTIONS: SHOW_MIGRATION_OPTIONS,
        WEB_CUSTOM_DOMAIN_NAME: WEB_CUSTOM_DOMAIN_NAME,
        ALLOW_LOCALHOST: ALLOW_LOCALHOST
    };

    //Try to load account-specific config or config generated by config-helper
    const configPaths = [`lib/config.${accountId}.json`, 'lib/config.json'];
    configPaths.forEach((configPath) => {
        if (fs.existsSync(configPath)) {
            const fileConfig = JSON.parse(fs.readFileSync(configPath).toString('utf8'));
            _.merge(config, fileConfig);
            return;
        }
    });
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

    // String values in config.json (e.g. "false") are truthy in JS and would break Lambda env emission;
    // CI/CD may set AUTH_OIDC_* on the deploy process — merge those into config here.
    resolveAuthOidcBooleanFields(config);

    validateRequiredProperty(config.AWS_ACCOUNT, 'AWS_ACCOUNT');
    validateRequiredProperty(config.AWS_REGION, 'AWS_REGION');

    // Check for deprecated OIDC_* environment variables
    const deprecatedOidcVars = [
        'OIDC_URL',
        'OIDC_CLIENT_NAME',
        'OIDC_VERIFY_SSL',
        'OIDC_VERIFY_SIGNATURE',
        'OIDC_REDIRECT_URI',
        'INTERNAL_OIDC_URL',
        'IDP_ENDPOINT_SSM_PARAM'
    ];
    
    const foundDeprecatedVars = deprecatedOidcVars.filter ((varName) => {
        const envValue = process.env[varName];
        const configValue = config[varName as keyof MLSpaceConfig];
        const value = (envValue || configValue);
        return value !== undefined && value !== '';
    });

    if (foundDeprecatedVars.length > 0) {
        throw new Error(
            `\n${'='.repeat(80)}\n` +
            'ERROR: Deprecated OIDC_* configuration variables detected!\n' +
            `${'='.repeat(80)}\n\n` +
            'The following deprecated configuration variables are still set:\n' +
            `  ${foundDeprecatedVars.map ((v) => `- ${v}`).join('\n  ')}\n\n` +
            'These have been replaced with AUTH_* settings for the new enhanced authentication.\n\n' +
            'Please update your configuration:\n' +
            '  1. Remove the deprecated OIDC_* environment variables\n' +
            '  2. Set the new AUTH_* environment variables instead:\n' +
            '     - AUTH_OIDC_URL (replaces OIDC_URL)\n' +
            '     - AUTH_OIDC_CLIENT_ID (replaces OIDC_CLIENT_NAME)\n' +
            '     - AUTH_OIDC_CLIENT_SECRET_NAME\n' +
            '     - AUTH_OIDC_VERIFY_SSL (replaces OIDC_VERIFY_SSL)\n' +
            '     - AUTH_OIDC_VERIFY_SIGNATURE (replaces OIDC_VERIFY_SIGNATURE)\n\n' +
            'For migration guidance, see:\n' +
            '  - docs/BFF_AUTHENTICATION_KEY_ROTATION.md\n' +
            '  - frontend/docs/admin-guide/bff-authentication-migration.md\n' +
            `${'='.repeat(80)}\n`
        );
    }

    // Validate BFF authentication configuration
    validateRequiredProperty(config.AUTH_OIDC_URL, 'AUTH_OIDC_URL');
    validateRequiredProperty(config.AUTH_OIDC_CLIENT_ID, 'AUTH_OIDC_CLIENT_ID');
    validateRequiredProperty(config.AUTH_OIDC_CLIENT_SECRET_NAME, 'AUTH_OIDC_CLIENT_SECRET_NAME');

    if (!config.EXISTING_KMS_MASTER_KEY_ARN) {
        validateRequiredProperty(config.KEY_MANAGER_ROLE_NAME, 'KEY_MANAGER_ROLE_NAME');
    }

    validateVpcNetworkingConfig(config);

    return config;
}

function parseConfigInt (value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const n = parseInt(value.trim(), 10);
        return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
}

/**
 * Optional VPC/IPAM settings: defaults preserve legacy behavior; invalid combinations fail fast with clear errors.
 */
function validateVpcNetworkingConfig (config: MLSpaceConfig) {
    const existingVpc =
        Boolean(config.EXISTING_VPC_ID?.trim()) &&
        Boolean(config.EXISTING_VPC_NAME?.trim()) &&
        Boolean(config.EXISTING_VPC_DEFAULT_SECURITY_GROUP?.trim());

    const poolId =
        typeof config.VPC_IPV4_IPAM_POOL_ID === 'string'
            ? config.VPC_IPV4_IPAM_POOL_ID.trim()
            : '';

    if (poolId && existingVpc) {
        throw new Error(
            'VPC_IPV4_IPAM_POOL_ID applies only when MLSpace creates a new VPC. ' +
            'Remove VPC_IPV4_IPAM_POOL_ID (and VPC_IPAM_IPV4_NETMASK_LENGTH) when using an existing VPC.'
        );
    }

    const rawSubnet = config.VPC_SUBNET_IPV4_CIDR_MASK as unknown;
    let subnetMask: number;
    if (rawSubnet === undefined || rawSubnet === null || rawSubnet === '') {
        subnetMask = VPC_SUBNET_IPV4_CIDR_MASK;
    } else {
        const parsed = parseConfigInt(rawSubnet);
        if (parsed === undefined || parsed < 16 || parsed > 28) {
            throw new Error(
                'VPC_SUBNET_IPV4_CIDR_MASK must be an integer between 16 and 28 (per-tier subnet size).'
            );
        }
        subnetMask = parsed;
    }
    config.VPC_SUBNET_IPV4_CIDR_MASK = subnetMask;

    if (!poolId) {
        const orphanVpcMask = parseConfigInt(config.VPC_IPAM_IPV4_NETMASK_LENGTH as unknown);
        if (orphanVpcMask !== undefined) {
            throw new Error(
                'VPC_IPAM_IPV4_NETMASK_LENGTH is set but VPC_IPV4_IPAM_POOL_ID is empty. ' +
                'Set both for IPAM, or remove VPC_IPAM_IPV4_NETMASK_LENGTH for the default (non-IPAM) VPC.'
            );
        }
        config.VPC_IPAM_IPV4_NETMASK_LENGTH = undefined;
        return;
    }

    const vpcMask = parseConfigInt(config.VPC_IPAM_IPV4_NETMASK_LENGTH as unknown);
    if (vpcMask === undefined || vpcMask < 16 || vpcMask > 28) {
        throw new Error(
            'VPC_IPAM_IPV4_NETMASK_LENGTH is required when VPC_IPV4_IPAM_POOL_ID is set, ' +
            'and must be an integer between 16 and 28 (VPC allocation size from the pool).'
        );
    }
    if (subnetMask < vpcMask) {
        throw new Error(
            'VPC_SUBNET_IPV4_CIDR_MASK must be >= VPC_IPAM_IPV4_NETMASK_LENGTH so each subnet fits in the VPC CIDR.'
        );
    }
    config.VPC_IPAM_IPV4_NETMASK_LENGTH = vpcMask;
}
