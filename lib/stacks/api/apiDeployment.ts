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