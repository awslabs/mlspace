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

import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';

// DynamoDB table names. If you modify these you may need to modify the application role policy
// statements to ensure actions are allowed against the correct resources. The default policy
// relies on all mlspace tables having a prefix of "mlspace-"
export const DATASETS_TABLE_NAME = 'mlspace-datasets';
export const PROJECTS_TABLE_NAME = 'mlspace-projects';
export const PROJECT_USERS_TABLE_NAME = 'mlspace-project-users';
export const PROJECT_GROUPS_TABLE_NAME = 'mlspace-project-groups';
export const USERS_TABLE_NAME = 'mlspace-users';
export const RESOURCE_SCHEDULE_TABLE_NAME = 'mlspace-resource-schedule';
export const RESOURCE_METADATA_TABLE_NAME = 'mlspace-resource-metadata';
export const APP_CONFIGURATION_TABLE_NAME = 'mlspace-app-configuration';
export const GROUPS_TABLE_NAME = 'mlspace-groups';
export const GROUPS_MEMBERSHIP_HISTORY_TABLE_NAME = 'mlspace-group-membership-history';
export const GROUP_DATASETS_TABLE_NAME = 'mlspace-group-datasets';
export const GROUP_USERS_TABLE_NAME = 'mlspace-group-users';
export const CONFIGURATION_PROFILES_TABLE_NAME = 'mlspace-configuration-profiles';
export const CONFIG_BUCKET_NAME = 'mlspace-config';
export const DATA_BUCKET_NAME = 'mlspace-data';
export const LOGS_BUCKET_NAME = 'mlspace-logs';
export const ACCESS_LOGS_BUCKET_NAME = 'mlspace-access-logs';
export const WEBSITE_BUCKET_NAME = 'mlspace-website';
export const MLSPACE_LIFECYCLE_CONFIG_NAME = 'mlspace-notebook-lifecycle-config';
export const NOTEBOOK_PARAMETERS_FILE_NAME = 'notebook-params.json';
export const PERMISSIONS_BOUNDARY_POLICY_NAME = '';

// This could be something like Admin or a dedicated role for KMS Key Management
export const KEY_MANAGER_ROLE_NAME = '';

// Account ID is appended to s3 buckets to ensure uniqueness within region
export const AWS_ACCOUNT = '';
// Region is required when importing existing resources (used when upgrading)
export const AWS_REGION = '';

export const SYSTEM_TAG = 'MLSpace';
export const IAM_RESOURCE_PREFIX = 'MLSpace';

// Set this to false if you do not want MLSpace to dynamically manage roles for project users
export const MANAGE_IAM_ROLES = true;

/* Optional configuration settings */
export const NOTIFICATION_DISTRO = '';
export const EXISTING_VPC_NAME = '';
export const EXISTING_VPC_ID = '';
export const EXISTING_VPC_DEFAULT_SECURITY_GROUP = '';
export const EXISTING_KMS_MASTER_KEY_ARN = '';
export const KMS_INSTANCE_CONDITIONS_POLICY_ARN = '';
export const S3_READER_ROLE_ARN = '';
export const BUCKET_DEPLOYMENT_ROLE_ARN = '';

/*
 * Optionally set a key:value map of additional environment variables that will be added to all
 * MLSpace lambda functions. A common use of this would be configuring a proxy server for all
 * traffic. For example:
 * {
 *     'HTTP_PROXY': 'proxy.service.consul:3128',
 *     'HTTPS_PROXY': 'proxy.service.consul:3128',
 *     'NO_PROXY': '.consul,localhost,127.0.0.1,169.254.0.0/16,169.254.169.254,10.0.0.0/8',
 * }
 */
export const ADDITIONAL_LAMBDA_ENVIRONMENT_VARS: { [key: string]: string } = {};
/*
 * These roles must already exist in your account and have the required permissions.
 * The value here must be a valid arn similar to 'arn:aws:iam::111111111111:role/mls-notebook'
 */
export const NOTEBOOK_ROLE_ARN = '';
export const APP_ROLE_ARN = '';
export const SYSTEM_ROLE_ARN = '';

/* EMR Configuration */
// Role that will be used as the "ServiceRole" for all EMR clusters
export const EMR_DEFAULT_ROLE_ARN = '';
// Role that will be used as the "JobFlowRole" and "AutoScalingRole" for all EMR clusters
export const EMR_EC2_INSTANCE_ROLE_ARN = '';
export const EMR_SECURITY_CONFIG_NAME = 'MLSpace-EMR-SecurityConfig';

// The name of the EC2 key pair that can be used to connect to the master node using SSH as the user called “hadoop.”
export const EMR_EC2_SSH_KEY = '';

// Set this to false to disable access logging on all MLSpace S3 buckets and the APIGW
export const ENABLE_ACCESS_LOGGING = true;
// If access logs are enabled API Gateway will use the Cloudwatch role for your account
// if you have an existing role set that ARN here otherwise MLSpace will attempt to create
// the role for you
export const APIGATEWAY_CLOUDWATCH_ROLE_ARN = '';
// Set this to false if you do not want to create an MLSpace specific trail
export const CREATE_MLSPACE_CLOUDTRAIL_TRAIL = true;

// SSM property names
export const COMMON_LAYER_ARN_PARAM = '/mlspace/common-lambda-layer';

// The default name for the application
export const APPLICATION_NAME = 'MLSpace';

// Policy names attached to NOTEBOOK_ROLE_ARN that restricts instance types that a notebook
// can use for each service
export const ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN = '';
// Training / HPO / Transform
export const JOB_INSTANCE_CONSTRAINT_POLICY_ARN = '';

/* Web app properties */
export const IDP_ENDPOINT_SSM_PARAM = '';
export const OIDC_URL = '';
// OIDC URL that can be hit by authorizer lambda for token validation. If the OIDC endpoint is
// exposed publicly and can be hit by from the MLSpace VPC this value does not need to be set.
// If the OIDC endpoint is not accessible directly from VPC and requires peering or some other
// proxy, this can be set to something which the lambda can traverse in order to reach the OIDC
// instance.
export const INTERNAL_OIDC_URL = '';
export const OIDC_CLIENT_NAME = '';
// If your OIDC server is using a self signed cert set this to false
export const OIDC_VERIFY_SSL = true;
export const OIDC_VERIFY_SIGNATURE = true;
// This defaults to the APIGW url but if you're using custom DNS you should set this to that
export const OIDC_REDIRECT_URI = '';
// Interval (in minutes) to run the resource termination cleanup lambda
export const RESOURCE_TERMINATION_INTERVAL = 60;
// Interval (in minutes) to run background resource data updates
export const BACKGROUND_REFRESH_INTERVAL = 60;
// The default suspension state for new users. If true, new users are suspended and can't perform actions until validated by a SysAdmin
export const NEW_USERS_SUSPENDED = false;

export const LAMBDA_ARCHITECTURE = Architecture.X86_64;
export const LAMBDA_RUNTIME = Runtime.PYTHON_3_11;

export const SHOW_MIGRATION_OPTIONS = false;
