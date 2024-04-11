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
import { datasetFromS3Uri, datasetComponents } from './dataset-utils';
import { DatasetType } from '../model';

describe('Test datasetFromS3Uri', () => {
    test('invalid URI', () => {
        expect(datasetFromS3Uri('s3://bucket/private/userName/datasets/')).toBe(undefined);
        expect(datasetFromS3Uri('s3://bucket/global/datasets/datasetName')).toBe(undefined);
    });

    test('dataset resources', () => {
        expect(datasetFromS3Uri('s3://bucket/global/datasets/datasetName/prefix/object')).toMatchObject({
            type: DatasetType.GLOBAL,
            name: 'datasetName',
            location: 'prefix/object',
        });
        
        expect(datasetFromS3Uri('s3://bucket/project/projectName/datasets/datasetName/prefix/object')).toMatchObject({
            type: DatasetType.PROJECT,
            name: 'datasetName',
            scope: 'projectName',
            location: 'prefix/object',
        });

        expect(datasetFromS3Uri('s3://bucket/private/userName/datasets/datasetName/prefix/object')).toMatchObject({
            type: DatasetType.PRIVATE,
            name: 'datasetName',
            scope: 'userName',
            location: 'prefix/object',
        });
    });
});

describe('Test datasetComponents', () => {
    test('invalid URI', () => {
        // must be formatted as expected
        expect(datasetComponents('s3://bucket/global/userName/datasets/datasetName')).toMatchObject({});
        expect(datasetComponents('s3://bucket/project/datasets/datasetName')).toMatchObject({});
        expect(datasetComponents('s3://bucket/private/datasets/datasetName')).toMatchObject({});

        // must end with /
        expect(datasetComponents('s3://bucket/global/datasets/datasetName')).toMatchObject({});
        expect(datasetComponents('s3://bucket/project/projectName/datasets/datasetName')).toMatchObject({});
        expect(datasetComponents('s3://bucket/private/userName/datasets/datasetName')).toMatchObject({});
    });

    test('naked datasets', () => {
        expect(datasetComponents('s3://bucket/global/datasets/datasetName/')).toMatchObject({
            type: DatasetType.GLOBAL,
            name: 'datasetName',
        });
        
        expect(datasetComponents('s3://bucket/project/projectName/datasets/datasetName/')).toMatchObject({
            type: DatasetType.PROJECT,
            name: 'datasetName',
            scope: 'projectName'
        });

        expect(datasetComponents('s3://bucket/private/userName/datasets/datasetName/')).toMatchObject({
            type: DatasetType.PRIVATE,
            name: 'datasetName',
            scope: 'userName'
        });
    });

    test('dataset prefixes', () => {
        expect(datasetComponents('s3://bucket/global/datasets/datasetName/prefix/')).toMatchObject({
            type: DatasetType.GLOBAL,
            name: 'datasetName',
            location: 'prefix/',
            prefix: 'prefix/'
        });
        
        expect(datasetComponents('s3://bucket/project/projectName/datasets/datasetName/prefix/')).toMatchObject({
            type: DatasetType.PROJECT,
            name: 'datasetName',
            scope: 'projectName',
            location: 'prefix/',
            prefix: 'prefix/'
        });

        expect(datasetComponents('s3://bucket/private/userName/datasets/datasetName/prefix/')).toMatchObject({
            type: DatasetType.PRIVATE,
            name: 'datasetName',
            scope: 'userName',
            location: 'prefix/',
            prefix: 'prefix/'
        });
    });

    test('dataset resources', () => {
        expect(datasetComponents('s3://bucket/global/datasets/datasetName/prefix/object')).toMatchObject({
            type: DatasetType.GLOBAL,
            name: 'datasetName',
            location: 'prefix/object',
            prefix: 'prefix/',
            object: 'object'
        });
        
        expect(datasetComponents('s3://bucket/project/projectName/datasets/datasetName/prefix/object')).toMatchObject({
            type: DatasetType.PROJECT,
            name: 'datasetName',
            scope: 'projectName',
            location: 'prefix/object',
            prefix: 'prefix/',
            object: 'object'
        });

        expect(datasetComponents('s3://bucket/private/userName/datasets/datasetName/prefix/object')).toMatchObject({
            type: DatasetType.PRIVATE,
            name: 'datasetName',
            scope: 'userName',
            location: 'prefix/object',
            prefix: 'prefix/',
            object: 'object'
        });
    });
});