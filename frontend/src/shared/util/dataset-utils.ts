/*
 * Your use of this service is governed by the terms of the AWS Customer Agreement
 * (https://aws.amazon.com/agreement/) or other agreement with AWS governing your use of
 * AWS services. Each license to use the service, including any related source code component,
 * is valid for use associated with the related specific task-order contract as defined by
 * 10 U.S.C. 3401 and 41 U.S.C. 4101.
 *
 * Copyright 2023 Amazon.com, Inc. or its affiliates. All Rights Reserved. This is AWS Content
 * subject to the terms of the AWS Customer Agreement.
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
