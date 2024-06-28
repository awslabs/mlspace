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

import { App, Aspects, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Trail } from 'aws-cdk-lib/aws-cloudtrail';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { CfnSecurityConfiguration } from 'aws-cdk-lib/aws-emr';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Effect, IManagedPolicy, IRole, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Code, Function } from 'aws-cdk-lib/aws-lambda';
import {
    Bucket,
    BucketAccessControl,
    BucketEncryption,
    EventType,
    HttpMethods,
    ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { ADCLambdaCABundleAspect } from '../../utils/adcCertBundleAspect';
import { createLambdaLayer } from '../../utils/layers';
import { MLSpaceConfig } from '../../utils/configTypes';
import { AwsCustomResource, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { generateAppConfig } from '../../utils/initialAppConfig';

export type CoreStackProps = {
    readonly lambdaSourcePath: string;
    readonly notificationDistro: string;
    readonly configBucketName: string;
    readonly dataBucketName: string;
    readonly cwlBucketName: string;
    readonly websiteBucketName: string;
    readonly accessLogsBucketName: string;
    readonly encryptionKey: IKey;
    readonly mlSpaceAppRole: IRole;
    readonly mlspaceKmsInstanceConditionsPolicy: IManagedPolicy;
    readonly mlSpaceNotebookRole: IRole;
    readonly mlspaceEndpointConfigInstanceConstraintPolicy?: IManagedPolicy,
    readonly mlspaceJobInstanceConstraintPolicy?: IManagedPolicy,
    readonly mlSpaceVPC: IVpc;
    readonly mlSpaceDefaultSecurityGroupId: string;
    readonly isIso?: boolean;
    readonly lambdaSecurityGroups: ISecurityGroup[];
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class CoreStack extends Stack {
    constructor (parent: App, name: string, props: CoreStackProps) {
        super(parent, name, {
            terminationProtection: false,
            ...props,
        });

        const logsServicePrincipal = new ServicePrincipal('logs.amazonaws.com');

        if (props.mlspaceConfig.NOTIFICATION_DISTRO) {
            new Subscription(this, 'Subscription', {
                topic: new Topic(this, 'mlspace-topic'),
                endpoint: props.notificationDistro,
                protocol: SubscriptionProtocol.EMAIL,
            });
        }

        let accessLogBucket = undefined;
        if (props.mlspaceConfig.ENABLE_ACCESS_LOGGING) {
            accessLogBucket = new Bucket(this, 'mlspace-access-logs-bucket', {
                bucketName: props.accessLogsBucketName,
                encryption: BucketEncryption.S3_MANAGED,
                publicReadAccess: false,
                versioned: true,
                enforceSSL: true,
                objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
            });
        }

        // Config Bucket (holds emr config/notebook parameters)
        const configBucket = new Bucket(this, 'mlspace-config-bucket', {
            bucketName: props.configBucketName,
            encryptionKey: props.encryptionKey,
            removalPolicy: RemovalPolicy.DESTROY,
            versioned: true,
            enforceSSL: true,
            serverAccessLogsBucket: accessLogBucket,
            serverAccessLogsPrefix: accessLogBucket ? 'mlspace-config-bucket' : undefined,
        });

        // Publish notebook config
        // This is a pretty ugly hack but at the moment you can't use json data with
        // cross stack parameters - https://github.com/aws/aws-cdk/issues/21503
        const mlspaceNotebookRole = new StringParameter(this, 'dynamic-config-notebook-role', {
            parameterName: 'notebook-param-notebook-role-arn',
            stringValue: props.mlSpaceNotebookRole.roleArn,
        });
        const secGroupId = new StringParameter(this, 'dynamic-config-security-group', {
            parameterName: 'notebook-param-vpc-security-group',
            stringValue: props.mlSpaceDefaultSecurityGroupId,
        });
        const subnetIds = new StringParameter(this, 'dynamic-config-subnets', {
            parameterName: 'notebook-param-subnet-ids',
            stringValue: props.mlSpaceVPC.isolatedSubnets
                .concat(props.mlSpaceVPC.privateSubnets)
                .map((s) => s.subnetId)
                .join(','),
        });

        const kmsKeyId = new StringParameter(this, 'dynamic-config-kms-id', {
            parameterName: 'notebook-param-kms-id',
            stringValue: props.encryptionKey.keyId,
        });
        const notebookParams = {
            pSMSKMSKeyId: kmsKeyId.stringValue,
            pSMSRoleARN: mlspaceNotebookRole.stringValue,
            pSMSSecurityGroupId: [secGroupId.stringValue],
            pSMSSubnetIds: subnetIds.stringValue,
            pSMSLifecycleConfigName: props.mlspaceConfig.MLSPACE_LIFECYCLE_CONFIG_NAME,
            pSMSDataBucketName: props.dataBucketName,
        };

        const configDeployment = new BucketDeployment(this, 'MLSpaceConfigDeployment', {
            sources: [
                Source.jsonData(props.mlspaceConfig.NOTEBOOK_PARAMETERS_FILE_NAME, notebookParams),
                Source.asset('./lib/resources/config'),
            ],
            destinationBucket: configBucket,
            prune: true,
            role: props.mlspaceConfig.BUCKET_DEPLOYMENT_ROLE_ARN
                ? Role.fromRoleArn(this, 'mlspace-config-deploy-role', props.mlspaceConfig.BUCKET_DEPLOYMENT_ROLE_ARN, {
                    mutable: false,
                })
                : undefined,
        });

        // Static Site
        const websiteBucket = new Bucket(this, 'mlspace-website-bucket', {
            bucketName: props.websiteBucketName,
            accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
            encryption: BucketEncryption.S3_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
            enforceSSL: true,
            websiteErrorDocument: 'index.html',
            websiteIndexDocument: 'index.html',
            cors: [
                {
                    allowedMethods: [
                        HttpMethods.GET,
                        HttpMethods.POST,
                        HttpMethods.PUT,
                        HttpMethods.DELETE,
                    ],
                    allowedOrigins: ['*'],
                    exposedHeaders: [
                        'x-amz-server-side-encryption',
                        'x-amz-request-id',
                        'x-amz-id-2',
                    ],
                    allowedHeaders: ['*'],
                },
            ],
            serverAccessLogsBucket: accessLogBucket,
            serverAccessLogsPrefix: accessLogBucket ? 'mlspace-website-bucket' : undefined,
        });
        websiteBucket.grantRead(new ServicePrincipal('apigateway.amazonaws.com'));

        // Data Bucket
        const dataBucket = new Bucket(this, 'mlspace-data-bucket', {
            bucketName: props.dataBucketName,
            encryptionKey: props.encryptionKey,
            removalPolicy: RemovalPolicy.DESTROY,
            versioned: true,
            enforceSSL: true,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.POST],
                    allowedHeaders: ['*'],
                    allowedOrigins: ['*'],
                    exposedHeaders: ['Access-Control-Allow-Origin'],
                },
            ],
            serverAccessLogsBucket: accessLogBucket,
            serverAccessLogsPrefix: accessLogBucket ? 'mlspace-data-bucket' : undefined,
        });

        const exampleDataDeployment = new BucketDeployment(this, 'MLSpaceExampleDataDeployment', {
            sources: [
                Source.jsonData(props.mlspaceConfig.NOTEBOOK_PARAMETERS_FILE_NAME, notebookParams),
                Source.asset('lib/resources/sagemaker/global/'),
            ],
            destinationKeyPrefix: 'global-read-only/resources/',
            destinationBucket: dataBucket,
            prune: false,
            role: props.mlspaceConfig.BUCKET_DEPLOYMENT_ROLE_ARN
                ? Role.fromRoleArn(
                    this,
                    'mlspace-example-data-deploy-role',
                    props.mlspaceConfig.BUCKET_DEPLOYMENT_ROLE_ARN,
                    {
                        mutable: false,
                    }
                )
                : undefined,
        });

        const commonLambdaLayer = createLambdaLayer(this, 'common');

        // Save common layer arn to SSM to avoid issue related to cross stack references
        new StringParameter(this, 'VersionArn', {
            parameterName: props.mlspaceConfig.COMMON_LAYER_ARN_PARAM,
            stringValue: commonLambdaLayer.layerVersion.layerVersionArn,
        });

        // Lambda for populating the initial allowed instances in the app config 
        const appConfigLambda = new Function(this, 'appConfigDeployment', {
            functionName: 'mls-lambda-app-config-deployment',
            description:
                'Populates the initial app config',
            runtime: props.mlspaceConfig.LAMBDA_RUNTIME,
            architecture: props.mlspaceConfig.LAMBDA_ARCHITECTURE,
            handler: 'ml_space_lambda.initial_app_config.lambda_function.lambda_handler',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.seconds(30),
            role: props.mlSpaceAppRole,
            environment: {
                APP_CONFIG_TABLE: props.mlspaceConfig.APP_CONFIGURATION_TABLE_NAME,
                SYSTEM_TAG: props.mlspaceConfig.SYSTEM_TAG,
                MANAGE_IAM_ROLES: props.mlspaceConfig.MANAGE_IAM_ROLES ? 'True' : '',
                ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN: props.mlspaceEndpointConfigInstanceConstraintPolicy?.managedPolicyArn || '',
                JOB_INSTANCE_CONSTRAINT_POLICY_ARN: props.mlspaceJobInstanceConstraintPolicy?.managedPolicyArn || '',
            },
            layers: [commonLambdaLayer.layerVersion],
            vpc: props.mlSpaceVPC,
            securityGroups: props.lambdaSecurityGroups,
        });

        const dynamicRolesAttachPoliciesOnDeployLambda = new Function(this, 'drAttachPoliciesOnDeployLambda', {
            functionName: 'mls-lambda-dr-attach-policies-on-deploy',
            description: 'Attaches policies from notebook role to all dynamic user roles.',
            runtime: props.mlspaceConfig.LAMBDA_RUNTIME,
            architecture: props.mlspaceConfig.LAMBDA_ARCHITECTURE,
            handler: 'ml_space_lambda.initial_app_config.lambda_function.update_dynamic_roles_with_notebook_policies',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.seconds(30),
            role: props.mlSpaceAppRole,
            environment: {
                ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN: props.mlspaceEndpointConfigInstanceConstraintPolicy?.managedPolicyArn || '',
                JOB_INSTANCE_CONSTRAINT_POLICY_ARN: props.mlspaceJobInstanceConstraintPolicy?.managedPolicyArn || '',
                KMS_INSTANCE_CONDITIONS_POLICY_ARN: props.mlspaceKmsInstanceConditionsPolicy.managedPolicyArn,
                SYSTEM_TAG: props.mlspaceConfig.SYSTEM_TAG,
                MANAGE_IAM_ROLES: props.mlspaceConfig.MANAGE_IAM_ROLES ? 'True' : '',
            },
            layers: [commonLambdaLayer.layerVersion],
            vpc: props.mlSpaceVPC,
            securityGroups: props.lambdaSecurityGroups,
        });

        // run dynamicRolesAttachPoliciesOnDeployLambda every deploy
        new AwsCustomResource(this, 'drAttachPoliciesOnDeploy', {
            onCreate: {
                service: 'Lambda',
                action: 'invoke',
                physicalResourceId: PhysicalResourceId.of(`drAttachPoliciesOnDeployLambda-${Date.now()}`),
                parameters: {
                    FunctionName: dynamicRolesAttachPoliciesOnDeployLambda.functionName,
                    Payload: '{}'
                }, 
            },
            role: props.mlSpaceAppRole
        });

        const updateInstanceKmsConditionsLambda = new Function(this, 'updateInstanceKmsConditionsLambda', {
            functionName: 'mls-lambda-instance-kms-conditions',
            description: '',
            runtime: props.mlspaceConfig.LAMBDA_RUNTIME,
            architecture: props.mlspaceConfig.LAMBDA_ARCHITECTURE,
            handler: 'ml_space_lambda.utils.lambda_functions.update_instance_kms_key_conditions',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.seconds(30),
            role: props.mlSpaceAppRole,
            environment: {
                MANAGE_IAM_ROLES: props.mlspaceConfig.MANAGE_IAM_ROLES ? 'True' : '',
                KMS_INSTANCE_CONDITIONS_POLICY_ARN: props.mlspaceKmsInstanceConditionsPolicy.managedPolicyArn
            },
            layers: [commonLambdaLayer.layerVersion],
            vpc: props.mlSpaceVPC,
            securityGroups: props.lambdaSecurityGroups,
        });

        // run updateInstanceKmsConditionsLambda every deploy
        new AwsCustomResource(this, 'kms-key-constraints', {
            onCreate: {
                service: 'Lambda',
                action: 'invoke',
                physicalResourceId: PhysicalResourceId.of(`kmsKeyConstraints-${Date.now()}`),
                parameters: {
                    FunctionName: updateInstanceKmsConditionsLambda.functionName,
                    Payload: '{}'
                }, 
            },
            role: props.mlSpaceAppRole
        });

        // schedule updateInstanceKmsConditionsLambda to run every day
        const updateInstanceKmsConditionsLambdaScheduleRule = new Rule(this, 'updateInstanceKmsConditionsLambdaScheduleRule', {
            schedule: Schedule.cron({hour: '2', minute: '45'})
        });
        updateInstanceKmsConditionsLambdaScheduleRule.addTarget(new LambdaFunction(updateInstanceKmsConditionsLambda));

        const notifierLambdaLayer = createLambdaLayer(this, 'common', 'notifier');

        const s3NotificationLambda = new Function(this, 's3Notifier', {
            functionName: 'mls-lambda-s3-notifier',
            description:
                'S3 event notification function to handle ddb actions in response to dataset file actions',
            runtime: props.mlspaceConfig.LAMBDA_RUNTIME,
            architecture: props.mlspaceConfig.LAMBDA_ARCHITECTURE,
            handler: 'ml_space_lambda.s3_event_put_notification.lambda_function.lambda_handler',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.seconds(5),
            role: props.mlSpaceAppRole,
            environment: {
                DATA_BUCKET: props.dataBucketName,
                DATASETS_TABLE: props.mlspaceConfig.DATASETS_TABLE_NAME,
                PROJECTS_TABLE: props.mlspaceConfig.PROJECTS_TABLE_NAME,
                PROJECT_USERS_TABLE: props.mlspaceConfig.PROJECT_USERS_TABLE_NAME,
                USERS_TABLE: props.mlspaceConfig.USERS_TABLE_NAME,
                ...props.mlspaceConfig.ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
            },
            layers: [notifierLambdaLayer.layerVersion],
            vpc: props.mlSpaceVPC,
            securityGroups: props.lambdaSecurityGroups,
        });

        s3NotificationLambda.addPermission('s3Notifier-invoke', {
            action: 'lambda:InvokeFunction',
            principal: new ServicePrincipal('s3.amazonaws.com'),
            sourceAccount: this.account,
            sourceArn: dataBucket.bucketArn,
        });

        dataBucket.addEventNotification(
            EventType.OBJECT_CREATED,
            new LambdaDestination(s3NotificationLambda)
        );

        const terminateResourcesLambda = new Function(this, 'resourceTerminator', {
            functionName: 'mls-lambda-resource-terminator',
            description:
                'Sweeper function that stops/terminates resources based on scheduled configuration',
            runtime: props.mlspaceConfig.LAMBDA_RUNTIME,
            architecture: props.mlspaceConfig.LAMBDA_ARCHITECTURE,
            handler: 'ml_space_lambda.resource_scheduler.lambda_functions.terminate_resources',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.minutes(15),
            role: props.mlSpaceAppRole,
            environment: {
                RESOURCE_SCHEDULE_TABLE: props.mlspaceConfig.RESOURCE_SCHEDULE_TABLE_NAME,
                ...props.mlspaceConfig.ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
            },
            layers: [commonLambdaLayer.layerVersion],
            vpc: props.mlSpaceVPC,
            securityGroups: props.lambdaSecurityGroups,
        });

        const ruleName = 'mlspace-rule-terminate-resources';
        new Rule(this, ruleName, {
            schedule: Schedule.rate(Duration.minutes(props.mlspaceConfig.RESOURCE_TERMINATION_INTERVAL)),
            targets: [new LambdaFunction(terminateResourcesLambda)],
            ruleName: ruleName,
        });

        // Logs Bucket
        const cwlBucket = new Bucket(this, 'mlspace-logs-bucket', {
            bucketName: props.cwlBucketName,
            removalPolicy: RemovalPolicy.DESTROY,
            encryptionKey: props.encryptionKey,
            enforceSSL: true,
            cors: [
                {
                    allowedMethods: [HttpMethods.POST],
                    allowedHeaders: ['*'],
                    allowedOrigins: ['*'],
                },
            ],
            serverAccessLogsBucket: accessLogBucket,
            serverAccessLogsPrefix: accessLogBucket ? 'mlspace-logs-bucket' : undefined,
        });
        cwlBucket.addToResourcePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetBucketAcl'],
                resources: [cwlBucket.bucketArn],
                principals: [logsServicePrincipal],
            })
        );
        cwlBucket.addToResourcePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:PutObject'],
                resources: [`${cwlBucket.bucketArn}/cloudwatch/*`],
                principals: [logsServicePrincipal],
                conditions: {
                    StringEquals: {
                        's3:x-amz-acl': 'bucket-owner-full-control',
                    },
                },
            })
        );

        // Cloudtrail setup
        if (props.mlspaceConfig.CREATE_MLSPACE_CLOUDTRAIL_TRAIL) {
            new Trail(this, 'mlspace-cloudtrail', {
                trailName: 'mlspace-cloudtrail',
                isMultiRegionTrail: true,
                includeGlobalServiceEvents: true,
                bucket: cwlBucket,
            });
        }

        // Datasets Table
        const datasetScopeAttribute = { name: 'scope', type: AttributeType.STRING };
        const datasetNameAttribute = { name: 'name', type: AttributeType.STRING };
        new Table(this, 'mlspace-ddb-datasets', {
            tableName: props.mlspaceConfig.DATASETS_TABLE_NAME,
            partitionKey: datasetScopeAttribute,
            sortKey: datasetNameAttribute,
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Projects Table
        new Table(this, 'mlspace-ddb-projects', {
            tableName: props.mlspaceConfig.PROJECTS_TABLE_NAME,
            partitionKey: { name: 'name', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Project Users Table
        const projectAttribute = { name: 'project', type: AttributeType.STRING };
        const userAttribute = { name: 'user', type: AttributeType.STRING };
        const projectUsersTable = new Table(this, 'mlspace-ddb-project-users', {
            tableName: props.mlspaceConfig.PROJECT_USERS_TABLE_NAME,
            partitionKey: projectAttribute,
            sortKey: userAttribute,
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        projectUsersTable.addGlobalSecondaryIndex({
            indexName: 'ReverseLookup',
            partitionKey: userAttribute,
            sortKey: projectAttribute,
            projectionType: ProjectionType.KEYS_ONLY,
        });

        // Groups Table
        new Table(this, 'mlspace-ddb-groups', {
            tableName: props.mlspaceConfig.GROUPS_TABLE_NAME,
            partitionKey: { name: 'name', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Group Users Table
        const groupAttribute = { name: 'group', type: AttributeType.STRING };
        const groupUserAttribute = { name: 'user', type: AttributeType.STRING };
        const groupUsersTable = new Table(this, 'mlspace-ddb-group-users', {
            tableName: props.mlspaceConfig.GROUP_USERS_TABLE_NAME,
            partitionKey: groupAttribute,
            sortKey: groupUserAttribute,
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        groupUsersTable.addGlobalSecondaryIndex({
            indexName: 'ReverseLookup',
            partitionKey: groupUserAttribute,
            sortKey: groupAttribute,
            projectionType: ProjectionType.KEYS_ONLY,
        });

        // Users Table
        new Table(this, 'mlspace-ddb-users', {
            tableName: props.mlspaceConfig.USERS_TABLE_NAME,
            partitionKey: { name: 'username', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Resource Termination Schedule Table
        const resourceIdAttribute = { name: 'resourceId', type: AttributeType.STRING };
        const resourceTypeAttribute = { name: 'resourceType', type: AttributeType.STRING };
        new Table(this, 'mlspace-ddb-resource-schedule', {
            tableName: props.mlspaceConfig.RESOURCE_SCHEDULE_TABLE_NAME,
            partitionKey: resourceIdAttribute,
            sortKey: resourceTypeAttribute,
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Resources Metadata Table
        const resourcesMetadataTable = new Table(this, 'mlspace-resource-metadata', {
            tableName: props.mlspaceConfig.RESOURCE_METADATA_TABLE_NAME,
            partitionKey: resourceTypeAttribute,
            sortKey: resourceIdAttribute,
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        resourcesMetadataTable.addLocalSecondaryIndex({
            indexName: 'ProjectResources',
            sortKey: projectAttribute,
            projectionType: ProjectionType.ALL,
        });

        resourcesMetadataTable.addLocalSecondaryIndex({
            indexName: 'UserResources',
            sortKey: userAttribute,
            projectionType: ProjectionType.ALL,
        });

        // App Configuration Table
        new Table(this, 'mlspace-ddb-app-configuration', {
            tableName: props.mlspaceConfig.APP_CONFIGURATION_TABLE_NAME,
            partitionKey: { name: 'configScope', type: AttributeType.STRING },
            sortKey: { name: 'versionId', type: AttributeType.NUMBER },
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Populate the App Config table with default config
        new AwsCustomResource(this, 'mlspace-init-ddb-app-config', {
            onCreate: {
                service: 'DynamoDB',
                action: 'putItem',
                parameters: {
                    TableName: props.mlspaceConfig.APP_CONFIGURATION_TABLE_NAME,
                    Item: generateAppConfig(props.mlspaceConfig),
                },
                physicalResourceId: PhysicalResourceId.of('initAppConfigData'),
            },
            role: props.mlSpaceAppRole
        });

        new AwsCustomResource(this, 'initial-app-config-deployment-001', {
            onCreate: {
                service: 'Lambda',
                action: 'invoke',
                physicalResourceId: PhysicalResourceId.of('initAllowedInstanceTypes'),
                parameters: {
                    FunctionName: appConfigLambda.functionName,
                    Payload: '{}'
                }, 
            },
            role: props.mlSpaceAppRole
        });

        // EMR Security Configuration
        new CfnSecurityConfiguration(this, 'mlspace-emr-security-config', {
            name: props.mlspaceConfig.EMR_SECURITY_CONFIG_NAME,
            securityConfiguration: {
                InstanceMetadataServiceConfiguration: {
                    MinimumInstanceMetadataServiceVersion: 2,
                    HttpPutResponseHopLimit: 1,
                },
            },
        });

        const resourceMetadataLambda = new Function(this, 'mlspace-resource-metadata-lambda', {
            functionName: 'mls-lambda-resource-metadata',
            description:
                'Lambda to process event bridge notifications and update corresponding entries in the mlspace resource metadata ddb table.',
            runtime: props.mlspaceConfig.LAMBDA_RUNTIME,
            architecture: props.mlspaceConfig.LAMBDA_ARCHITECTURE,
            handler: 'ml_space_lambda.resource_metadata.lambda_functions.process_event',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.seconds(90),
            role: props.mlSpaceAppRole,
            environment: {
                RESOURCE_METADATA_TABLE: props.mlspaceConfig.RESOURCE_METADATA_TABLE_NAME,
                SYSTEM_TAG: props.mlspaceConfig.SYSTEM_TAG,
                ...props.mlspaceConfig.ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
            },
            layers: [commonLambdaLayer.layerVersion],
            vpc: props.mlSpaceVPC,
            securityGroups: props.lambdaSecurityGroups,
        });

        // Event bridge rule for resource metadata capture
        new Rule(this, 'mlspace-resource-metadata-rule', {
            ruleName: 'mlspace-resource-metadata-sync',
            eventPattern: {
                account: [this.account],
                source: ['aws.sagemaker', 'aws.translate', 'aws.emr'],
                detailType: [
                    'SageMaker Endpoint State Change',
                    'SageMaker Endpoint Config State Change',
                    'SageMaker Ground Truth Labeling Job State Change',
                    'SageMaker HyperParameter Tuning Job State Change',
                    'SageMaker Notebook Instance State Change',
                    'SageMaker Model State Change',
                    'SageMaker Training Job State Change',
                    'SageMaker Transform Job State Change',
                    'Translate TextTranslationJob State Change',
                    'EMR Cluster State Change',

                ],
            },
            targets: [new LambdaFunction(resourceMetadataLambda)],
        });

        new Rule(this, 'mlspace-cloudtrail-metadata-rule', {
            ruleName: 'mlspace-cloudtrail-metadata-sync',
            eventPattern: {
                account: [this.account],
                source: ['aws.sagemaker', 'aws.translate', 'aws.emr'],
                detailType: ['AWS API Call via CloudTrail'],
                detail: {
                    eventSource: ['sagemaker.amazonaws.com', 'translate.amazonaws.com'],
                    eventName: [
                        'CreateLabelingJob',
                        'StartTextTranslationJob',
                        'StopTextTranslationJob',
                        'RunJobFlow',
                    ],
                },
            },
            targets: [new LambdaFunction(resourceMetadataLambda)],
        });

        if (props.isIso) {
            const adcCABundleAspect = new ADCLambdaCABundleAspect();
            Aspects.of(configDeployment).add(adcCABundleAspect);
            Aspects.of(exampleDataDeployment).add(adcCABundleAspect);
            Aspects.of(resourceMetadataLambda).add(adcCABundleAspect);
            Aspects.of(s3NotificationLambda).add(adcCABundleAspect);
            Aspects.of(terminateResourcesLambda).add(adcCABundleAspect);
        }
    }
}
