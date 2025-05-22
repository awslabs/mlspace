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

import { Fn, Stack, StackProps } from 'aws-cdk-lib';
import { CfnNotebookInstanceLifecycleConfig } from 'aws-cdk-lib/aws-sagemaker';
import { readFileSync } from 'fs';
import { MLSpaceConfig } from '../../utils/configTypes';
import { Construct } from 'constructs';

export type SagemakerStackProp = {
    readonly dataBucketName: string;
    readonly mlspaceConfig: MLSpaceConfig;
} & StackProps;

export class SagemakerConstruct extends Construct {
    constructor (scope: Stack, id: string, props: SagemakerStackProp) {
        super(scope, id);

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
                    ),
                },
            ],
        });
    }
}
