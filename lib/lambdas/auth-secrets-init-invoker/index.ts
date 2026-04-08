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

import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';

const physicalId = 'mlspace-auth-secrets-versioned-json-v1';

export async function handler (
    event: CloudFormationCustomResourceEvent
): Promise<{ PhysicalResourceId: string }> {
    if (event.RequestType === 'Delete') {
        return { PhysicalResourceId: event.PhysicalResourceId || physicalId };
    }
    const target = process.env.TARGET_FUNCTION_NAME;
    if (!target) {
        throw new Error('TARGET_FUNCTION_NAME is not set');
    }
    const client = new LambdaClient({ region: process.env.AWS_REGION });
    const result = await client.send(
        new InvokeCommand({
            FunctionName: target,
            InvocationType: 'RequestResponse',
            Payload: new Uint8Array(Buffer.from('{}')),
        })
    );
    if (result.StatusCode === undefined || result.StatusCode < 200 || result.StatusCode >= 300) {
        throw new Error(`Lambda invoke failed with status ${result.StatusCode}`);
    }
    if (result.FunctionError) {
        let detail = '';
        try {
            const raw = result.Payload ? Buffer.from(result.Payload).toString() : '';
            detail = raw ? JSON.stringify(JSON.parse(raw)) : '';
        } catch {
            detail = result.Payload ? Buffer.from(result.Payload).toString() : '';
        }
        throw new Error(`${result.FunctionError}: ${detail}`);
    }
    return { PhysicalResourceId: physicalId };
}
