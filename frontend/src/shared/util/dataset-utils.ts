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

import { DatasetType } from '../model';

const datasetRegex = new RegExp('s3://(.*?)/(.*)/datasets/(.*?)/(.*)');

export const datasetFromS3Uri = (s3Uri: string): {
    Type: DatasetType;
    Name?: string;
    Location?: string;
} | undefined => {
    // Example: s3://mlspace-data-<acc-id>/<type(/subtype - optional)>/datasets/<ds-name>/train/
    if (s3Uri) {
        // matches[0] will be the entire string matched by the regex and the rest are the captures
        const matches = s3Uri.match(datasetRegex);
        if (matches?.length === 5) {
            let type = '';
            // Match 2 will either be "global", "private/<username>", or "project/<projectname>"
            const slashIndex = matches[2].indexOf('/');
            // For private and project just return the type
            if (slashIndex > 0) {
                type = matches[2].slice(0, slashIndex);
            } else {
                type = matches[2];
            }
            const dataset = {
                Type: type as DatasetType,
                Name: matches[3],
                Location: matches[4],
            };
            return dataset;
        }
    }
    return undefined;
};
