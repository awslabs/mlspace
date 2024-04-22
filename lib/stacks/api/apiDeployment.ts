import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Deployment, RestApi } from 'aws-cdk-lib/aws-apigateway';

export type ApiDeploymentStackProps = {
    readonly restApiId: string;
} & StackProps;

export class ApiDeploymentStack extends Stack {
    constructor (parent: App, name: string, props: ApiDeploymentStackProps) {
        super(parent, name, {
            terminationProtection: false,
            ...props,
        });

        // Use timestamp in logical id to force an API deployment
        // Related CDK issues:
        // https://github.com/aws/aws-cdk/issues/12417
        // https://github.com/aws/aws-cdk/issues/13383
        const deployment = new Deployment(this, `ApiDeployment-${new Date().getTime()}`, {
            api: RestApi.fromRestApiId(this, 'MLSpaceRestApiRef', props.restApiId),
        });
        // This hack will allow us to redeploy to an existing stage but once CDK
        // adds first class support for this we will migrate
        // https://github.com/aws/aws-cdk/issues/25582
        (deployment as any).resource.stageName = 'Prod';
    }
}