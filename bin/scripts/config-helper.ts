const fs = require('fs');
const figlet = require("figlet");
const { prompt } = require('enquirer');


// These properties must always be set
let questions = [
    {
      type: "input",
      name: "AWS_ACCOUNT",
      message: "AWS Account: the AWS account ID for the account MLSpace will be deployed into",
    },
    {
      type: "input",
      name: "AWS_REGION",
      message: "AWS Region: the region that MLSpace resources will be deployed into",
    },
    {
        type: "input",
        name: "OIDC_URL",
        message: "OIDC URL: the OIDC endpoint that will be used for MLSpace authentication",
    },
    {
        type: "input",
        name: "OIDC_CLIENT_NAME",
        message: "OIDC Client Name: the OIDC client name that should be used by MLSpace for authentication",
    },
]


console.log(figlet.textSync("MLSpace Config Wizard"));

createConfig();

async function createConfig() {
    const basic = "basic";
    const advanced = "advanced";
    const advancedOrBasicResponse = await prompt({
        type: "select",
        name: "configType",
        choices: [
            { message: "Basic Config - only prompts for the properties which must be set in order to deploy MLSpace.", name: basic },
            { message: "Advanced Config - prompts for required fields as well as optional configurations which are commonly customized.", name: advanced },
        ],
        message: "Select a configuration type:",
    })

    if(advancedOrBasicResponse.configType === advanced) {
        await advancedPrompts();
        console.log(questions.length)
    }


    // The final list of questions has been created, this answer object will be the final config JSON
    const answers = await prompt(questions);
    
    fs.writeFileSync('./lib/config.json', JSON.stringify(answers, undefined, 4));
}


async function advancedPrompts() {
    const vpcResponse = await prompt({
        type: "confirm",
        name: "existingVpc",
        message: "Do you want to use existing VPC? (selecting false will create a new VPC for MLSpace)",
    })
    if(vpcResponse.existingVpc) {
        const vpcQuestions = [
            {
                type: "input",
                name: "EXISTING_VPC_NAME",
                message: "VPC Name: if MLSpace is being deployed into an existing VPC this should be the name of that VPC",
            },
            {
                type: "input",
                name: "EXISTING_VPC_ID",
                message: "VPC ID: if MLSpace is being deployed into an existing VPC this should be the ID of that VPC",
            },
            {
                type: "input",
                name: "EXISTING_VPC_DEFAULT_SECURITY_GROUP",
                message: "VPC Default Security Group: if MLSpace is being deployed into an existing VPC this should be the default security group of that VPC",
            },
        ]
        questions.push(...vpcQuestions);
    }

    const roleResponse = await prompt({
        type: "confirm",
        name: "existingRoles",
        message: "Do you want to use existing IAM Roles? (selecting false will create new IAM Roles for MLSpace actions)",
    });
    if(roleResponse.existingRoles) {
        const roleQuestions = [
            {
                type: "input",
                name: "S3_READER_ROLE_ARN",
                message: "S3 Reader Role ARN: arn of an existing IAM role to use for reading from the static website S3 bucket. If not specified a new role with the correct privileges will be created",
            },
            {
                type: "input",
                name: "BUCKET_DEPLOYMENT_ROLE_ARN",
                message: "Bucket Deployment Role ARN: arn of an existing IAM role to use for deploying to the static website S3 bucket. If not specified a new role with the correct privileges will be created",
            },
            {
                type: "input",
                name: "NOTEBOOK_ROLE_ARN",
                message: "Notebook Role ARN: arn of an existing IAM role to associate with all notebooks created in MLSpace. If using dynamic roles based on project/user combinations the specific combination role will be used instead. This value must be set to an existing role because the default CDK deployment will not create one.",
            },
            {
                type: "input",
                name: "APP_ROLE_ARN",
                message: "App Role ARN: arn of an existing IAM role to use for executing the MLSpace lambdas. This value must be set to an existing role because the default CDK deployment will not create one",
            },
            {
                type: "input",
                name: "EMR_DEFAULT_ROLE_ARN",
                message: "EMR Default Role ARN: arn of an existing IAM role that will be used as the 'ServiceRole' for all EMR clusters",
            },
            {
                type: "input",
                name: "EMR_EC2_INSTANCE_ROLE_ARN",
                message: "EMR EC2 Instance Role ARN: arn of an existing role that will be used as the 'JobFlowRole' and 'AutoScalingRole' for all EMR clusters",
            },
        ]
        questions.push(...roleQuestions);
    }

    const bannerResponse = await prompt({
        type: "confirm",
        name: "createBanner",
        message: "Do you want to modify the banner displayed on MLSpace? (selecting false will default in MLSpace having no banner)",
    })
    if(bannerResponse.createBanner) {
        const bannerQuestions = [
            {
                type: "input",
                name: "SYSTEM_BANNER_TEXT",
                message: "System Banner Text: the text to display on the system banner displayed at the top and bottom of the MLSpace web application. If set to a blank string no banner will be displayed",
            },
            {
                type: "input",
                name: "SYSTEM_BANNER_BACKGROUND_COLOR",
                message: "System Banner Background Color: the background color of the system banner if enabled. Supports valid CSS colors including predefined color names, hex values, and rgb values",
            },
            {
                type: "input",
                name: "SYSTEM_BANNER_TEXT_COLOR",
                message: "System Banner Text Color: the color of the text displayed in the system banner if enabled. Supports valid CSS colors including predefined color names, hex values, and rgb values",
            },
        ]
        questions.push(...bannerQuestions)
    }
}