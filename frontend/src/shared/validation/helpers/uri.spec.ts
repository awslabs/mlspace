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
import './uri';
import { z } from 'zod';

describe('Test Zod URI Validator Extensions', () => {
    const testUris = {
        bucket: {
            valid: [
                // bucket can contain alphanumeric, hyphens, periods
                's3://valid-bucket.name/',
            ],
            invalid: [
                // too short (bucket must be 3 chars)
                's3://iv',
                's3://iv/',

                // bucket must begin and end with alphanumeric char
                's3://iv-',
                's3://iv-/',
                's3://-iv',
                's3://-iv/',

                // bucket can't contain spaces
                's3://invalid bucket',
                's3://invalid bucket/',
                's3://valid-bucket',
            ]
        },
        s3ObjectKey: {
            valid: [
                // be lenient with key characters
                's3://valid-bucket/path to object',
                's3://valid-bucket/path@to!object',
                's3://valid-bucket/path🔥to🔥object',
            ],
            invalid: [

            ]
        },
        s3PrefixKey: {
            valid: [
                // be lenient with key characters
                's3://valid-bucket/path to object/',
                's3://valid-bucket/path@to!object/',
                's3://valid-bucket/path🔥to🔥object/',
            ],
            invalid: [

            ]
        },
        datasetObjectKey: {
            valid: [
                // objects must not end with /
                's3://valid-bucket/global/datasets/datasetName/object',
                's3://valid-bucket/project/projectName/datasets/datasetName/object',
                's3://valid-bucket/private/userName/datasets/datasetName/object',
                's3://valid-bucket/global/datasets/datasetName/path/to/object',
                's3://valid-bucket/project/projectName/datasets/datasetName/path/to/object',
                's3://valid-bucket/private/userName/datasets/datasetName/path/to/object',

                // be lenient with key characters
                's3://valid-bucket/private/userName/datasets/datasetName/path@to!object',
                's3://valid-bucket/private/userName/datasets/datasetName/path🔥to🔥object',
                's3://valid-bucket/private/userName/datasets/datasetName/path@to!/object',
                's3://valid-bucket/private/userName/datasets/datasetName/path🔥to🔥/object',
            ],
            invalid: [
                // global must not have scope
                's3://valid-bucket/global/projectName/datasets/datasetName/object',

                // project and private must have a scope
                's3://valid-bucket/project/datasets/datasetName/object',
                's3://valid-bucket/private/datasets/datasetName/object',
            ]
        },
        datasetPrefixKey: {
            valid: [
                // datasets and prefixes must end with /
                's3://valid-bucket/global/datasets/datasetName/',
                's3://valid-bucket/project/projectName/datasets/datasetName/',
                's3://valid-bucket/private/userName/datasets/datasetName/',
                's3://valid-bucket/global/datasets/datasetName/path/',
                's3://valid-bucket/project/projectName/datasets/path/',
                's3://valid-bucket/private/userName/datasets/datasetName/path/',

                // be lenient with key characters
                's3://valid-bucket/private/userName/datasets/datasetName/path@to!object/',
                's3://valid-bucket/private/userName/datasets/datasetName/path🔥to🔥object/',
            ],
            invalid: [
                // global must not have scope
                's3://valid-bucket/global/projectName/datasets/datasetName/',

                // project and private must have a scope
                's3://valid-bucket/project/datasets/datasetName/',
                's3://valid-bucket/private/datasets/datasetName/',
            ]
        }
    };

    test('s3Uri', () => {
        testUris.bucket.invalid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeFalsy());
        testUris.bucket.valid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeTruthy());
        testUris.s3PrefixKey.invalid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.valid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeTruthy());
        testUris.s3ObjectKey.invalid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.valid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeTruthy());
        testUris.datasetPrefixKey.invalid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeTruthy());
        testUris.datasetPrefixKey.valid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeTruthy());
        testUris.datasetObjectKey.invalid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeTruthy());
        testUris.datasetObjectKey.valid.forEach((value) => expect(z.string().s3Uri().safeParse(value).success).toBeTruthy());
    });

    test('s3Prefix', () => {
        testUris.bucket.invalid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeFalsy());
        testUris.bucket.valid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeTruthy());
        testUris.s3PrefixKey.invalid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.valid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeTruthy());
        testUris.s3ObjectKey.invalid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.valid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeFalsy());
        testUris.datasetPrefixKey.invalid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeTruthy());
        testUris.datasetPrefixKey.valid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeTruthy());
        testUris.datasetObjectKey.invalid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeFalsy());
        testUris.datasetObjectKey.valid.forEach((value) => expect(z.string().s3Prefix().safeParse(value).success).toBeFalsy());
    });

    test('s3Resource', () => {
        testUris.bucket.invalid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeFalsy());
        testUris.bucket.valid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.invalid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.valid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.invalid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.valid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeTruthy());
        testUris.datasetPrefixKey.invalid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeFalsy());
        testUris.datasetPrefixKey.valid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeFalsy());
        testUris.datasetObjectKey.invalid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeTruthy());
        testUris.datasetObjectKey.valid.forEach((value) => expect(z.string().s3Resource().safeParse(value).success).toBeTruthy());
    });

    test('datasetUri', () => {
        testUris.bucket.invalid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeFalsy());
        testUris.bucket.valid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.invalid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.valid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.invalid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.valid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeFalsy());
        testUris.datasetPrefixKey.invalid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeFalsy());
        testUris.datasetPrefixKey.valid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeTruthy());
        testUris.datasetObjectKey.invalid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeFalsy());
        testUris.datasetObjectKey.valid.forEach((value) => expect(z.string().datasetUri().safeParse(value).success).toBeTruthy());
    });

    test('datasetPrefix', () => {
        testUris.bucket.invalid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
        testUris.bucket.valid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.invalid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.valid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.invalid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.valid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
        testUris.datasetPrefixKey.invalid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
        testUris.datasetPrefixKey.valid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeTruthy());
        testUris.datasetObjectKey.invalid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
        testUris.datasetObjectKey.valid.forEach((value) => expect(z.string().datasetPrefix().safeParse(value).success).toBeFalsy());
    });

    test('datasetResource', () => {
        testUris.bucket.invalid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.bucket.valid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.invalid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.s3PrefixKey.valid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.invalid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.s3ObjectKey.valid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.datasetPrefixKey.invalid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.datasetPrefixKey.valid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.datasetObjectKey.invalid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeFalsy());
        testUris.datasetObjectKey.valid.forEach((value) => expect(z.string().datasetResource().safeParse(value).success).toBeTruthy());
    });
});