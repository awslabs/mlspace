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

import { CustomResource, Duration } from 'aws-cdk-lib';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement, Effect, IRole } from 'aws-cdk-lib/aws-iam';
import { Code, Function, IFunction, ILayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Secret, RotationSchedule } from 'aws-cdk-lib/aws-secretsmanager';
import { SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MLSpaceConfig } from '../../utils/configTypes';

export type AuthSecretsConstructProps = {
    readonly config: MLSpaceConfig;
    readonly layers?: ILayerVersion[];
    readonly lambdaSourcePath: string;
    readonly vpc?: IVpc;
    readonly securityGroups?: ISecurityGroup[];
    readonly enableStateKeyRotation?: boolean;
    readonly enableTokenKeyRotation?: boolean;
    readonly stateKeyRotationDays?: number;
    readonly tokenKeyRotationDays?: number;
    readonly mlSpaceAppRole: IRole;
    readonly oidcClientSecret?: string; // Optional OIDC client secret value
};

export class AuthSecretsConstruct extends Construct {
    public readonly stateEncryptionSecret: Secret;
    public readonly tokenEncryptionSecret: Secret;
    public readonly oidcClientSecret: Secret;
    public stateKeyRotationFunction?: IFunction;
    public tokenKeyRotationFunction?: IFunction;
    public stateKeyRotationSchedule?: RotationSchedule;
    public tokenKeyRotationSchedule?: RotationSchedule;
    
    constructor (scope: Construct, id: string, props: AuthSecretsConstructProps) {
        super(scope, id);
        
        // Create state encryption secret with placeholder
        
        this.stateEncryptionSecret = new Secret(this, 'StateEncryptionSecret1', {
            secretName: props.config.AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME,
            description: 'State encryption key for BFF authentication (Fernet key)',
        });
        
        // Create token encryption secret with placeholder
        this.tokenEncryptionSecret = new Secret(this, 'TokenEncryptionSecret1', {
            secretName: props.config.AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME,
            description: 'Versioned token encryption keys for BFF authentication (PASETO keys)',
        });
        
        // Create OIDC client secret
        this.oidcClientSecret = new Secret(this, 'OidcClientSecret', {
            secretName: props.config.AUTH_OIDC_CLIENT_SECRET_NAME,
            description: 'OIDC client secret for authentication',
            // Set value if provided, otherwise create placeholder for manual configuration
            secretStringValue: SecretValue.unsafePlainText(JSON.stringify({
                client_secret: props.oidcClientSecret,
                configured: !!props.oidcClientSecret,
                configured_at: new Date().toISOString()
            }))
        });

        this.createVersionedSecretInitResource(props);

        // Set up state key rotation if enabled
        if (props.enableStateKeyRotation) {
            this.setupStateKeyRotation(props);
        }

        // Set up token key rotation if enabled
        if (props.enableTokenKeyRotation) {
            this.setupTokenKeyRotation(props);
        }

        // Do not addDependency(rotationSchedule, versionedSecretInit): that implies
        // rotationSchedule -> InitCustomResource -> Secret, while Secret already owns the
        // rotation schedule, which CloudFormation resolves as a circular dependency.
    }

    /**
     * Ensures state/token secrets hold VersionedKeyData JSON before rotation runs.
     */
    private createVersionedSecretInitResource (props: AuthSecretsConstructProps): void {
        const versionedInitFn = new Function(this, 'AuthSecretsVersionedJsonInit', {
            functionName: 'mls-lambda-auth-secrets-versioned-json-init',
            runtime: props.config.LAMBDA_RUNTIME,
            architecture: props.config.LAMBDA_ARCHITECTURE,
            code: Code.fromAsset(props.lambdaSourcePath),
            handler: 'ml_space_lambda.auth.utils.rotation_handlers.deploy_time_auth_secrets_init',
            timeout: Duration.minutes(2),
            memorySize: 256,
            layers: props.layers,
            environment: {
                AUTH_STATE_SECRET_NAME: props.config.AUTH_STATE_ENCRYPTION_KEY_SECRET_NAME,
                AUTH_TOKEN_SECRET_NAME: props.config.AUTH_TOKEN_ENCRYPTION_KEY_SECRET_NAME,
            },
            vpc: props.vpc,
            securityGroups: props.securityGroups,
        });

        this.stateEncryptionSecret.grantRead(versionedInitFn);
        this.stateEncryptionSecret.grantWrite(versionedInitFn);
        this.tokenEncryptionSecret.grantRead(versionedInitFn);
        this.tokenEncryptionSecret.grantWrite(versionedInitFn);

        // Do not use mlSpaceAppRole here: grantInvoke(role) lives on the IAM stack while this Lambda
        // lives on Core, which already depends on that role — that creates a cross-stack cycle.

        // AwsCustomResource Lambda.invoke treats FunctionError as success (HTTP 200). A thin Node
        // onEvent handler fails the stack when the init Lambda returns an error payload.
        const invokerCode = `const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
exports.handler = async (event) => {
  const physicalId = 'mlspace-auth-secrets-versioned-json-v1';
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: event.PhysicalResourceId || physicalId };
  }
  const target = process.env.TARGET_FUNCTION_NAME;
  const result = await lambda.invoke({
    FunctionName: target,
    InvocationType: 'RequestResponse',
    Payload: Buffer.from('{}'),
  }).promise();
  if (result.StatusCode === undefined || result.StatusCode < 200 || result.StatusCode >= 300) {
    throw new Error('Lambda invoke failed with status ' + result.StatusCode);
  }
  if (result.FunctionError) {
    let detail = '';
    try {
      const raw = result.Payload ? Buffer.from(result.Payload).toString() : '';
      detail = raw ? JSON.parse(raw) : '';
    } catch (e) {
      detail = result.Payload ? Buffer.from(result.Payload).toString() : '';
    }
    throw new Error(result.FunctionError + ': ' + JSON.stringify(detail));
  }
  return { PhysicalResourceId: physicalId };
};
`;

        const invokerFn = new Function(this, 'AuthSecretsVersionedJsonInitInvoker', {
            functionName: 'mls-lambda-auth-secrets-versioned-json-init-invoker',
            runtime: Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: Code.fromInline(invokerCode),
            timeout: Duration.minutes(5),
            memorySize: 128,
            environment: {
                TARGET_FUNCTION_NAME: versionedInitFn.functionName,
            },
        });

        versionedInitFn.grantInvoke(invokerFn);

        const provider = new Provider(this, 'InitAuthSecretsVersionedJsonProvider', {
            onEventHandler: invokerFn,
        });

        const cr = new CustomResource(this, 'InitAuthSecretsVersionedJson', {
            serviceToken: provider.serviceToken,
        });
        cr.node.addDependency(versionedInitFn);
        cr.node.addDependency(this.stateEncryptionSecret);
        cr.node.addDependency(this.tokenEncryptionSecret);
    }
    
    private setupStateKeyRotation (props: AuthSecretsConstructProps) {
        // Create state key rotation Lambda function
        this.stateKeyRotationFunction = new Function(this, 'StateKeyRotationFunction', {
            functionName: 'mls-lambda-state-key-rotation',
            runtime: props.config.LAMBDA_RUNTIME,
            code: Code.fromAsset(props.lambdaSourcePath),
            handler: 'ml_space_lambda.auth.utils.rotation_handlers.state_key_secrets_manager_rotation_handler',
            timeout: Duration.minutes(5),
            memorySize: 256,
            layers: props.layers,
            environment: {
                STATE_ENCRYPTION_SECRET_ARN: this.stateEncryptionSecret.secretArn,
                AUTH_KEY_VERSIONS_TO_KEEP: String(props.config.AUTH_KEY_VERSIONS_TO_KEEP),
            },
            vpc: props.vpc,
            securityGroups: props.securityGroups,
        });
        
        // Grant permissions to access and update state secret
        this.stateKeyRotationFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'secretsmanager:GetSecretValue',
                    'secretsmanager:UpdateSecret',
                    'secretsmanager:DescribeSecret',
                    'secretsmanager:PutSecretValue',
                    'secretsmanager:UpdateSecretVersionStage',
                    'secretsmanager:DeleteSecret', // For version cleanup
                ],
                resources: [this.stateEncryptionSecret.secretArn],
            })
        );
        
        // Create rotation schedule for state key
        this.stateKeyRotationSchedule = this.stateEncryptionSecret.addRotationSchedule('StateKeyRotationSchedule', {
            rotationLambda: this.stateKeyRotationFunction,
            automaticallyAfter: Duration.days(props.stateKeyRotationDays || 90),
            rotateImmediatelyOnUpdate: true,
        });
    }
    
    private setupTokenKeyRotation (props: AuthSecretsConstructProps) {
        // Create token key rotation Lambda function
        this.tokenKeyRotationFunction = new Function(this, 'TokenKeyRotationFunction', {
            functionName: 'mls-lambda-token-key-rotation',
            runtime: props.config.LAMBDA_RUNTIME,
            code: Code.fromAsset(props.lambdaSourcePath),
            handler: 'ml_space_lambda.auth.utils.rotation_handlers.token_key_secrets_manager_rotation_handler',
            timeout: Duration.minutes(5),
            memorySize: 256,
            layers: props.layers,
            environment: {
                TOKEN_ENCRYPTION_SECRET_ARN: this.tokenEncryptionSecret.secretArn,
                AUTH_KEY_VERSIONS_TO_KEEP: String(props.config.AUTH_KEY_VERSIONS_TO_KEEP),
            },
            vpc: props.vpc,
            securityGroups: props.securityGroups,
        });
        
        // Grant permissions to access and update token secret
        this.tokenKeyRotationFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'secretsmanager:GetSecretValue',
                    'secretsmanager:UpdateSecret',
                    'secretsmanager:DescribeSecret',
                    'secretsmanager:PutSecretValue',
                    'secretsmanager:UpdateSecretVersionStage',
                    'secretsmanager:DeleteSecret', // For version cleanup
                ],
                resources: [this.tokenEncryptionSecret.secretArn],
            })
        );
        
        // Create rotation schedule for token key
        this.tokenKeyRotationSchedule = this.tokenEncryptionSecret.addRotationSchedule('TokenKeyRotationSchedule', {
            rotationLambda: this.tokenKeyRotationFunction,
            automaticallyAfter: Duration.days(props.tokenKeyRotationDays || 90),
            rotateImmediatelyOnUpdate: true,
        });
    }
    
    /**
    * Create manual initialization functions for secrets.
    * These can be invoked on-demand to initialize secrets with proper key structures.
    */
    public createManualInitializationFunctions (config: MLSpaceConfig): { stateInit: IFunction; tokenInit: IFunction } {
        const stateInitFunction = new Function(this, 'ManualStateInitFunction', {
            runtime: Runtime.PYTHON_3_11,
            code: Code.fromAsset('backend/src'),
            handler: 'ml_space_lambda.auth.utils.rotation_handlers.initialize_secret_handler',
            timeout: Duration.minutes(5),
            memorySize: 256,
            environment: {
                STATE_ENCRYPTION_SECRET_ARN: this.stateEncryptionSecret.secretArn,
                AUTH_KEY_VERSIONS_TO_KEEP: String(config.AUTH_KEY_VERSIONS_TO_KEEP),
            },
        });
        
        const tokenInitFunction = new Function(this, 'ManualTokenInitFunction', {
            runtime: Runtime.PYTHON_3_11,
            code: Code.fromAsset('backend/src'),
            handler: 'ml_space_lambda.auth.utils.rotation_handlers.initialize_secret_handler',
            timeout: Duration.minutes(5),
            memorySize: 256,
            environment: {
                TOKEN_ENCRYPTION_SECRET_ARN: this.tokenEncryptionSecret.secretArn,
                AUTH_KEY_VERSIONS_TO_KEEP: String(config.AUTH_KEY_VERSIONS_TO_KEEP),
            },
        });
        
        // Grant permissions
        this.stateEncryptionSecret.grantWrite(stateInitFunction);
        this.tokenEncryptionSecret.grantWrite(tokenInitFunction);
        
        return {
            stateInit: stateInitFunction,
            tokenInit: tokenInitFunction
        };
    }
}