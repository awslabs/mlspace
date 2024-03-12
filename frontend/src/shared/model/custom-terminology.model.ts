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

import { IEncryptionKey } from './translate.model';

export enum Directionality {
    Uni = 'UNI',
    Multi = 'MULTI',
}

export enum Format {
    CSV = 'CSV',
    TMX = 'TMX',
    TSV = 'TSV',
}

export type ICustomTerminology = {
    Name?: string;
    Description?: string;
    Arn?: string;
    SourceLanguageCode?: string;
    TargetLanguageCodes?: string[];
    EncryptionKey?: IEncryptionKey;
    SizeBytes?: number;
    TermCount?: number;
    CreatedAt?: string;
    LastUpdatedAt?: string;
    Directionality?: Directionality;
    Message?: string;
    SkippedTermCount?: number;
    Format?: Format;
};

export const defaultCustomTerminology: ICustomTerminology = {
    Name: 'defaultCustomTerminology',
};
