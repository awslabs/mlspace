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
import {
    AccountRootPrincipal,
    Effect,
    PolicyDocument,
    PolicyStatement,
    Role,
} from 'aws-cdk-lib/aws-iam';
import { IKey, Key } from 'aws-cdk-lib/aws-kms';
import { MLSpaceConfig } from '../utils/configTypes';

export type KMSStackProp = {
    readonly keyManagerRoleName: string;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class KMSStack extends Stack {
    public masterKey: IKey;

    constructor (parent: App, name: string, props: KMSStackProp) {
        super(parent, name, {
            terminationProtection: false,
            ...props,
        });

        if (props.mlspaceConfig.EXISTING_KMS_MASTER_KEY_ARN) {
            this.masterKey = Key.fromKeyArn(this, 'imported-kms-key', props.mlspaceConfig.EXISTING_KMS_MASTER_KEY_ARN);
        } else {
            this.masterKey = new Key(this, 'mlspace-kms-key', {
                policy: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            principals: [new AccountRootPrincipal()],
                            actions: ['kms:*'],
                            resources: ['*'],
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            principals: [
                                Role.fromRoleName(
                                    this,
                                    'mlspace-keymanager-role',
                                    props.keyManagerRoleName
                                ),
                            ],
                            actions: [
                                'kms:Create*',
                                'kms:Describe*',
                                'kms:Enable*',
                                'kms:List*',
                                'kms:Put*',
                                'kms:Update*',
                                'kms:Revoke*',
                                'kms:Disable*',
                                'kms:Get*',
                                'kms:Delete*',
                                'kms:TagResource',
                                'kms:UntagResource',
                                'kms:ScheduleKeyDeletion',
                                'kms:CancelKeyDeletion',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
                alias: 'alias/mlspace-key',
                description: 'KMS key for encrypting the objects in an S3 bucket',
                enableKeyRotation: false,
            });
        }
    }
}
