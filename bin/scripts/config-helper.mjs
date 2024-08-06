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
import fs from 'fs';  
import figlet from 'figlet';  
import enquirer from 'enquirer';  

const prompt = enquirer.prompt;  


const BASIC = 'basic';
const ADVANCED = 'advanced';

// Stores all user answers
let answers = {};

console.log(figlet.textSync('MLSpace Config Wizard'));

createConfig();




async function createConfig () {
    const configTypeResponse = await prompt({
        type: 'select',
        name: 'configType',
        choices: [
            { message: 'Basic Config - only prompts for the properties which must be set in order to deploy MLSpace.', name: BASIC },
            { message: 'Advanced Config - prompts for required fields as well as optional configurations which are commonly customized.', name: ADVANCED },
        ],
        message: 'Select a configuration type:',
    });

    await basicConfigPrompts();

    if (configTypeResponse.configType === ADVANCED) {
        await advancedConfigPrompts();
    }
    
    fs.writeFileSync('./lib/config.json', JSON.stringify(answers, undefined, 4));
}


async function advancedConfigPrompts () {
    const vpcResponse = await prompt({
        type: 'confirm',
        name: 'existingVpc',
        message: 'Do you want to use existing VPC? (selecting no will create a new VPC for MLSpace)',
    });
    if (vpcResponse.existingVpc) {
        await askVpcQuestions();
    }

    const roleResponse = await prompt({
        type: 'confirm',
        name: 'existingRoles',
        message: 'Do you want to use existing IAM Roles/Policies? (selecting no will create new IAM Roles/Policies for MLSpace actions)',
    });
    if (roleResponse.existingRoles) {
        await askRoleQuestions();
    }

    // List of other advanced settings which don't fit into a category
    const otherAdvancedSettings = [
        {
            type: 'confirm',
            name: 'NEW_USERS_SUSPENDED',
            message: 'New Users Suspended: whether or not new user accounts will be created in a suspended state by default',
        },
    ];

    const otherPromptAnswers = await prompt(otherAdvancedSettings);
    answers = {...answers, ...otherPromptAnswers};

}

// These properties must always be set
async function basicConfigPrompts () {
    let basicQuestions = [
        {
            type: 'input',
            name: 'AWS_ACCOUNT',
            message: 'AWS Account: the AWS account ID for the account MLSpace will be deployed into',
        },
        {
            type: 'input',
            name: 'AWS_REGION',
            message: 'AWS Region: the region that MLSpace resources will be deployed into',
        },
        {
            type: 'input',
            name: 'OIDC_URL',
            message: 'OIDC URL: the OIDC endpoint that will be used for MLSpace authentication',
        },
        {
            type: 'input',
            name: 'OIDC_CLIENT_NAME',
            message: 'OIDC Client Name: the OIDC client name that should be used by MLSpace for authentication',
        },
        {
            type: 'input',
            name: 'KEY_MANAGER_ROLE_NAME',
            message: 'Key Manager Role Name: name of the IAM role with permissions to manage the KMS Key. This could be something like Admin or a dedicated role for KMS Key Management'
        }
    ];

    const basicPromptAnswers = await prompt(basicQuestions);
    answers = {...answers, ...basicPromptAnswers};

}

async function askVpcQuestions () {
    const vpcQuestions = [
        {
            type: 'input',
            name: 'EXISTING_VPC_NAME',
            message: 'VPC Name: the name of the VPC into which MLSpace will be deployed',
        },
        {
            type: 'input',
            name: 'EXISTING_VPC_ID',
            message: 'VPC ID: the ID of the VPC into which MLSpace will be deployed',
        },
        {
            type: 'input',
            name: 'EXISTING_VPC_DEFAULT_SECURITY_GROUP',
            message: 'the ID of the default security group of the VPC into which MLSpace will be deployed',
        },
    ];

    const vpcPromptAnswers = await prompt(vpcQuestions);
    answers = {...answers, ...vpcPromptAnswers};
}

async function askRoleQuestions () {
    const roleQuestions = [
        {
            type: 'input',
            name: 'S3_READER_ROLE_ARN',
            message: 'S3 Reader Role ARN: arn of an existing IAM role to use for reading from the static website S3 bucket. If not specified a new role with the correct privileges will be created',
        },
        {
            type: 'input',
            name: 'BUCKET_DEPLOYMENT_ROLE_ARN',
            message: 'Bucket Deployment Role ARN: arn of an existing IAM role to use for deploying to the static website S3 bucket. If not specified a new role with the correct privileges will be created',
        },
        {
            type: 'input',
            name: 'NOTEBOOK_ROLE_ARN',
            message: 'Notebook Role ARN: arn of an existing IAM role to associate with all notebooks created in MLSpace. If using dynamic roles based on project/user combinations the specific combination role will be used instead. This value must be set to an existing role because the default CDK deployment will not create one.',
        },
        {
            type: 'input',
            name: 'ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN',
            message: 'Notebook Endpoint Config Instance Constraint Policy ARN: arn of an existing IAM policy to use for constraining instance types that an Endpoint Configuration can be created with from a Notebook',
        },
        {
            type: 'input',
            name: 'JOB_INSTANCE_CONSTRAINT_POLICY_ARN',
            message: 'Notebook Job Instance Constraint Policy ARN: arn of an existing IAM policy to use for constraining instance types that Training/HPO/Transform jobs can be created with from a Notebook',
        },
        {
            type: 'input',
            name: 'APP_ROLE_ARN',
            message: 'App Role ARN: arn of an existing IAM role to use for executing the MLSpace lambdas. This value must be set to an existing role because the default CDK deployment will not create one',
        },
        {
            type: 'input',
            name: 'SYSTEM_ROLE_ARN',
            message: 'System Role ARN: arn of an existing IAM role to use for executing the MLSpace system lambdas. This value must be set to an existing role because the default CDK deployment will not create one.',
        },
        {
            type: 'input',
            name: 'EMR_DEFAULT_ROLE_ARN',
            message: 'EMR Default Role ARN: arn of an existing IAM role that will be used as the \'ServiceRole\' for all EMR clusters',
        },
        {
            type: 'input',
            name: 'EMR_EC2_INSTANCE_ROLE_ARN',
            message: 'EMR EC2 Instance Role ARN: arn of an existing role that will be used as the \'JobFlowRole\' and \'AutoScalingRole\' for all EMR clusters',
        },
    ];
    const rolePromptAnswers = await prompt(roleQuestions);
    answers = {...answers, ...rolePromptAnswers};
}