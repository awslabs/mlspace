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

import { App, Aws, Stack, StackProps } from 'aws-cdk-lib';
import { CfnAccount } from 'aws-cdk-lib/aws-apigateway';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import {
    CfnInstanceProfile,
    CompositePrincipal,
    Effect,
    IManagedPolicy,
    IRole,
    ManagedPolicy,
    PolicyStatement,
    Role,
    ServicePrincipal
} from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { MLSpaceConfig } from '../utils/configTypes';

export type IAMStackProp = {
    readonly dataBucketName: string;
    readonly configBucketName: string;
    readonly websiteBucketName: string;
    readonly encryptionKey: IKey;
    readonly mlSpaceVPC: IVpc;
    readonly mlSpaceDefaultSecurityGroupId: string;
    readonly enableTranslate: boolean;
    readonly isIso?: boolean;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class IAMStack extends Stack {
    public mlSpaceAppRole: IRole;
    public mlSpaceNotebookRole: IRole;
    public s3ReaderRole: IRole;
    public mlSpacePermissionsBoundary?: IManagedPolicy;
    public emrServiceRoleName: string;
    public emrEC2RoleName: string;
    public mlspaceEndpointConfigInstanceConstraintPolicy?: IManagedPolicy;
    public mlspaceJobInstanceConstraintPolicy?: IManagedPolicy;
    public mlSpaceSystemRole: IRole;
    public mlspaceKmsInstanceConditionsPolicy: IManagedPolicy;

    constructor (parent: App, name: string, props: IAMStackProp) {
        super(parent, name, {
            terminationProtection: false,
            ...props,
        });

        /**
         * Comprehend Permissions
         * Translate Permissions
         */
        const mlActions = ['comprehend:Detect*', 'comprehend:BatchDetect*'];
        if (props.enableTranslate) {
            // Translate Permissions
            mlActions.push('translate:TranslateText');
        }
        // Required tags that force the request to be specific to an MLSpace managed resource
        const requestTagsConditions = {
            'aws:RequestTag/project': 'false',
            // this is excluded because it is covered by requestSystemTagEqualsConditions below
            // 'aws:RequestTag/system': 'false',
            'aws:RequestTag/user': 'false',
        };

        const enum SystemTagCondition {
            Equals,
            NotEquals
        }

        const requestSystemTagEqualsConditions = {
            [SystemTagCondition.Equals]: {
                'StringEqualsIgnoreCase': {
                    'aws:RequestTag/system': props.mlspaceConfig.SYSTEM_TAG,
                }
            },
            [SystemTagCondition.NotEquals]: {
                'StringNotEqualsIgnoreCase': {
                    'aws:RequestTag/system': props.mlspaceConfig.SYSTEM_TAG,
                }
            }
        };
        // Required tags that ensure a created or accessed resource are properly managed by MLSpace
        const resourceTagsConditions = {
            'aws:ResourceTag/project': 'false',
            'aws:ResourceTag/system': 'false',
            'aws:ResourceTag/user': 'false',
        };

        const resourceSystemTagEqualsConditions = {
            [SystemTagCondition.Equals]: {
                'StringEqualsIgnoreCase': {
                    'aws:ResourceTag/system': props.mlspaceConfig.SYSTEM_TAG,
                }
            },
            [SystemTagCondition.NotEquals]: {
                'StringNotEqualsIgnoreCase': {
                    'aws:ResourceTag/system': props.mlspaceConfig.SYSTEM_TAG,
                }
            }
        };

        const ec2ArnBase = `arn:${this.partition}:ec2:${Aws.REGION}:${this.account}`;
        const privateSubnetArnList = props.mlSpaceVPC.privateSubnets.map(
            (s) => `${ec2ArnBase}:subnet/${s.subnetId}`
        );

        // Role names
        const mlspaceSystemRoleName = 'mlspace-system-role';
        const mlSpaceNotebookRoleName = 'mlspace-notebook-role';


        if (props.mlspaceConfig.KMS_INSTANCE_CONDITIONS_POLICY_ARN) {
            this.mlspaceKmsInstanceConditionsPolicy = ManagedPolicy.fromManagedPolicyArn(this, 'mlspace-kms-instance-constraint-policy', props.mlspaceConfig.KMS_INSTANCE_CONDITIONS_POLICY_ARN);
        } else {
            this.mlspaceKmsInstanceConditionsPolicy = new ManagedPolicy(this, 'mlspace-kms-instance-constraint-policy', {
                managedPolicyName: `${props.mlspaceConfig.IAM_RESOURCE_PREFIX}-kms-instance-constraint-policy`,
                statements:  [
                    new PolicyStatement({
                        effect: Effect.DENY,
                        actions: [
                            'sagemaker:CreateEndpointConfig',
                            'sagemaker:CreateHyperParameterTuningJob',
                            'sagemaker:CreateNotebookInstance',
                            'sagemaker:CreateTrainingJob',
                            'sagemaker:CreateTransformJob'
                        ],
                        resources: ['*'],
                        conditions: {
                            'Null': {
                                'sagemaker:VolumeKmsKey': 'true'
                            },
                        },
                    }),
                ]
            });
        }

        const invertedBooleanConditions = (conditions: {[key: string]: string}) => Object.fromEntries(Object.entries(conditions).map(([key, value]) => {
            return [key, value === 'true' ? 'false' : 'true'];
        }));

        /**
         * NOTEBOOK POLICY & ROLE SECTION
         * Notebook policy - base permissions used when in a notebook and also applied to general use of the application
         * Notebook role - the role and permissions used when users are accessing a notebook
         */
        const notebookPolicyStatements = (partition: string, region: string, allow_all_instances: boolean = false) => {
            const statements = [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['kms:CreateGrant'],
                    resources: [props.encryptionKey.keyArn],
                    conditions: {
                        Bool: {
                            'kms:GrantIsForAWSResource': 'true',
                        },
                    },
                }),
                /**
                 * HPO Permissions 
                 * Training Permissions
                 * Transform Permissions
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        // EC2 permissions required to create hpo/training/transform jobs in a private VPC
                        'ec2:CreateNetworkInterface',
                        'ec2:CreateNetworkInterfacePermission',
                        'ec2:DeleteNetworkInterface',
                        'ec2:DeleteNetworkInterfacePermission',
                        // KMS permissions are required to encrypt job output and decrypt job input
                        'kms:Decrypt',
                        'kms:DescribeKey',
                        'kms:Encrypt',
                        'kms:GenerateDataKey',
                    ],
                    resources: [
                        // EC2 actions resource identifiers
                        ...privateSubnetArnList,
                        `${ec2ArnBase}:security-group/${props.mlSpaceDefaultSecurityGroupId}`,
                        `${ec2ArnBase}:network-interface/*`,
                        // KMS action resource identifier
                        props.encryptionKey.keyArn,
                    ],
                }),
                // General Permissions - Allows tagging of SageMaker resources created within a notebook
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['sagemaker:AddTags'],
                    resources: [`arn:${partition}:sagemaker:${region}:${this.account}:*`],
                }),
                // General Permissions - Read Only + Metric Write permissions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        // EC2 describe actions that are not bound by resource identifier.
                        'ec2:DescribeNetworkInterfaces',
                        'ec2:DescribeDhcpOptions',
                        'ec2:DescribeSubnets',
                        'ec2:DescribeSecurityGroups',
                        'ec2:DescribeVpcs',
                        // SageMaker list actions that are not bound by resource identifier.
                        'sagemaker:DescribeWorkteam',
                        'sagemaker:ListEndpointConfigs',
                        'sagemaker:ListEndpoints',
                        'sagemaker:ListLabelingJobs',
                        'sagemaker:ListModels',
                        'sagemaker:ListTags',
                        'sagemaker:ListTrainingJobs',
                        'sagemaker:ListTransformJobs',
                        'sagemaker:ListHyperParameterTuningJobs',
                        'sagemaker:ListTrainingJobsForHyperParameterTuningJob',
                        'sagemaker:ListWorkteams',
                        /*
                        * Permissions not bound to specific resources. Log groups and metrics are created as
                        * part of various SageMaker resources that can be launched by users (training jobs,
                        * endpoints, etc). The iam:GetRole permission is used to allow users to get the current
                        * role the notebook is executing under so that they can use that role to create
                        * SageMaker resources.
                        */
                        'iam:GetRole',
                        'cloudwatch:PutMetricData',
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:DescribeLogStreams',
                        'logs:PutLogEvents',
                    ],
                    resources: ['*'],
                }),
                // Endpoint and LabelingJob Permissions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['sagemaker:CreateEndpoint', 'sagemaker:CreateLabelingJob'],
                    resources: [`arn:${partition}:sagemaker:${region}:${this.account}:*`],
                    conditions: {
                        Null: requestTagsConditions,
                        ...requestSystemTagEqualsConditions[SystemTagCondition.Equals]
                    },
                }),
                /**
                 * Endpoint Permissions
                 * This statement/action must be separate from the above statement.
                 * If request tag conditions are applied to this action + resource combination then it will fail.
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['sagemaker:CreateEndpoint'],
                    resources: [
                        `arn:${partition}:sagemaker:${region}:${this.account}:endpoint-config/*`,
                    ],
                }),
                // Model Permissions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['sagemaker:CreateModel'],
                    resources: [`arn:${partition}:sagemaker:${region}:${this.account}:model/*`],
                    conditions: {
                        Null: {
                            'sagemaker:VpcSecurityGroupIds': 'false',
                            'sagemaker:VpcSubnets': 'false',
                            ...requestTagsConditions,
                        },
                        ...requestSystemTagEqualsConditions[SystemTagCondition.Equals]
                    },
                }),
                /**
                 * Various Permissions
                 * 
                 * SageMaker permissions to allow users to monitor the status of resources they've
                 * created. These statements will be supplemented with user/project specific policies
                 * to ensure users can only describe/interact with resources that have been tagged
                 * with their username and/or project name.
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        // Training Permissions
                        'sagemaker:DescribeTrainingJob',
                        'sagemaker:StopTrainingJob',
                        // Transform Permissions
                        'sagemaker:DescribeTransformJob',
                        'sagemaker:StopTransformJob',
                        // Model Permissions
                        'sagemaker:DescribeModel',
                        'sagemaker:DeleteModel',
                        // HPO Permissions
                        'sagemaker:DescribeHyperParameterTuningJob',
                        'sagemaker:StopHyperParameterTuningJob',
                        // Endpoint Permissions
                        'sagemaker:DescribeEndpoint',
                        'sagemaker:DeleteEndpoint',
                        'sagemaker:InvokeEndpoint',
                        'sagemaker:UpdateEndpoint',
                        'sagemaker:UpdateEndpointWeightsAndCapacities',
                        // Endpoint Config Permissions
                        'sagemaker:DescribeEndpointConfig',
                        'sagemaker:DeleteEndpointConfig',
                        // Labeling Permissions
                        'sagemaker:DescribeLabelingJob',
                        'sagemaker:StopLabelingJob',
                    ],
                    resources: [`arn:${partition}:sagemaker:${region}:${this.account}:*`],
                    conditions: {
                        Null: resourceTagsConditions,
                        ...resourceSystemTagEqualsConditions[SystemTagCondition.Equals]
                    },
                }),
                /**
                 * Comprehend Permissions
                 * Translate Permissions
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: mlActions,
                    // Translate doesn't assign arns/doesn't support restricting resources for the actions we require
                    resources: ['*'],
                }),
                /**
                 * General permissions
                 * Allow read access to MLSpace config and examples bucket as well as SageMaker public
                 * examples bucket
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['s3:GetObject', 's3:ListBucket'],
                    resources: [
                        `arn:${partition}:s3:::${props.configBucketName}`,
                        `arn:${partition}:s3:::${props.configBucketName}/*`,
                        `arn:${partition}:s3:::sagemaker-sample-files`,
                        `arn:${partition}:s3:::sagemaker-sample-files/*`,
                        `arn:${partition}:s3:::${props.dataBucketName}/global-read-only/*`,
                    ],
                }),
                /**
                 * Allow listing the contents of the MLSpace example data bucket.
                 * List bucket may not be needed if onCreate script is changed to use 's3 cp' instead of 's3 sync'
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['s3:ListBucket'],
                    resources: [`arn:${partition}:s3:::${props.dataBucketName}`],
                    conditions: {
                        StringLike: {
                            's3:prefix': 'global-read-only/*',
                        },
                    },
                }),
                /**
                 * Bedrock Permissions
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        // mutating
                        'bedrock:Associate*',
                        'bedrock:Create*',
                        'bedrock:BatchDelete*',
                        'bedrock:Delete*',
                        'bedrock:Put*',
                        'bedrock:Retrieve*',
                        'bedrock:Start*',
                        'bedrock:Update*',
                        
                        // non-mutating
                        'bedrock:Apply*',
                        'bedrock:Detect*',
                        'bedrock:List*',
                        'bedrock:Get*',
                        'bedrock:Invoke*',
                        'bedrock:Retrieve*',
                    ],
                    resources: [`arn:${partition}:sagemaker:${region}:${this.account}:*`],
                    conditions: {
                        Null: {
                            ...requestTagsConditions,
                            ...resourceTagsConditions,
                        },
                        ...requestSystemTagEqualsConditions[SystemTagCondition.Equals]
                    },
                }),
            ];
            
            if (props.enableTranslate) {
                // Translate Permissions
                statements.push(new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'translate:StopTextTranslationJob',
                        'translate:List*',
                        'translate:StartTextTranslationJob',
                        'translate:DescribeTextTranslationJob',
                        'translate:TranslateDocument',
                        'translate:TranslateText',
                    ],
                    resources: ['*'],
                }));
                // Translate Permissions - Allows for passing the role to translate
                statements.push(new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['iam:PassRole'],
                    resources: [
                        `arn:${partition}:iam::${this.account}:role/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}*`,
                    ],
                    conditions: {
                        StringEquals: {
                            'iam:PassedToService': 'translate.amazonaws.com',
                        },
                    },
                }));
            }
            /**
             * General permissions
             * If the default notebook policy is the only policy that will be attached
             * to a notebook then we need to give blanket dataset access. If we're managing
             * IAM roles then the user/project policies that get attached to the dynamically created
             * notebook role will lock things down to global, project, and user levels.
             */
            if (!props.mlspaceConfig.MANAGE_IAM_ROLES) {
                statements.push(
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['s3:*'],
                        resources: [`arn:${partition}:s3:::${props.dataBucketName}/*`],
                    })
                );
            }

            /**
             * Using the new instance restrain policies requires different permissions based on DynamicRoles permissions
             * 
             * Additionally the permissions boundary needs statements that have ALLOW permissions
             */
            if (!props.mlspaceConfig.MANAGE_IAM_ROLES || allow_all_instances) {
                statements.push(
                    // Endpoint Configuration and TransformJob Permissions
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['sagemaker:CreateEndpointConfig', 'sagemaker:CreateTransformJob'],
                        resources: [
                            `arn:${partition}:sagemaker:${region}:${this.account}:*`,
                        ],
                        conditions: {
                            Null: {
                                ...requestTagsConditions,
                            },
                            ...requestSystemTagEqualsConditions[SystemTagCondition.Equals]
                        },
                    }));
                statements.push(
                    // HPO Permissions
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: [
                            'sagemaker:CreateHyperParameterTuningJob',
                            'sagemaker:CreateTrainingJob',
                        ],
                        resources: [
                            `arn:${partition}:sagemaker:${region}:${this.account}:training-job/*`,
                            `arn:${partition}:sagemaker:${region}:${this.account}:hyper-parameter-tuning-job/*`
                        ],
                        conditions: {
                            Null: {
                                'sagemaker:VpcSecurityGroupIds': 'false',
                                'sagemaker:VpcSubnets': 'false',
                                ...requestTagsConditions,
                            },
                            ...requestSystemTagEqualsConditions[SystemTagCondition.Equals]
                        },
                    }));
            } else {
                statements.push(
                    // Endpoint Configuration and TransformJob Permissions
                    new PolicyStatement({
                        effect: Effect.DENY,
                        actions: ['sagemaker:CreateEndpointConfig', 'sagemaker:CreateTransformJob'],
                        resources: [
                            `arn:${partition}:sagemaker:${region}:${this.account}:*`,
                        ],
                        conditions: {
                            Null: {
                                ...invertedBooleanConditions(requestTagsConditions),
                            },
                            ...requestSystemTagEqualsConditions[SystemTagCondition.NotEquals]
                        },
                    }));
                statements.push(
                    // HPO Permissions
                    new PolicyStatement({
                        effect: Effect.DENY,
                        actions: [
                            'sagemaker:CreateHyperParameterTuningJob',
                            'sagemaker:CreateTrainingJob',
                        ],
                        resources: [
                            `arn:${partition}:sagemaker:${region}:${this.account}:training-job/*`,
                            `arn:${partition}:sagemaker:${region}:${this.account}:hyper-parameter-tuning-job/*`
                        ],
                        conditions: {
                            Null: {
                                'sagemaker:VpcSecurityGroupIds': 'true',
                                'sagemaker:VpcSubnets': 'true',
                                ...invertedBooleanConditions(requestTagsConditions),
                            },
                            ...requestSystemTagEqualsConditions[SystemTagCondition.NotEquals]
                        },
                    }));
            }

            return statements;
        };

        /*
         * WARNING: Changing this method will cause any policy statement created by this to be regenerated. This will cause
         * any changes to this policy (like dynamic policy updates for app configuration changes) to be lost until the app
         * configuration is updated and it updates this policy with the expected values.
         */
        const instanceConstraintPolicyStatement = (partition: string, region: string, actionResourcePair: {[key: string]: string}) => {
            const [actions, resources] = Object.entries(actionResourcePair).reduce(([actionAccumulator, resourcesAccumulator], [action, resource]) => {
                return [[...actionAccumulator, `sagemaker:${action}`], [...resourcesAccumulator, `arn:${partition}:sagemaker:${region}:${this.account}:${resource}/*`]];
            }, [[] as string[], [] as string[]]);

            return [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions,
                    resources,
                    conditions: {
                        'ForAnyValue:StringEquals': {
                            'sagemaker:InstanceTypes': [],
                        },
                    },
                }),
            ];
        };

        const notebookPolicy = new ManagedPolicy(this, 'mlspace-notebook-policy', {
            statements: notebookPolicyStatements(this.partition, Aws.REGION),
            description: 'Enables general MLSpace actions in notebooks and across the entire application.'
        });
        const notebookManagedPolicies: IManagedPolicy[] = [notebookPolicy];

        if (this.mlspaceKmsInstanceConditionsPolicy) {
            notebookManagedPolicies.push(this.mlspaceKmsInstanceConditionsPolicy);
        }

        if (props.mlspaceConfig.MANAGE_IAM_ROLES) {
            if (props.mlspaceConfig.ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN) {
                this.mlspaceEndpointConfigInstanceConstraintPolicy = ManagedPolicy.fromManagedPolicyArn(this, 'mlspace-endpoint-config-instance-constraint', props.mlspaceConfig.ENDPOINT_CONFIG_INSTANCE_CONSTRAINT_POLICY_ARN);
            } else {
                /*
                 * WARNING: @see instanceConstraintPolicyStatement
                 */
                this.mlspaceEndpointConfigInstanceConstraintPolicy = new ManagedPolicy(this, 'mlspace-endpoint-config-instance-constraint', {
                    managedPolicyName: `${props.mlspaceConfig.IAM_RESOURCE_PREFIX}-endpoint-instance-constraint`,
                    statements: instanceConstraintPolicyStatement(this.partition, Aws.REGION, {CreateEndpointConfig: 'endpoint-config'})
                });
            }
    
            if (props.mlspaceConfig.JOB_INSTANCE_CONSTRAINT_POLICY_ARN) {
                this.mlspaceJobInstanceConstraintPolicy = ManagedPolicy.fromManagedPolicyArn(this, 'mlspace-job-instance-constraint', props.mlspaceConfig.JOB_INSTANCE_CONSTRAINT_POLICY_ARN);
            } else {
                /*
                 * WARNING: @see instanceConstraintPolicyStatement
                 */
                this.mlspaceJobInstanceConstraintPolicy = new ManagedPolicy(this, 'mlspace-job-instance-constraint', {
                    managedPolicyName: `${props.mlspaceConfig.IAM_RESOURCE_PREFIX}-job-instance-constraint`,
                    statements: [
                        instanceConstraintPolicyStatement(this.partition, Aws.REGION, {
                            CreateHyperParameterTuningJob: 'hyper-parameter-tuning-job',
                            CreateTrainingJob: 'training-job'
                        })[0],
                        instanceConstraintPolicyStatement(this.partition, Aws.REGION, {CreateTransformJob: 'transform-job'})[0]
                    ]
                });
            }

            notebookManagedPolicies.push(this.mlspaceEndpointConfigInstanceConstraintPolicy, this.mlspaceJobInstanceConstraintPolicy);
        }

        // If roles are manually created use the existing role
        if (props.mlspaceConfig.NOTEBOOK_ROLE_ARN) {
            this.mlSpaceNotebookRole = Role.fromRoleArn(
                this,
                mlSpaceNotebookRoleName,
                props.mlspaceConfig.NOTEBOOK_ROLE_ARN
            );
        } else {    
            // If roles are managed by CDK, create the notebook role
            
            // Translate Permissions Principles
            const notebookPolicyAllowPrinciples = props.enableTranslate
                ? new CompositePrincipal(
                    new ServicePrincipal('sagemaker.amazonaws.com'),
                    new ServicePrincipal('translate.amazonaws.com')
                )
                : new ServicePrincipal('sagemaker.amazonaws.com');

            this.mlSpaceNotebookRole = new Role(this, mlSpaceNotebookRoleName, {
                roleName: mlSpaceNotebookRoleName,
                assumedBy: notebookPolicyAllowPrinciples,
                managedPolicies: notebookManagedPolicies,
                description:
                    'Allows SageMaker Notebooks within ML Space to access necessary AWS services (S3, SQS, DynamoDB, ...)',
            });
        }

        /**
         * PERMISSIONS BOUNDARY SECTION
         * If roles are dynamically managed, applies the permissions boundary that limits maximum permissions
         */
        if (props.mlspaceConfig.MANAGE_IAM_ROLES) {
            // If role was manually created
            if (props.mlspaceConfig.PERMISSIONS_BOUNDARY_POLICY_NAME) {
                this.mlSpacePermissionsBoundary = ManagedPolicy.fromManagedPolicyName(
                    this,
                    'mlspace-existing-boundary',
                    props.mlspaceConfig.PERMISSIONS_BOUNDARY_POLICY_NAME
                );
            } else {
                // If roles are dynamically managed
                // Translate Permissions Principles
                const passRolePrincipals = props.enableTranslate
                    ? ['sagemaker.amazonaws.com', 'translate.amazonaws.com']
                    : 'sagemaker.amazonaws.com';

                // Permission boundary policy that ensures IAM policies never exceed these permissions
                this.mlSpacePermissionsBoundary = new ManagedPolicy(
                    this,
                    'mlspace-project-user-role-boundary',
                    {
                        managedPolicyName: 'mlspace-project-user-permission-boundary',
                        statements: [
                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: [
                                    's3:DeleteObject',
                                    's3:GetObject',
                                    's3:PutObject',
                                    's3:PutObjectTagging',
                                ],
                                resources: [
                                    `arn:*:s3:::${props.dataBucketName}/project/*`,
                                    `arn:*:s3:::${props.dataBucketName}/group/*`,
                                    `arn:*:s3:::${props.dataBucketName}/global/*`,
                                    `arn:*:s3:::${props.dataBucketName}/private/*`,
                                ],
                            }),

                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: ['s3:GetObject', 's3:PutObject', 's3:PutObjectTagging'],
                                resources: [`arn:*:s3:::${props.dataBucketName}/index/*`],
                            }),
                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: ['s3:ListBucket'],
                                resources: [`arn:*:s3:::${props.dataBucketName}`],
                                conditions: {
                                    StringLike: {
                                        's3:prefix': ['global/*', 'index/*', 'private/*', 'project/*', 'group/*'],
                                    },
                                },
                            }),
                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: ['s3:GetBucketLocation'],
                                resources: [`arn:*:s3:::${props.dataBucketName}`],
                            }),
                            new PolicyStatement({
                                effect: Effect.ALLOW,
                                actions: ['iam:PassRole'],
                                /*
                                * When SageMaker resources are created through a notebook (Training jobs,
                                * Transform jobs, HPO jobs, Models, etc) the API calls will use the role
                                * associated with the user making the request. As this is a permissions
                                * boundary being applied to dynamically created roles we can't scope
                                * this to an individual role rather we scope it to roles with the MLSpace
                                * prefix.
                                *
                                * Additional details are avaiable in the documentation:
                                * https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-roles.html#sagemaker-roles-pass-role
                                *
                                * This needs to match the IAM_RESOURCE_PREFIX prefix in iam_manager.py
                                */
                                resources: [`arn:*:iam::${this.account}:role/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}*`],
                                conditions: {
                                    StringEquals: {
                                        'iam:PassedToService': passRolePrincipals,
                                    },
                                },
                            }),
                            ...notebookPolicyStatements('*', '*', true),
                        ],
                    }
                );
            }
        }

        /**
         * APP POLICY & ROLE SECTION
         * 
         * This role is the summation of the following policies:
         * - Notebook policy - base permissions shared between the notebook role and app role
         * - App policy - additional permissions for the app that extend the notebook policy permissions
         * - App Deny Services policy - Denies access to disabled services
         * - service-role/AWSLambdaVPCAccessExecutionRole - AWS managed role
         */
        const mlSpaceAppRoleName = 'mlspace-app-role';
        const appPolicyAndStatements = (partition: string, region: string, roleName: string) => {
            const statements = [
                // General Permissions - Additional KMS permission unique to the app role to retire grants
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['kms:RetireGrant'],
                    resources: [props.encryptionKey.keyArn],
                }),
                /**
                 * General Permissions
                 * Additional permissions necessary to display logs for the various SageMaker
                 * resources, EMR clusters, and other entities via the logs lambda.
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['logs:FilterLogEvents'],
                    resources: ['*'],
                }),
                // General Permissions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['iam:PassRole', 'iam:ListRoleTags'],
                    resources: [
                        /**
                         * When this stack is folded back into the IAM stack we need to switch
                         * these to be dynamic. At the moment though we have a weird dependency
                         * order with the two stacks being split.
                         */
                        `arn:${this.partition}:iam::${this.account}:role/EMR_DefaultRole`,
                        `arn:${this.partition}:iam::${this.account}:role/EMR_EC2_DefaultRole`,
                        `arn:${this.partition}:iam::${this.account}:role/${roleName}`,
                    ],
                }),
                // General Permissions - DynamoDB permissions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'dynamodb:GetItem',
                        'dynamodb:PutItem',
                        'dynamodb:Scan',
                        'dynamodb:DeleteItem',
                        'dynamodb:Query',
                        'dynamodb:UpdateItem',
                    ],
                    resources: [
                        `arn:${this.partition}:dynamodb:${Aws.REGION}:${this.account}:table/mlspace-*`,
                    ],
                }),
                /**
                 * EMR Permissions
                 * EMR specific permission to allow communication between notebook instances and
                 * EMR clusters
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['ec2:AuthorizeSecurityGroupIngress'],
                    resources: [`${ec2ArnBase}:security-group/*`],
                }),
                /**
                 * Various Permissions
                 * 
                 * Additional EC2 permissions required for the application role. Most of the
                 * permissions are covered in the attached mlspace-notebook-policy policy. This
                 * block includes some additional permissions are required for EMR functionality as
                 * well as generic metadata operations needed by notebooks.
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        // EMR Permissions
                        'ec2:DescribeInstances',
                        'ec2:DescribeRouteTables',
                        /**
                         * General Permissions
                         * EC2 permission necessary to list available instance types for endpoints,
                         * notebooks, training jobs, and others
                         */
                        'ec2:DescribeInstanceTypeOfferings',
                        'ec2:DescribeInstanceTypes',
                        /**
                         * Notebook Permissions
                         * Additional EC2 permission needed to start/stop/delete SageMaker Notebook
                         * Instances (see StartNotebookInstance section for additional details
                         * https://docs.aws.amazon.com/sagemaker/latest/dg/api-permissions-reference.html)
                         */
                        'ec2:DescribeVpcEndpoints',
                    ],
                    resources: ['*'],
                }),
                /**
                 * General Permissions
                 * S3 permissions related to CRUD operations for datasets, as well as SageMaker job
                 * input/output, reading of static web app content, notebook and emr cluster
                 * configuration and sample notebooks/data.
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        's3:List*',
                        's3:Get*',
                        's3:PutObject',
                        's3:PutObjectTagging',
                        's3:DeleteObject',
                        's3:PutBucketNotification',
                    ],
                    resources: [`arn:${this.partition}:s3:::*`],
                }),
                /**
                 * Notebook Permissions
                 * Additional SageMaker permissions that the application role uses that the default
                 * notebook policy does not support - primarily the ability to create Notebook
                 * Instances and actions related to those notebooks.
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['sagemaker:CreateNotebookInstance'],
                    resources: [
                        `arn:${this.partition}:sagemaker:${Aws.REGION}:${this.account}:notebook-instance/*`,
                    ],
                    conditions: {
                        StringEquals: {
                            'sagemaker:DirectInternetAccess': 'Disabled',
                            'sagemaker:RootAccess': 'Disabled',
                        },
                        Null: {
                            'sagemaker:VpcSecurityGroupIds': 'false',
                            'sagemaker:VpcSubnets': 'false',
                            ...requestTagsConditions,
                        },
                    },
                }),
                // Notebook Permissions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'sagemaker:CreateNotebookInstanceLifecycleConfig',
                        'sagemaker:UpdateNotebookInstanceLifecycleConfig',
                        'sagemaker:DeleteNotebookInstanceLifecycleConfig',
                        'sagemaker:DescribeNotebookInstanceLifecycleConfig',
                    ],
                    resources: [
                        `arn:${this.partition}:sagemaker:${Aws.REGION}:${this.account}:notebook-instance-lifecycle-config/*`,
                    ],
                }),
                // Notebook Permissions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'sagemaker:DeleteNotebookInstance',
                        'sagemaker:DescribeNotebookInstance',
                        'sagemaker:StartNotebookInstance',
                        'sagemaker:StopNotebookInstance',
                        'sagemaker:UpdateNotebookInstance',
                    ],
                    resources: [
                        `arn:${this.partition}:sagemaker:${Aws.REGION}:${this.account}:notebook-instance/*`,
                    ],
                    conditions: {
                        Null: {
                            ...resourceTagsConditions,
                        },
                    },
                }),
                /**
                 * Notebook Permissions
                 * Must be separate from above due to resource tag conditions not applying
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['sagemaker:CreatePresignedNotebookInstanceUrl'],
                    resources: [
                        `arn:${this.partition}:sagemaker:${Aws.REGION}:${this.account}:notebook-instance/*`,
                    ],
                }),
                // Notebook Permissions - Not bound by identifier
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'sagemaker:ListNotebookInstanceLifecycleConfigs',
                        'sagemaker:ListNotebookInstances',
                    ],
                    // SageMaker list actions that are not bound by resource identifier
                    resources: ['*'],
                }),
                // General Permissions - Allows the invocation of MLSpace lambda functions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['lambda:InvokeFunction'],
                    resources: [
                        `arn:${this.partition}:lambda:${Aws.REGION}:${this.account}:function:mls-lambda-*`,
                    ],
                }),
                /**
                 * EMR Permissions
                 * Policy actions required for launching, terminating, and managing EMR clusters
                 * within MLSpace
                 */
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'elasticmapreduce:RunJobFlow', 
                        'elasticmapreduce:ListClusters',
                        'elasticmapreduce:ListReleaseLabels'
                    ],
                    resources: ['*'],
                }),
                // EMR Permissions
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'elasticmapreduce:DescribeCluster',
                        'elasticmapreduce:ListInstances',
                        'elasticmapreduce:AddTags',
                        'elasticmapreduce:TerminateJobFlows',
                        'elasticmapreduce:SetTerminationProtection',
                    ],
                    resources: [
                        `arn:${this.partition}:elasticmapreduce:${Aws.REGION}:${this.account}:cluster/*`,
                    ],
                }),
            ];

            if (props.mlspaceConfig.MANAGE_IAM_ROLES && this.mlSpacePermissionsBoundary) {
                /**
                 * General Permissions - Dynamic Roles IAM Permissions
                 * All of the following statements are required when using managed IAM roles
                 */
                statements.push(
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['iam:CreateRole'],
                        resources: [
                            `arn:${this.partition}:iam::${this.account}:role/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}*`,
                        ],
                        conditions: {
                            StringEqualsIgnoreCase: {
                                'iam:ResourceTag/system': props.mlspaceConfig.SYSTEM_TAG,
                            },
                            StringEquals: {
                                'iam:PermissionsBoundary':
                                    this.mlSpacePermissionsBoundary.managedPolicyArn,
                            },
                        },
                    }),
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: [
                            'iam:AttachRolePolicy',
                            'iam:DetachRolePolicy',
                            'iam:DeleteRole',
                            'iam:DeleteRolePolicy',
                            'iam:PutRolePolicy',
                        ],
                        // This needs to match the IAM_RESOURCE_PREFIX prefix in iam_manager.py
                        resources: [
                            `arn:${this.partition}:iam::${this.account}:role/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}*`,
                        ],
                        conditions: {
                            StringEqualsIgnoreCase: {
                                'iam:ResourceTag/system': props.mlspaceConfig.SYSTEM_TAG,
                            },
                        },
                    }),
                    // Only certain policies should be allowed to attach to the notebook and app roles
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: [
                            'iam:AttachRolePolicy',
                            'iam:DetachRolePolicy',
                        ],
                        // This needs to match the IAM_RESOURCE_PREFIX prefix in iam_manager.py
                        resources: [
                            // This is needed for the deny services policy to be attached to the notebook and app roles
                            `arn:${this.partition}:iam::${this.account}:role/${mlSpaceAppRoleName}`,
                            `arn:${this.partition}:iam::${this.account}:role/${mlSpaceNotebookRoleName}`,
                            `arn:${this.partition}:iam::${this.account}:role/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}*`,
                        ],
                        conditions: {
                            StringEqualsIgnoreCase: {
                                // Only allow dynamic attachment for the deny services policy
                                'iam:PolicyARN': `arn:${this.partition}:iam::${this.account}:policy/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}-app-denied-services`,
                                'iam:ResourceTag/system': props.mlspaceConfig.SYSTEM_TAG,
                            },
                        },
                    }),
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: [
                            'iam:ListRoles',
                            'iam:ListEntitiesForPolicy',
                            'iam:ListPolicyVersions',
                            'iam:ListAttachedRolePolicies',
                            'iam:GetRole',
                            'iam:GetPolicy',
                            'iam:ListRoleTags',
                        ],
                        resources: ['*'],
                    }),
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: [
                            'iam:CreatePolicy',
                            'iam:CreatePolicyVersion',
                            'iam:DeletePolicy',
                            'iam:DeletePolicyVersion',
                            'iam:TagPolicy',
                        ],
                        // This needs to match the IAM_RESOURCE_PREFIX prefix in iam_manager.py
                        resources: [
                            `arn:${this.partition}:iam::${this.account}:policy/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}*`,
                        ],
                    }),
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['iam:SimulatePrincipalPolicy', 'iam:TagRole', 'iam:AttachRolePolicy'],
                        resources: [
                            `arn:${this.partition}:iam::${this.account}:role/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}*`,
                        ],
                    }),
                    /*
                    * When SageMaker resources are created through the MLSpace Webapp (Training jobs,
                    * Transform jobs, HPO jobs, Models, etc) the API calls will use the dynamic role
                    * Transform with the user making the request. The "iam:passRole" action is
                    * required in order to run these resources as the role associated with the user.
                    * Additional details are available in the documentation:
                    * https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-roles.html#sagemaker-roles-pass-role
                    *
                    * This needs to match the IAM_RESOURCE_PREFIX prefix in iam_manager.py
                    */
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['iam:PassRole'],
                        resources: [
                            `arn:${this.partition}:iam::${this.account}:role/${props.mlspaceConfig.IAM_RESOURCE_PREFIX}*`,
                        ],
                        conditions: {
                            StringEquals: {
                                'iam:PassedToService': 'sagemaker.amazonaws.com',
                            },
                        },
                    })
                );
            }

            if (props.enableTranslate) {
                statements.push(
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['iam:PassRole'],
                        // We don't *currently* run these jobs using the user IAM roles so we can
                        // specify a specific role here
                        resources: [
                            `arn:${this.partition}:iam::${this.account}:role/${roleName}`,
                        ],
                        conditions: {
                            StringEquals: {
                                'iam:PassedToService': 'translate.amazonaws.com',
                            },
                        },
                    })
                );
            }
            return statements;
        };

        if (props.mlspaceConfig.APP_ROLE_ARN) {
            this.mlSpaceAppRole = Role.fromRoleArn(this, 'mlspace-app-role', props.mlspaceConfig.APP_ROLE_ARN);
        } else {
            // ML Space Application role


            const appPolicy = new ManagedPolicy(this, 'mlspace-app-policy', {
                statements: appPolicyAndStatements(this.partition, Aws.REGION, mlSpaceAppRoleName)
            });

            const appPolicyAllowPrinciples = props.enableTranslate
                ? new CompositePrincipal(
                    new ServicePrincipal('lambda.amazonaws.com'),
                    new ServicePrincipal('translate.amazonaws.com')
                )
                : new ServicePrincipal('lambda.amazonaws.com');
            this.mlSpaceAppRole = new Role(this, 'mlspace-app-role', {
                roleName: mlSpaceAppRoleName,
                assumedBy: appPolicyAllowPrinciples,
                managedPolicies: [
                    appPolicy, 
                    ...notebookManagedPolicies,
                    ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
                ],
                description:
                    'Allows ML Space Application to access necessary AWS services (S3, SQS, DynamoDB, ...)',
            });
        }

        /**
         * System Permissions Role
         * This role will provision permissions to the MLSpace system to perform actions independently of what
         * users are capable of doing. Ex: a service like EMR may be disabled, but this role will allow the system 
         * to terminate EMR clusters even though users can't perform any EMR actions.
         * These actions include cleaning up resources for deleted projects and suspended users.
         */
        if (props.mlspaceConfig.SYSTEM_ROLE_ARN) {
            this.mlSpaceSystemRole = Role.fromRoleArn(this, mlspaceSystemRoleName, props.mlspaceConfig.SYSTEM_ROLE_ARN);
        } else {
            const systemPolicy = new ManagedPolicy(this, 'mlspace-system-policy', {
                statements: appPolicyAndStatements(this.partition, Aws.REGION, mlspaceSystemRoleName),
            });
            const systemPolicyAllowPrinciples = props.enableTranslate
                ? new CompositePrincipal(
                    new ServicePrincipal('lambda.amazonaws.com'),
                    new ServicePrincipal('translate.amazonaws.com')
                )
                : new ServicePrincipal('lambda.amazonaws.com');
            this.mlSpaceSystemRole = new Role(this, mlspaceSystemRoleName, {
                roleName: mlspaceSystemRoleName,
                assumedBy: systemPolicyAllowPrinciples,
                managedPolicies: [
                    systemPolicy,
                    notebookPolicy,
                    ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
                ],
                description:
                    'Allows ML Space System to access necessary AWS services (S3, DynamoDB, Sagemaker services, ...)',
            });
        }

        /**
         * Provides the API Gateway S3 proxy access to the statically hosted website files
         * See:
         * - /README.md for "S3_READER_ROLE_ARN"
         * - /frontend/docs/admin-guide/install.html#s3-reader-role
         */
        if (props.mlspaceConfig.S3_READER_ROLE_ARN) {
            this.s3ReaderRole = Role.fromRoleArn(
                this,
                'mlspace-s3-reader-role',
                props.mlspaceConfig.S3_READER_ROLE_ARN
            );
        } else {
            const s3WebsiteReadOnlyPolicy = new ManagedPolicy(this, 'mlspace-website-read-policy', {
                statements: [
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['s3:GetObject'],
                        resources: [`arn:${this.partition}:s3:::${props.websiteBucketName}/*`],
                    }),
                ],
            });
            this.s3ReaderRole = new Role(this, 'mlspace-s3-reader-role', {
                assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
                roleName: 'mlspace-s3-reader-Role',
                managedPolicies: [s3WebsiteReadOnlyPolicy],
                description: 'Allows API gateway to proxy static website assets',
            });
        }

        /**
         * Enables logging for S3 and API Gateway
         * See 
         * - /README.md for "ENABLE_ACCESS_LOGGING"
         */
        if (props.mlspaceConfig.ENABLE_ACCESS_LOGGING) {
            if (props.mlspaceConfig.APIGATEWAY_CLOUDWATCH_ROLE_ARN) {
                new CfnAccount(this, 'mlspace-cwl-api-gateway-account', {
                    cloudWatchRoleArn: props.mlspaceConfig.APIGATEWAY_CLOUDWATCH_ROLE_ARN,
                });
            } else {
                // Create CW Role
                const apiGatewayCloudWatchRole = new Role(this, 'mlspace-cwl-role', {
                    assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
                    managedPolicies: [
                        ManagedPolicy.fromAwsManagedPolicyName(
                            'service-role/AmazonAPIGatewayPushToCloudWatchLogs'
                        ),
                    ],
                });

                new CfnAccount(this, 'mlspace-cwl-api-gateway-account', {
                    cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
                });
            }
        }

        /**
         * EMR Permissions Role
         * See:
         * - /README.md for "EMR_DEFAULT_ROLE_ARN"
         * - /frontend/docs/admin-guide/install.html#emr-roles
         */ 
        if (props.mlspaceConfig.EMR_DEFAULT_ROLE_ARN) {
            const existingEmrServiceRole = Role.fromRoleArn(
                this,
                'mlspace-emr_defaultrole',
                props.mlspaceConfig.EMR_DEFAULT_ROLE_ARN
            );
            this.emrServiceRoleName = existingEmrServiceRole.roleName;
        } else {
            const serviceRoleName = 'EMR_DefaultRole';
            new Role(this, 'mlspace-emr_defaultrole', {
                assumedBy: new ServicePrincipal('elasticmapreduce.amazonaws.com'),
                roleName: serviceRoleName,
                managedPolicies: [
                    ManagedPolicy.fromAwsManagedPolicyName(
                        'service-role/AmazonElasticMapReduceRole'
                    ),
                ],
                description: 'Provides needed permissions for running an EMR Cluster.',
            });
            this.emrServiceRoleName = serviceRoleName;
        }

        /**
         * EMR Permissions Role
         * See 
         * - /README.md for "EMR_EC2_INSTANCE_ROLE_ARN"
         * - /frontend/docs/admin-guide/install.html#emr-roles
         */ 
        if (props.mlspaceConfig.EMR_EC2_INSTANCE_ROLE_ARN) {
            const existingEmrEC2Role = Role.fromRoleArn(
                this,
                'mlspace-emr_ec2_defaultrole',
                props.mlspaceConfig.EMR_EC2_INSTANCE_ROLE_ARN
            );
            this.emrEC2RoleName = existingEmrEC2Role.roleName;
        } else {
            const emrEC2RoleName = 'EMR_EC2_DefaultRole';
            const ec2EMRRole = new Role(this, 'mlspace-emr_ec2_defaultrole', {
                assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
                roleName: emrEC2RoleName,
                managedPolicies: [
                    ManagedPolicy.fromAwsManagedPolicyName(
                        'service-role/AmazonElasticMapReduceforEC2Role'
                    ),
                ],
                description: 'Provides needed permissions for running an EMR Cluster.',
            });

            new CfnInstanceProfile(this, 'mlspace-emr-instance-profile', {
                roles: [ec2EMRRole.roleName],
                instanceProfileName: ec2EMRRole.roleName,
            });
            this.emrEC2RoleName = ec2EMRRole.roleName;
        }
    }
}
