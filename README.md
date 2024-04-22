# MLSpace

[![Full Documentation](https://img.shields.io/badge/Full%20Documentation-blue?style=for-the-badge&logo=Vite&logoColor=white)](https://awslabs.github.io/mlspace/)

## Deployment Prerequisites

### Software

In order to build and deploy MLSpace to your AWS account you will need the following software installed on your machine:

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [awscli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [nodejs](https://nodejs.org/en/download/) 18+
- [docker](https://docker.com) or a compatible runtime for generating lambda layers
- cdk (`npm install -g cdk`)

### Additional Information

In addition to the required software you will also need to have the following information:

- AWS account Id and region you'll be deploying MLSpace into (you'll need admin credentials or similar)
- IdP information including the OIDC endpoint and client name

## Configuring MLSpace

There are two options for configuring MLSpace for deployment:

### Option 1 (Recommended)- Configure using the MLSpace Config Wizard

Configure MLSpace using Option 1 if:

- you want to be prompted for only the settings necessary to launch MLSpace with minimal configuration changes; or...
- you want to be prompted only for the necessary settings as well as values that are commonly modified (VPC configuration, IAM roles, etc)
- you want to configure and deploy MLSpace with a generated config file which is not committed to git

After running the MLSpace Config Wizard, a new file will be generated: `/lib/config.json`.

When MLSpace is deployed it will merge the settings in `/lib/config.json` and `constants.ts` to determine the final configuration settings (giving precedence to values set in `/lib/config.json`).

Any values left empty while using the MLSpace Config Wizard will default to what is set in the `lib/constants.ts` file.

The MLSpace Config Wizard can be invoked with the command:

```Bash
npm run config
```

This will prompt you to choose between Basic Config and Advanced Config.

- Basic Config - only prompts for the properties which must be set in order to deploy MLSpace.
- Advanced Config - prompts for required fields as well as optional configurations which are commonly customized.

If selecting Basic Config, the properties you will be prompted for are:

- AWS account ID: the AWS account ID for the account MLSpace will be deployed into
- AWS region: the region that MLSpace resources will be deployed into
- OIDC URL: the OIDC endpoint that will be used for MLSpace authentication
- OIDC Client Name: the OIDC client name that should be used by MLSpace for authentication

If selecting Advanced Config you will be prompted for the same properties Basic Config prompts for, as well as other optional values. Anything not specified will use the defaults in `constants.ts` and/or provisioned by MLSpace.

The Advanced Config will ask:

**Do you want to use existing VPC?**
If you answered yes you will be prompted for:

- VPC Name: if MLSpace is being deployed into an existing VPC this should be the name of that VPC
- VPC ID: if MLSpace is being deployed into an existing VPC this should be the ID of that VPC
- VPC Default Security Group: if MLSpace is being deployed into an existing VPC this should be the default security group of that VPC

**Do you want to use existing IAM Roles?**
If you answered yes you will be prompted for:

- S3 Reader Role ARN: ARN of an existing IAM role to use for reading from the static website S3 bucket
- Bucket Deployment Role ARN: ARN of an existing IAM role to use for deploying to the static website S3 bucket
- Notebook Role ARN: ARN of an existing IAM role to associate with all notebooks created in MLSpace
- App Role ARN: ARN of an existing IAM role to use for executing the MLSpace lambdas
- EMR Default Role ARN: ARN of an existing IAM role that will be used as the 'ServiceRole' for all EMR clusters
- EMR EC2 Instance Role ARN: ARN of an existing role that will be used as the 'JobFlowRole' and 'AutoScalingRole' for all EMR clusters

**Do you want to modify the banner displayed on MLSpace?**
If you answered yes you will be prompted for:

- System Banner Text: the text to display on the system banner displayed at the top and bottom of the MLSpace web application. If set to a blank string no banner will be displayed
- System Banner Background Color: the background color of the system banner if enabled
- System Banner Text Color: the color of the text displayed in the system banner if enabled

### Option 2 - Configure by updating lib/constants.ts

Configure MLSpace using Option 2 if:

- the MLSpace Config Wizard doesn't configure all of the settings you need to customize
- you wish to have your configuration changes in a file that's committed to git
- will have to resolve conflicts when upgrading MLSpace

If you are pre-creating roles you will need to ensure that the required role arns (`APP_ROLE_ARN`, `NOTEBOOK_ROLE_ARN`), role names (`KEY_MANAGER_ROLE_NAME` if `EXISTING_KMS_MASTER_KEY_ARN` is not set), and `AWS_ACCOUNT` (used to ensure unique S3 bucket names) have been properly set in `lib/constants.ts`.

You will also need to set `OIDC_URL` and `OIDC_CLIENT_NAME` with the correct values based on your chosen IdP. These property must be set prior to deploying MLSpace.

To see the full list of configurable properties and their descriptions, see the [Configurable deployment parameters section](Configurable deployment parameters).

### Creating a production optimized web app build

Once configuration has been completed you will also need to create a production build of the web application. You can do this by changing to the web application directory (`frontend/`) and running:

```Bash
# From project root directory
cd frontend
npm run clean && npm install
```

This will generate a production optimized build of the web application and documentation, the resulting artifacts will be written to the `frontend/build/` directory.

There are no web application specific configuration parameters that need to be set as the configuration will be dynamically generated as part of the CDK deployment based on the variables set during the configuration steps, as well as the deployed resources.

## Deploying the CDK application

The MLSpace application is a standard CDK application and can be deployed just as any CDK application is deployed:

```Bash
# From project root directory
npm install && cdk bootstrap <REPLACE WITH YOUR ACCOUNT NUMBER>/<REPLACE WITH TARGET REGION>
```

Once the account has been bootstrap you can deploy the application. You can optionally include `--require-approval never` in the below command if you don't want to confirm changes:

```Bash
# From project root directory
cdk deploy --all
```

## Configurable deployment parameters

If the config-helper doesn't provide the level of customization you need for your deployment, you can update the values in `lib/constants.ts` based on your specific deployment needs. Some of these will directly impact whether new resources are created within your account or whether existing resources (VPC, KMS, Roles, etc) will be leveraged.

| Variable   |      Description      |  Default |
|----------|:-------------:|------:|
| AWS_ACCOUNT | The account number that MLSpace is being deployed into. Used to disambiguated S3 buckets within a region. | - |
| AWS_REGION | The region that MLSpace is being deployed into. This is only needed when you are using an existing VPC or KMS key and `EXISTING_KMS_MASTER_KEY_ARN` or `EXISTING_VPC_ID` is set. | - |
| IDP_ENDPOINT_SSM_PARAM | If set, MLSpace will use the value of this parameter as the `OIDC_URL`. During deployment the value of this parameter will be read from SSM. This value takes precedence over `OIDC_URL` if both are set. | - |
| OIDC_URL | The OIDC endpoint that will be used for MLSpace authentication | - |
| OIDC_CLIENT_NAME | The OIDC client name that should be used by MLSpace for authentication | - |
| OIDC_REDIRECT_URL | The redirect URL that should be used after succesfully authenticating with the OIDC provider. This will default to the API gateway URL generated by the CDK deployment but can be manually set if you're using custom DNS | `undefined` |
| OIDC_VERIFY_SSL | Whether or not calls to the OIDC endpoint specified in the `OIDC_URL` environment variable should validate the server certificate | `true` |
| OIDC_VERIFY_SIGNATURE | Whether or not the lambda authorizer should verify the JWT token signature | `true` |
| ADDITIONAL_LAMBDA_ENVIRONMENT_VARS | A map of key value pairs which will be set as environment variables on every MLSpace lambda | `{}` |
| SYSTEM_BANNER_TEXT | The text to display on the system banner displayed at the top and bottom of the MLSpace web application. If set to a blank string no banner will be displayed. | `` |
| SYSTEM_BANNER_BACKGROUND_COLOR | The background color of the system banner if enabled. Supports valid CSS colors including predefined color names, hex values, and rgb values. | `black` |
| SYSTEM_BANNER_TEXT_COLOR | The color of the text displayed in the system banner if enabled. Supports valid CSS colors including predefined color names, hex values, and rgb values. | `white` |
| RESOURCE_TERMINATION_INTERVAL | Interval (in minutes) to run the resource termination cleanup lambda | `60` |
| BACKGROUND_REFRESH_INTERVAL | Interval (in minutes) to run background resource data updates | `60` |
| DATASETS_TABLE_NAME |  Dynamo DB table to hold dataset related metadata | `mlspace-datasets` |
| PROJECTS_TABLE_NAME |  Dynamo DB table to hold project related metadata | `mlspace-projects` |
| PROJECT_USERS_TABLE_NAME |  Dynamo DB table to hold project membership related metadata. Including permissions and project/user specific IAM role data. | `mlspace-project-users` |
| USERS_TABLE_NAME |  Dynamo DB table to hold user related metadata | `mlspace-users` |
| CONFIG_BUCKET_NAME |  S3 bucket used to store MLSpace configuration files (notebook lifecycle configs, notebook params, etc) | `mlspace-config` |
| DATA_BUCKET_NAME |  S3 bucket used to store user uploaded dataset files | `mlspace-datasets` |
| LOGS_BUCKET_NAME |  S3 bucket used to store logs from EMR clusters launched in MLSpace and, if configured, MLSpace cloudtrail events  | `mlspace-logs` |
| ACCESS_LOGS_BUCKET_NAME | S3 bucket which will store access logs if `ENABLE_ACCESS_LOGGING` is `true` | `mlspace-access-logs` |
| WEBSITE_BUCKET_NAME |  S3 bucket used to store the static MLSpace website  | `mlspace-website` |
| MLSPACE_LIFECYCLE_CONFIG_NAME |  Name of the default licycle config that should be used with MLSpace notebooks (will be generated as part of the CDK deployment)  | `mlspace-notebook-lifecycle-config` |
| NOTEBOOK_PARAMETERS_FILE_NAME |  Filename of the default notebook parameters that is generated as part of the CDK deployment  | `mlspace-website` |
| PERMISSIONS_BOUNDARY_POLICY_NAME | Name of the managed policy used as a permissions boundary for dynamically created MLSpace roles. If this is not set the default permissions boundary will be created and used | - |
| KEY_MANAGER_ROLE_NAME | Name of the IAM role with permissions to manage the KMS Key. If this property is set you _do not_ need to set `EXISTING_KMS_MASTER_KEY_ARN`. | - |
| EXISTING_KMS_MASTER_KEY_ARN | ARN of existing KMS key to use with MLSpace. This key should allow the roles associated with the `NOTEBOOK_ROLE_ARN` and `APP_ROLE_ARN` usage of the key. This value takes precedence over `KEY_MANAGER_ROLE_NAME` if both are set. If this property is set you _do not_ need to set `KEY_MANAGER_ROLE_NAME`. |
| SYSTEM_TAG | Tag which will be applied to all MLSpace resources created with the AWS account to which MLSpace is deployed | `MLSpace` |
| IAM_RESOURCE_PREFIX | Value preprended to MLSpace dynamic roles and policies when `MANAGE_IAM_ROLES` is set to `true` | `MLSpace` |
| MANAGE_IAM_ROLES | This setting determines whether or not MLSpace will dynamically create unique roles per project/user combinations. | `true` |
| NOTIFICATION_DISTRO | Optional email distribution list which will be notified when <TBD> | - |
| EXISTING_VPC_NAME | If MLSpace is being deployed into an existing VPC this should be the name of that VPC (must also set `EXISTING_VPC_ID`) | - |
| EXISTING_VPC_ID | If MLSpace is being deployed into an existing VPC this should be the id of that VPC (must also set `EXISTING_VPC_NAME`) | - |
| EXISTING_VPC_DEFAULT_SECURITY_GROUP | If MLSpace is being deployed into an existing VPC this should be the default security group of that VPC | - |
| APP_ROLE_ARN | Arn of an existing IAM role to use for executing the MLSpace lambdas. This value must be set to an existing role because the default CDK deployment will not create one. | - |
| NOTEBOOK_ROLE_ARN | Arn of an existing IAM role to associate with all notebooks created in MLSpace. If using dynamic roles based on project/user combinations the specific combination role will be used instead. This value must be set to an existing role because the default CDK deployment will not create one. | - |
| S3_READER_ROLE_ARN | Arn of an existing IAM role to use for reading from the static website S3 bucket. If not specified a new role with the correct privileges will be created | - |
| EMR_DEFAULT_ROLE_ARN | Role that will be used as the "ServiceRole" for all EMR clusters | - |
| EMR_EC2_INSTANCE_ROLE_ARN | Role that will be used as the "JobFlowRole" and "AutoScalingRole" for all EMR clusters | - |
| ENABLE_ACCESS_LOGGING | Whether or not to enable access logging for S3 and APIGW in MLSpace | `true` |
| APIGATEWAY_CLOUDWATCH_ROLE_ARN | If API Gateway access logging is enabled (`ENABLE_ACCESS_LOGGING` is true) then this is the ARN of the role that will be used to push those access logs | - |
| CREATE_MLSPACE_CLOUDTRAIL_TRAIL | Whether or not to create an MLSpace trail within the account | `true` |
| NEW_USERS_SUSPENDED | Whether or not new user accounts will be created in a suspended state by default | `false` |
| ENABLE_TRANSLATE | Whether or not translate capabilities will be deployed/enabled in MLSpace. If translate is not available in the region you are deploying to you should set this to `false` | `true` |
| LAMBDA_RUNTIME | The lambda runtime to use for MLSpace lambda functions and layers. This needs to be a python runtime available in the region in which MLSpace is being deployed. | Python 3.11 |
| LAMBDA_ARCHITECTURE | The architecture on which to deploy the MLSpace lambda functions. All lambda layers will also need to be built for the selected archiecture. You can do this by ensuring you run the `cdk deploy` command from a machine with the same architecture you're targeting. | x86 |
