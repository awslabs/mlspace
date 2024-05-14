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

// arn:partition:service:region:account-id:resource-type/resource-id
const arnRegex = new RegExp('arn:(.*?):(.*?):(.*?):(.*?):(.*)');

export type Arn = {
    partition: string,
    service: string,
    region: string,
    accountId: string,
    resourceType?: string,
    resourceId: string
};

export const arnStringToObject = (arn: string) : Arn => {
    const matches = arn.match(arnRegex);

    if (matches?.length >= 6) {
        // Check if there is a resource type
        const slashIndex = matches[5].indexOf('/') > 0 ? matches[5].indexOf('/') : matches[5].indexOf(':') > 0 ? matches[5].indexOf(':') : undefined;

        const result = {
            partition: matches[1],
            service: matches[2],
            region: matches[3],
            accountId: matches[4],
            resourceId: matches[5]
        };
    
        if (slashIndex > 0){
            result.resourceType = matches[5].slice(0, slashIndex);
            result.resourceId = matches[5].slice(slashIndex + 1);
        }
    
        return result;
    } else {
        throw new TypeError('Invalid ARN string provided');
    }
};
