#!/usr/bin/env node

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

import { App, Aspects, Tags } from 'aws-cdk-lib';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import 'source-map-support/register';
import {
    ACCESS_LOGS_BUCKET_NAME,
    AWS_ACCOUNT,
    AWS_REGION,
    CONFIG_BUCKET_NAME,
    DATA_BUCKET_NAME,
    ENABLE_TRANSLATE,
    EXISTING_KMS_MASTER_KEY_ARN,
    KEY_MANAGER_ROLE_NAME,
    LOGS_BUCKET_NAME,
    NOTEBOOK_PARAMETERS_FILE_NAME,
    NOTIFICATION_DISTRO,
    OIDC_CLIENT_NAME,
    OIDC_URL,
    OIDC_VERIFY_SIGNATURE,
    SYSTEM_BANNER_BACKGROUND_COLOR,
    SYSTEM_BANNER_TEXT,
    SYSTEM_BANNER_TEXT_COLOR,
    SYSTEM_TAG,
    WEBSITE_BUCKET_NAME
} from '../lib/constants';
import { AdminApiStack } from '../lib/stacks/api/admin';
import { DatasetsApiStack } from '../lib/stacks/api/datasets';
import { EmrApiStack } from '../lib/stacks/api/emr';
import { InferenceApiStack } from '../lib/stacks/api/inference';
import { JobsApiStack } from '../lib/stacks/api/jobs';
import { NotebooksApiStack } from '../lib/stacks/api/notebooks';
import { ProjectsApiStack } from '../lib/stacks/api/projects';
import { ApiStackProperties, RestApiStack } from '../lib/stacks/api/restApi';
import { TranslateApiStack } from '../lib/stacks/api/translate';
import { IAMStack } from '../lib/stacks/iam';
import { CoreStack } from '../lib/stacks/infra/core';
import { SagemakerStack } from '../lib/stacks/infra/sagemaker';
import { KMSStack } from '../lib/stacks/kms';
import { VPCStack } from '../lib/stacks/vpc';
import { ADCLambdaCABundleAspect } from '../lib/utils/adcCertBundleAspect';
import { ApiDeploymentStack } from '../lib/stacks/api/apiDeployment';

const validateRequiredProperty = (val: string, name: string) => {
    if (!val) {
        throw new Error(`${name} is a required property. \nPlease set the value in 'lib/constants.ts'.`);
    }
};

validateRequiredProperty(AWS_ACCOUNT, 'AWS_ACCOUNT');
validateRequiredProperty(OIDC_URL, 'OIDC_URL');
validateRequiredProperty(OIDC_CLIENT_NAME, 'OIDC_CLIENT_NAME');
validateRequiredProperty(AWS_REGION, 'AWS_REGION');

if (!EXISTING_KMS_MASTER_KEY_ARN) {
    validateRequiredProperty(KEY_MANAGER_ROLE_NAME, 'KEY_MANAGER_ROLE_NAME');
}

const envProperties = {
    account: AWS_ACCOUNT,
    region: AWS_REGION
};

const app = new App();
const stacks = [];
const isIso = ['us-iso-east-1', 'us-isob-east-1'].includes(AWS_REGION);

const vpcStack = new VPCStack(app, 'mlspace-vpc', {
    env: envProperties,
    deployCFNEndpoint: true,
    deployCWEndpoint: true,
    deployCWLEndpoint: true,
    deployDDBEndpoint: true,
    deployS3Endpoint: true,
    deploySTSEndpoint: true,
    isIso,
});
const mlSpaceVPC = vpcStack.vpc;

const kmsStack = new KMSStack(app, 'mlspace-kms', {
    env: envProperties,
    keyManagerRoleName: KEY_MANAGER_ROLE_NAME
});
stacks.push(kmsStack);

const configBucketName = `${CONFIG_BUCKET_NAME}-${AWS_ACCOUNT}`;
const dataBucketName = `${DATA_BUCKET_NAME}-${AWS_ACCOUNT}`;
const websiteBucketName = `${WEBSITE_BUCKET_NAME}-${AWS_ACCOUNT}`;
const cwlBucketName = `${LOGS_BUCKET_NAME}-${AWS_ACCOUNT}`;
const accessLogsBucketName = `${ACCESS_LOGS_BUCKET_NAME}-${AWS_ACCOUNT}`;

const iamStack = new IAMStack(app, 'mlspace-iam', {
    env: envProperties,
    dataBucketName,
    configBucketName,
    websiteBucketName,
    enableTranslate: ENABLE_TRANSLATE,
    encryptionKey: kmsStack.masterKey,
    mlSpaceVPC: vpcStack.vpc,
    mlSpaceDefaultSecurityGroupId: vpcStack.vpcSecurityGroupId,
    isIso
});
iamStack.addDependency(vpcStack);
iamStack.addDependency(kmsStack);
stacks.push(iamStack);

const mlSpaceNotebookRole = iamStack.mlSpaceNotebookRole;
const mlSpaceAppRole = iamStack.mlSpaceAppRole;
const websiteS3ReaderRole = iamStack.s3ReaderRole;
const permissionsBoundaryArn = iamStack.mlSpacePermissionsBoundary?.managedPolicyArn;

const lambdaSourcePath = './backend/src/';
const frontEndAssetsPath = './frontend/build/';

const coreStack = new CoreStack(app, 'mlspace-core', {
    env: envProperties,
    dataBucketName,
    configBucketName,
    websiteBucketName,
    cwlBucketName,
    accessLogsBucketName,
    notificationDistro: NOTIFICATION_DISTRO,
    encryptionKey: kmsStack.masterKey,
    mlSpaceAppRole,
    mlSpaceNotebookRole,
    mlSpaceVPC,
    lambdaSecurityGroups: [vpcStack.vpcSecurityGroup],
    mlSpaceDefaultSecurityGroupId: vpcStack.vpcSecurityGroupId,
    lambdaSourcePath,
    isIso,
});
coreStack.addDependency(kmsStack);
coreStack.addDependency(vpcStack);
stacks.push(coreStack);

stacks.push(new SagemakerStack(app, 'mlspace-sagemaker', {
    env: envProperties,
    dataBucketName,
}));

const restStack = new RestApiStack(app, 'mlspace-web-tier', {
    env: envProperties,
    dataBucketName,
    websiteBucketName,
    websiteS3ReaderRole,
    mlSpaceAppRole,
    lambdaSourcePath,
    frontEndAssetsPath,
    verifyOIDCTokenSignature: OIDC_VERIFY_SIGNATURE,
    mlSpaceVPC,
    lambdaSecurityGroups: [vpcStack.vpcSecurityGroup],
    isIso,
    enableTranslate: ENABLE_TRANSLATE,
    systemBannerConfiguration: {
        text: SYSTEM_BANNER_TEXT,
        backgroundColor: SYSTEM_BANNER_BACKGROUND_COLOR,
        fontColor: SYSTEM_BANNER_TEXT_COLOR
    }
});

// The REST stack will push a config file to the website bucket so the Core
// stack must be created first
restStack.addDependency(coreStack);
restStack.addDependency(vpcStack);
stacks.push(restStack);

const apiStackProperties: ApiStackProperties = {
    env: envProperties,
    restApiId: restStack.mlSpaceRestApiId,
    rootResourceId: restStack.mlSpaceRestApiRootResourceId,
    dataBucketName,
    configBucketName,
    cwlBucketName,
    applicationRole: mlSpaceAppRole,
    notebookInstanceRole: mlSpaceNotebookRole,
    notebookParamFileKey: NOTEBOOK_PARAMETERS_FILE_NAME,
    deploymentEnvironmentName: 'mlspace',
    authorizer: restStack.mlspaceRequestAuthorizer,
    lambdaSourcePath,
    mlSpaceVPC: vpcStack.vpc,
    securityGroups: [vpcStack.vpcSecurityGroup],
    permissionsBoundaryArn: iamStack.mlSpacePermissionsBoundary?.managedPolicyArn,
    emrServiceRoleName: iamStack.emrServiceRoleName,
    emrEC2RoleName: iamStack.emrEC2RoleName,
};

const apiStacks = [
    new AdminApiStack(app, 'mlspace-admin-apis', apiStackProperties),
    new DatasetsApiStack(app, 'mlspace-dataset-apis', apiStackProperties),
    new InferenceApiStack(app, 'mlspace-inference-apis', apiStackProperties),
    new JobsApiStack(app, 'mlspace-jobs-apis', apiStackProperties),
    new NotebooksApiStack(app, 'mlspace-notebook-apis', apiStackProperties),
    new ProjectsApiStack(app, 'mlspace-project-apis', apiStackProperties),
    new EmrApiStack(app, 'mlspace-emr-apis', apiStackProperties),
];

if (ENABLE_TRANSLATE) {
    apiStacks.push(new TranslateApiStack(app, 'mlspace-translate-apis', apiStackProperties));
}
const apiDeploymentStack = new ApiDeploymentStack(app, 'mlspace-api-deployment', {
    env: envProperties,
    restApiId: restStack.mlSpaceRestApiId,
});

apiStacks.forEach((stack) => {
    stack.addDependency(coreStack);
    stack.addDependency(iamStack);
    stack.addDependency(vpcStack);
    apiDeploymentStack.addDependency(stack);
    if (isIso) {
        Aspects.of(stack).add(new ADCLambdaCABundleAspect());
    }
});

stacks.push(...apiStacks);

// Apply infrastructure tags to all stack resources for cost reporting
stacks.forEach((resource) => {
    // Tags are not supported on log groups in ADC regions
    if (!isIso || resource instanceof LogGroup) {
        Tags.of(resource).add('system', SYSTEM_TAG);
        Tags.of(resource).add('user', 'MLSpaceApplication');
        Tags.of(resource).add('project', 'MLSpaceInfrastructure');
    }
});