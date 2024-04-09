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

import { App, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { CfnNotebookInstanceLifecycleConfig } from 'aws-cdk-lib/aws-sagemaker';
import { readFileSync } from 'fs';
import { MLSpaceConfig } from '../../utils/configTypes';

export type SagemakerStackProp = {
    readonly dataBucketName: string;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class SagemakerStack extends Stack {
    constructor (parent: App, name: string, props: SagemakerStackProp) {
        super(parent, name, {
            terminationProtection: false,
            ...props,
        });

        new CfnNotebookInstanceLifecycleConfig(this, 'mlspace-notebook-lifecycle-config', {
            notebookInstanceLifecycleConfigName: props.mlspaceConfig.MLSPACE_LIFECYCLE_CONFIG_NAME,
            onCreate: [
                {
                    content: Fn.base64(
                        readFileSync('lib/resources/sagemaker/lifecycle-create.sh', 'utf8').replace(
                            /<DATA_BUCKET_NAME>/g,
                            props.dataBucketName
                        )
                    ),
                },
            ],
            onStart: [
                {
                    content: Fn.base64(
                        readFileSync('lib/resources/sagemaker/lifecycle-start.sh', 'utf8')
                            .replace(/<BANNER_COLOR>/g, props.mlspaceConfig.SYSTEM_BANNER_BACKGROUND_COLOR)
                            .replace(
                                /<BANNER_TEXT_COLOR>/g,
                                props.mlspaceConfig.SYSTEM_BANNER_TEXT_COLOR
                            )
                            .replace(/<BANNER_TEXT>/g, props.mlspaceConfig.SYSTEM_BANNER_TEXT)
                    ),
                },
            ],
        });
    }
}
