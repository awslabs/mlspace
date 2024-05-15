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

import { describe, test, expect } from '@jest/globals';
import { arnStringToObject } from './arn-utils';

describe('Test arnStringToObject', () => {
    /**
     * Testing valid ARN inputs
     */
    test.concurrent.each([
        [
            'arn:aws:lambda:us-east-1:123456789012:function:mls-lambda-dataset-create_dataset', 
            {
                partition: 'aws',
                service: 'lambda',
                region: 'us-east-1',
                accountId: '123456789012',
                resourceType: 'function',
                resourceId: 'mls-lambda-dataset-create_dataset'
            }
        ],
        [
            'arn:aws:lambda:us-east-1:123456789012:function/mls-lambda-dataset-create_dataset', 
            {
                partition: 'aws',
                service: 'lambda',
                region: 'us-east-1',
                accountId: '123456789012',
                resourceType: 'function',
                resourceId: 'mls-lambda-dataset-create_dataset'
            }
        ],
        [
            'arn:aws:sns:us-east-1:123456789012:example-sns-topic-name', 
            {
                partition: 'aws',
                service: 'sns',
                region: 'us-east-1',
                accountId: '123456789012',
                resourceId: 'example-sns-topic-name'
            }
        ]
    ])('convert ARN string', (input, expected) => {
        expect(arnStringToObject(input)).toStrictEqual(expected);
    });

    /**
     * Testing invalid ARN input handling
     */
    test.concurrent('invalid ARN', async () => {
        expect(() => {
            arnStringToObject('not:valid:arn');
        }).toThrow(TypeError);
    });    
});
