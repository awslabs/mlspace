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

import { Duration } from 'aws-cdk-lib';
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
        
        // Set up state key rotation if enabled
        if (props.enableStateKeyRotation) {
            this.setupStateKeyRotation(props);
        }
        
        // Set up token key rotation if enabled
        if (props.enableTokenKeyRotation) {
            this.setupTokenKeyRotation(props);
        }
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
    public createManualInitializationFunctions (): { stateInit: IFunction; tokenInit: IFunction } {
        const stateInitFunction = new Function(this, 'ManualStateInitFunction', {
            runtime: Runtime.PYTHON_3_11,
            code: Code.fromAsset('backend/src'),
            handler: 'ml_space_lambda.auth.utils.rotation_handlers.initialize_secret_handler',
            timeout: Duration.minutes(5),
            memorySize: 256,
            environment: {
                STATE_ENCRYPTION_SECRET_ARN: this.stateEncryptionSecret.secretArn,
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