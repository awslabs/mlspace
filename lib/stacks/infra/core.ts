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
import { Effect, IRole, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
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
import {
    ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
    BUCKET_DEPLOYMENT_ROLE_ARN,
    COMMON_LAYER_ARN_PARAM,
    CREATE_MLSPACE_CLOUDTRAIL_TRAIL,
    DATASETS_TABLE_NAME,
    EMR_SECURITY_CONFIG_NAME,
    ENABLE_ACCESS_LOGGING,
    MLSPACE_LIFECYCLE_CONFIG_NAME,
    NOTEBOOK_PARAMETERS_FILE_NAME,
    NOTIFICATION_DISTRO,
    PROJECTS_TABLE_NAME,
    PROJECT_USERS_TABLE_NAME,
    RESOURCE_METADATA_TABLE_NAME,
    RESOURCE_SCHEDULE_TABLE_NAME,
    RESOURCE_TERMINATION_INTERVAL,
    SYSTEM_TAG,
    USERS_TABLE_NAME,
} from '../../constants';
import { ADCLambdaCABundleAspect } from '../../utils/adcCertBundleAspect';
import { createLambdaLayer } from '../../utils/layers';

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
    readonly mlSpaceNotebookRole: IRole;
    readonly mlSpaceVPC: IVpc;
    readonly mlSpaceDefaultSecurityGroupId: string;
    readonly isIso?: boolean;
    readonly lambdaSecurityGroups: ISecurityGroup[];
} & StackProps;

export class CoreStack extends Stack {
    constructor (parent: App, name: string, props: CoreStackProps) {
        super(parent, name, {
            terminationProtection: false,
            ...props,
        });

        const logsServicePrincipal = new ServicePrincipal('logs.amazonaws.com');

        if (NOTIFICATION_DISTRO) {
            new Subscription(this, 'Subscription', {
                topic: new Topic(this, 'mlspace-topic'),
                endpoint: props.notificationDistro,
                protocol: SubscriptionProtocol.EMAIL,
            });
        }

        let accessLogBucket = undefined;
        if (ENABLE_ACCESS_LOGGING) {
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
            pSMSLifecycleConfigName: MLSPACE_LIFECYCLE_CONFIG_NAME,
            pSMSDataBucketName: props.dataBucketName,
        };

        const configDeployment = new BucketDeployment(this, 'MLSpaceConfigDeployment', {
            sources: [
                Source.jsonData(NOTEBOOK_PARAMETERS_FILE_NAME, notebookParams),
                Source.asset('./lib/resources/config'),
            ],
            destinationBucket: configBucket,
            prune: true,
            role: BUCKET_DEPLOYMENT_ROLE_ARN
                ? Role.fromRoleArn(this, 'mlspace-config-deploy-role', BUCKET_DEPLOYMENT_ROLE_ARN, {
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
                Source.jsonData(NOTEBOOK_PARAMETERS_FILE_NAME, notebookParams),
                Source.asset('lib/resources/sagemaker/global/'),
            ],
            destinationKeyPrefix: 'global-read-only/resources/',
            destinationBucket: dataBucket,
            prune: false,
            role: BUCKET_DEPLOYMENT_ROLE_ARN
                ? Role.fromRoleArn(
                    this,
                    'mlspace-example-data-deploy-role',
                    BUCKET_DEPLOYMENT_ROLE_ARN,
                    {
                        mutable: false,
                    }
                )
                : undefined,
        });

        const notifierLambdaLayer = createLambdaLayer(this, 'common', 'notifier');

        const s3NotificationLambda = new Function(this, 's3Notifier', {
            functionName: 'mls-lambda-s3-notifier',
            description:
                'S3 event notification function to handle ddb actions in response to dataset file actions',
            runtime: Runtime.PYTHON_3_11,
            handler: 'ml_space_lambda.s3_event_put_notification.lambda_function.lambda_handler',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.seconds(5),
            role: props.mlSpaceAppRole,
            environment: {
                DATA_BUCKET: props.dataBucketName,
                DATASETS_TABLE: DATASETS_TABLE_NAME,
                PROJECTS_TABLE: PROJECTS_TABLE_NAME,
                PROJECT_USERS_TABLE: PROJECT_USERS_TABLE_NAME,
                USERS_TABLE: USERS_TABLE_NAME,
                ...ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
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

        const commonLambdaLayer = createLambdaLayer(this, 'common');

        // Save common layer arn to SSM to avoid issue related to cross stack references
        new StringParameter(this, 'VersionArn', {
            parameterName: COMMON_LAYER_ARN_PARAM,
            stringValue: commonLambdaLayer.layerVersion.layerVersionArn,
        });

        const terminateResourcesLambda = new Function(this, 'resourceTerminator', {
            functionName: 'mls-lambda-resource-terminator',
            description:
                'Sweeper function that stops/terminates resources based on scheduled configuration',
            runtime: Runtime.PYTHON_3_11,
            handler: 'ml_space_lambda.resource_scheduler.lambda_functions.terminate_resources',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.minutes(15),
            role: props.mlSpaceAppRole,
            environment: {
                RESOURCE_SCHEDULE_TABLE: RESOURCE_SCHEDULE_TABLE_NAME,
                ...ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
            },
            layers: [commonLambdaLayer.layerVersion],
            vpc: props.mlSpaceVPC,
            securityGroups: props.lambdaSecurityGroups,
        });

        const ruleName = 'mlspace-rule-terminate-resources';
        new Rule(this, ruleName, {
            schedule: Schedule.rate(Duration.minutes(RESOURCE_TERMINATION_INTERVAL)),
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
        if (CREATE_MLSPACE_CLOUDTRAIL_TRAIL) {
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
            tableName: DATASETS_TABLE_NAME,
            partitionKey: datasetScopeAttribute,
            sortKey: datasetNameAttribute,
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Projects Table
        new Table(this, 'mlspace-ddb-projects', {
            tableName: PROJECTS_TABLE_NAME,
            partitionKey: { name: 'name', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Project Users Table
        const projectAttribute = { name: 'project', type: AttributeType.STRING };
        const userAttribute = { name: 'user', type: AttributeType.STRING };
        const projectUsersTable = new Table(this, 'mlspace-ddb-project-users', {
            tableName: PROJECT_USERS_TABLE_NAME,
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

        // Users Table
        new Table(this, 'mlspace-ddb-users', {
            tableName: USERS_TABLE_NAME,
            partitionKey: { name: 'username', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Resource Termination Schedule Table
        const resourceIdAttribute = { name: 'resourceId', type: AttributeType.STRING };
        const resourceTypeAttribute = { name: 'resourceType', type: AttributeType.STRING };
        new Table(this, 'mlspace-ddb-resource-schedule', {
            tableName: RESOURCE_SCHEDULE_TABLE_NAME,
            partitionKey: resourceIdAttribute,
            sortKey: resourceTypeAttribute,
            billingMode: BillingMode.PAY_PER_REQUEST,
            encryption: TableEncryption.AWS_MANAGED,
        });

        // Resources Metadata Table
        const resourcesMetadataTable = new Table(this, 'mlspace-resource-metadata', {
            tableName: RESOURCE_METADATA_TABLE_NAME,
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

        // EMR Security Configuration
        new CfnSecurityConfiguration(this, 'mlspace-emr-security-config', {
            name: EMR_SECURITY_CONFIG_NAME,
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
            runtime: Runtime.PYTHON_3_11,
            handler: 'ml_space_lambda.resource_metadata.lambda_functions.process_event',
            code: Code.fromAsset(props.lambdaSourcePath),
            timeout: Duration.seconds(90),
            role: props.mlSpaceAppRole,
            environment: {
                RESOURCE_METADATA_TABLE: RESOURCE_METADATA_TABLE_NAME,
                SYSTEM_TAG: SYSTEM_TAG,
                ...ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
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
                    'EMR Cluster State Change', // TODO make sure this is the only one we need

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
                        'RunJobFlow', // TODO confirm this is correct
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
