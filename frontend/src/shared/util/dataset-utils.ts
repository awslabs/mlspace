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

export type DatasetContext = {
    location?: string
    name: string,
    type: DatasetType,
    scope?: string
};

export const datasetFromS3Uri = (s3Uri: string): DatasetContext | undefined => {
    // Example: s3://mlspace-data-<acc-id>/<type(/subtype - optional)>/datasets/<ds-name>/train/
    if (s3Uri) {
        const matches = datasetComponents(s3Uri);

        if (matches.type && matches.name) {
            return {
                location: matches?.location,
                name: matches.name,
                type: matches.type as DatasetType,
                scope: matches?.scope
            };
        }
    }
};

export type DatasetComponentsMatch = {
    bucket?: string,
    location?: string,
    name?: string,
    object?: string
    prefix?: string,
    scope?: string,
    type?: string,
};

export const datasetComponents = (path?: string): DatasetComponentsMatch => {
    return path?.match(/^s3:\/\/(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/(?<type>global|(private|project))(\/(?<scope>[^/]+))?\/datasets\/(?<name>[^/]+)\/(?<location>(?<prefix>([^/]+\/)+)?(?<object>[^/]+)?)$/)?.groups || {};
};