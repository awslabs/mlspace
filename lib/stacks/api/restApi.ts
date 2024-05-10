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
import {
    AccessLogField,
    AccessLogFormat,
    AwsIntegration,
    Cors,
    EndpointType,
    IAuthorizer,
    IdentitySource,
    LogGroupLogDestination,
    RequestAuthorizer,
    RestApi,
    StageOptions,
} from 'aws-cdk-lib/aws-apigateway';
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { IRole, Role } from 'aws-cdk-lib/aws-iam';
import { Code, Function, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { ADCLambdaCABundleAspect } from '../../utils/adcCertBundleAspect';
import { createLambdaLayer } from '../../utils/layers';
import { MLSpaceConfig } from '../../utils/configTypes';


export type ApiStackProperties = {
    readonly restApiId: string;
    readonly rootResourceId: string;
    readonly dataBucketName: string;
    readonly cwlBucketName: string;
    readonly applicationRole: IRole;
    readonly notebookInstanceRole: IRole;
    readonly configBucketName: string;
    readonly notebookParamFileKey: string;
    readonly deploymentEnvironmentName: string;
    readonly authorizer: IAuthorizer;
    readonly lambdaSourcePath: string;
    readonly mlSpaceVPC: IVpc;
    readonly securityGroups: ISecurityGroup[];
    readonly permissionsBoundaryArn?: string;
    readonly emrEC2RoleName?: string;
    readonly emrServiceRoleName?: string;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export type RestApiStackProperties = {
    readonly frontEndAssetsPath: string;
    readonly lambdaSourcePath: string;
    readonly dataBucketName: string;
    readonly websiteBucketName: string;
    readonly websiteS3ReaderRole: IRole;
    readonly mlSpaceAppRole: IRole;
    readonly verifyOIDCTokenSignature: boolean;
    readonly mlSpaceVPC: IVpc;
    readonly lambdaSecurityGroups: ISecurityGroup[];
    readonly isIso?: boolean;
    readonly enableMigrationUI?: boolean;
    readonly enableTranslate: boolean;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class RestApiStack extends Stack {
    public mlspaceRequestAuthorizer: RequestAuthorizer;
    public mlSpaceRestApiId: string;
    public mlSpaceRestApiRootResourceId: string;

    constructor (parent: App, id: string, props: RestApiStackProperties) {
        super(parent, id, {
            terminationProtection: false,
            ...props,
        });
        // Depending on your needs the throttling configuration can be changed here. These limits
        // only impact calls to the MLSpace APIs and will have no impact on the backing AWS APIs. If
        // an MLSpace API is calling a SageMaker API with a TPS limit of 10 then setting this value
        // to anything greater than 10 may result in throttling from SageMaker directly.
        let deployOptions: StageOptions = {
            stageName: 'Prod',
            throttlingRateLimit: 100,
            throttlingBurstLimit: 100,
        };
        if (props.mlspaceConfig.ENABLE_ACCESS_LOGGING) {
            const apiAccessLogGroup = new LogGroup(this, 'mlspace-APIGWLogGroup', {
                logGroupName: '/aws/apigateway/MLSpace',
                removalPolicy: RemovalPolicy.DESTROY,
            });
            deployOptions = {
                ...deployOptions,
                accessLogDestination: new LogGroupLogDestination(apiAccessLogGroup),
                accessLogFormat: AccessLogFormat.custom(
                    JSON.stringify({
                        requestId: AccessLogField.contextRequestId(),
                        requestTime: AccessLogField.contextRequestTime(),
                        authorizerPrincipalId: AccessLogField.contextAuthorizerPrincipalId(),
                        identity: {
                            accountId: AccessLogField.contextIdentityAccountId(),
                            apiKeyId: AccessLogField.contextIdentityApiKeyId(),
                            caller: AccessLogField.contextIdentityCaller(),
                            sourceIp: AccessLogField.contextIdentitySourceIp(),
                            user: AccessLogField.contextIdentityUser(),
                            userAgent: AccessLogField.contextIdentityUserAgent(),
                            userArn: AccessLogField.contextIdentityUserArn(),
                        },
                        requestContext: {
                            stage: AccessLogField.contextStage(),
                            protocol: AccessLogField.contextProtocol(),
                            httpMethod: AccessLogField.contextHttpMethod(),
                            path: AccessLogField.contextPath(),
                            resourcePath: AccessLogField.contextResourcePath(),
                            resourceId: AccessLogField.contextResourceId(),
                        },
                        response: {
                            statusCode: AccessLogField.contextStatus(),
                            latency: AccessLogField.contextResponseLatency(),
                            length: AccessLogField.contextResponseLength(),
                        },
                        error: {
                            message: AccessLogField.contextErrorMessage(),
                            responseType: AccessLogField.contextErrorResponseType(),
                        },
                    })
                ),
            };
        }
        const mlSpaceRestApi = new RestApi(this, 'mlspace-api', {
            restApiName: 'MLSpace API',
            description: 'The MLSpace API Layer.',
            endpointConfiguration: { types: [EndpointType.REGIONAL] },
            deployOptions,
            deploy: true,
            defaultCorsPreflightOptions: {
                allowOrigins: Cors.ALL_ORIGINS,
                allowHeaders: [
                    ...Cors.DEFAULT_HEADERS,
                    'x-mlspace-dataset-scope',
                    'x-mlspace-dataset-type',
                    'x-mlspace-project',
                ],
            },
            // Support binary media types used for documentation images and fonts
            binaryMediaTypes: ['font/*', 'image/*'],
        });
        // Configure static site resources
        const proxyMethodResponse = [
            {
                statusCode: '200',
                responseParameters: {
                    'method.response.header.Content-Length': true,
                    'method.response.header.Content-Type': true,
                    'method.response.header.Content-Disposition': true,
                },
            },
        ];
        const proxyRequestParameters = {
            'method.request.header.Accept': true,
            'method.request.header.Content-Type': true,
            'method.request.header.Content-Disposition': true,
        };
        const proxyIntegrationResponse = [
            {
                statusCode: '200',
                responseParameters: {
                    'method.response.header.Content-Length':
                        'integration.response.header.Content-Length',
                    'method.response.header.Content-Type':
                        'integration.response.header.Content-Type',
                    'method.response.header.Content-Disposition':
                        'integration.response.header.Content-Disposition',
                },
            },
        ];
        const proxyIntegrationRequestParameters = {
            'integration.request.header.Accept': 'method.request.header.Accept',
            'integration.request.header.Content-Disposition':
                'method.request.header.Content-Disposition',
            'integration.request.header.Content-Type': 'method.request.header.Content-Type',
        };
        mlSpaceRestApi.root.addMethod(
            'GET',
            new AwsIntegration({
                region: props.env?.region,
                service: 's3',
                path: `${props.websiteBucketName}/index.html`,
                integrationHttpMethod: 'GET',
                options: {
                    credentialsRole: props.websiteS3ReaderRole,
                    integrationResponses: proxyIntegrationResponse,
                    requestParameters: proxyIntegrationRequestParameters,
                },
            }),
            {
                methodResponses: proxyMethodResponse,
                requestParameters: proxyRequestParameters,
            }
        );

        mlSpaceRestApi.root.addResource('{proxy+}').addMethod(
            'GET',
            new AwsIntegration({
                region: props.env?.region,
                service: 's3',
                path: `${props.websiteBucketName}/{proxy}`,
                integrationHttpMethod: 'ANY',
                options: {
                    credentialsRole: props.websiteS3ReaderRole,
                    integrationResponses: proxyIntegrationResponse,
                    requestParameters: {
                        ...proxyIntegrationRequestParameters,
                        'integration.request.path.proxy': 'method.request.path.proxy',
                    },
                },
            }),
            {
                requestParameters: {
                    ...proxyRequestParameters,
                    'method.request.path.proxy': true,
                },
                methodResponses: proxyMethodResponse,
            }
        );

        const jwtDependencyLayer = createLambdaLayer(this, 'jwt');
        // Get common layer based on arn from SSM due to issues with cross stack references
        const commonLambdaLayer = LayerVersion.fromLayerVersionArn(
            this,
            'mls-common-lambda-layer',
            StringParameter.valueForStringParameter(this, props.mlspaceConfig.COMMON_LAYER_ARN_PARAM)
        );

        let ssmIdPEndpoint;
        if (props.mlspaceConfig.IDP_ENDPOINT_SSM_PARAM) {
            ssmIdPEndpoint = StringParameter.valueForStringParameter(this, props.mlspaceConfig.IDP_ENDPOINT_SSM_PARAM);
        }

        const authorizerLambda = new Function(this, 'MLSpaceAuthorizerLambda', {
            runtime: props.mlspaceConfig.LAMBDA_RUNTIME,
            architecture: props.mlspaceConfig.LAMBDA_ARCHITECTURE,
            handler: 'ml_space_lambda.authorizer.lambda_function.lambda_handler',
            functionName: 'mls-lambda-authorizer',
            code: Code.fromAsset(props.lambdaSourcePath),
            description: 'MLSpace Authentication and Authorization Lambda',
            timeout: Duration.seconds(30),
            memorySize: 512,
            role: props.mlSpaceAppRole,
            layers: [jwtDependencyLayer.layerVersion, commonLambdaLayer],
            environment: {
                OIDC_URL: ssmIdPEndpoint || props.mlspaceConfig.INTERNAL_OIDC_URL || props.mlspaceConfig.OIDC_URL,
                OIDC_CLIENT_NAME: props.mlspaceConfig.OIDC_CLIENT_NAME,
                OIDC_VERIFY_SSL: props.mlspaceConfig.OIDC_VERIFY_SSL ? 'True' : 'False',
                OIDC_VERIFY_SIGNATURE: props.verifyOIDCTokenSignature ? 'True' : 'False',
                ...props.mlspaceConfig.ADDITIONAL_LAMBDA_ENVIRONMENT_VARS,
            },
            vpc: props.mlSpaceVPC,
            securityGroups: props.lambdaSecurityGroups,
        });

        this.mlspaceRequestAuthorizer = new RequestAuthorizer(this, 'MLSpaceAPIGWAuthorizer', {
            handler: authorizerLambda,
            resultsCacheTtl: Duration.seconds(0),
            identitySources: [IdentitySource.header('Authorization')],
        });

        // Dynamic config relies on api URL and we don't want to do this in a separate stack
        const appEnvironmentConfig = {
            OIDC_URL: ssmIdPEndpoint ||  props.mlspaceConfig.OIDC_URL,
            OIDC_REDIRECT_URI:  props.mlspaceConfig.OIDC_REDIRECT_URI || mlSpaceRestApi.url,
            OIDC_CLIENT_NAME:  props.mlspaceConfig.OIDC_CLIENT_NAME,
            LAMBDA_ENDPOINT: mlSpaceRestApi.url,
            MANAGE_IAM_ROLES:  props.mlspaceConfig.MANAGE_IAM_ROLES,
            SHOW_MIGRATION_OPTIONS: props.enableMigrationUI,
            ENABLE_TRANSLATE: props.enableTranslate,
            ENABLE_GROUNDTRUTH: props.mlspaceConfig.ENABLE_GROUNDTRUTH,
            APPLICATION_NAME: props.mlspaceConfig.APPLICATION_NAME,
            DATASET_BUCKET: props.dataBucketName,
            AWS_REGION: props.mlspaceConfig.AWS_REGION,
            BACKGROUND_REFRESH_INTERVAL: props.mlspaceConfig.BACKGROUND_REFRESH_INTERVAL
        };

        // MLSpace static react app
        const websiteBucket = Bucket.fromBucketName(
            this,
            'mlspace-static-website-bucket',
            props.websiteBucketName
        );

        const frontEndDeployment = new BucketDeployment(this, 'MLSpaceFrontEndDeployment', {
            sources: [
                Source.asset(props.frontEndAssetsPath),
                Source.data('env.js', `window.env = ${JSON.stringify(appEnvironmentConfig)}`),
            ],
            destinationBucket: websiteBucket,
            prune: true,
            role: props.mlspaceConfig.BUCKET_DEPLOYMENT_ROLE_ARN
                ? Role.fromRoleArn(
                    this,
                    'mlspace-website-deploy-role',
                    props.mlspaceConfig.BUCKET_DEPLOYMENT_ROLE_ARN,
                    {
                        mutable: false,
                    }
                )
                : undefined,
        });

        if (props.isIso) {
            Aspects.of(frontEndDeployment).add(new ADCLambdaCABundleAspect());
            Aspects.of(authorizerLambda).add(new ADCLambdaCABundleAspect());
        }

        this.mlSpaceRestApiId = mlSpaceRestApi.restApiId;
        this.mlSpaceRestApiRootResourceId = mlSpaceRestApi.restApiRootResourceId;
    }
}
