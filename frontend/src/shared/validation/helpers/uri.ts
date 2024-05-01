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
import { z, ZodString } from 'zod';
import { errorUtil } from 'zod/lib/helpers/errorUtil';

declare module 'zod' {
    interface ZodString {
        s3Uri(message?: errorUtil.ErrMessage): ZodString;
        s3Prefix(message?: errorUtil.ErrMessage): ZodString;
        s3Resource(message?: errorUtil.ErrMessage): ZodString;
        datasetUri(message?: errorUtil.ErrMessage): ZodString;
        datasetPrefix(message?: errorUtil.ErrMessage): ZodString;
        datasetResource(message?: errorUtil.ErrMessage): ZodString;
    }
}

ZodString.prototype.s3Uri = function (message?: errorUtil.ErrMessage): z.ZodString {
    const defaultMessage = 'Must be a valid S3 URI';
    return z.string().regex(/s3:\/\/(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/((?<prefix>(.+?\/)+)?(?<object>[^/]+)?)?$/, message || defaultMessage);
};

ZodString.prototype.s3Prefix = function (message?: errorUtil.ErrMessage): z.ZodString {
    const defaultMessage = 'Must be a valid S3 URI for a prefix that ends with `/`';
    return z.string().regex(/s3:\/\/(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/(?<prefix>(.+?\/)+)?$/, message || defaultMessage);
};

ZodString.prototype.s3Resource = function (message?: errorUtil.ErrMessage): z.ZodString {
    const defaultMessage = 'Must be a valid S3 URI for an object (not ending with `/`)';
    return z.string().regex(/s3:\/\/(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/(?<prefix>(.+?\/)+)?(?<object>[^/]+)$/, message || defaultMessage);
};

ZodString.prototype.datasetUri = function (message?: errorUtil.ErrMessage): z.ZodString {
    const defaultMessage = 'Must be a valid S3 URI to a Dataset prefix or object';
    return z.string().regex(/^s3:\/\/(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/(?<type>global|(private|project)\/(?<scope>.+))\/datasets\/(?<name>.+)\/(?<location>(?<prefix>(.+?\/)+)?(?<object>.+)?)$/, message || defaultMessage);
};

ZodString.prototype.datasetPrefix = function (message?: errorUtil.ErrMessage): z.ZodString {
    const defaultMessage = 'Must be a valid S3 URI to a Dataset prefix';
    return z.string().regex(/^s3:\/\/(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/(?<type>global|(private|project)\/(?<scope>.+))\/datasets\/(?<name>.+)\/(?<location>(?<prefix>(.+?\/)+)?)$/, message || defaultMessage);
};

ZodString.prototype.datasetResource = function (message?: errorUtil.ErrMessage): z.ZodString {
    const defaultMessage = 'Must be a valid S3 URI to a Dataset object';
    return z.string().regex(/^s3:\/\/(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/(?<type>global|(private|project)\/(?<scope>.+))\/datasets\/(?<name>.+)\/(?<location>(?<prefix>(.+?\/)+)?(?<object>[^/]+))$/, message || defaultMessage);
};