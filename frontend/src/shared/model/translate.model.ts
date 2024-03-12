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

export type IJobDetails = {
    TranslatedDocumentsCount: number;
    DocumentsWithErrorsCount: number;
    InputDocumentsCount: number;
};

export enum FormalityOptions {
    Formal = 'FORMAL',
    Informal = 'INFORMAL',
    None = '',
}

export enum ProfanityOptions {
    Mask = 'MASK',
    NoMask = '',
}

export enum TranslateJobStatus {
    Submitted = 'SUBMITTED',
    InProgress = 'IN_PROGRESS',
    Completed = 'COMPLETED',
    CompletedWithError = 'COMPLETED_WITH_ERROR',
    Failed = 'FAILED',
    StopRequested = 'STOP_REQUESTED',
    Stopped = 'STOPPED',
}

export type IBatchSettings = {
    Formality?: FormalityOptions;
    Profanity?: ProfanityOptions;
};

export type IOutputDataConfig = {
    S3Uri: string;
    EncryptionKey?: IEncryptionKey;
};

export type IEncryptionKey = {
    Type: string;
    Id: string;
};

export type IError = {
    ErrorCode?: string;
    ErrorMessage?: string;
    S3ErrorLocation?: string;
};

export const defaultOutputDataConfig: IOutputDataConfig = {
    S3Uri: 'default',
};

export const defaultEncryptionKey: IEncryptionKey = {
    Type: '',
    Id: '',
};

export const defaultOutputDataConfigValue: Readonly<IOutputDataConfig> = defaultOutputDataConfig;

export enum ContentType {
    TEXT_HTML = 'text/html',
    TEXT_PLAIN = 'text/plain',
    WORD_DOC = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    POWER_POINT = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    XML = 'application/x-xliff+xml',
}

export type IInputDataConfig = {
    S3Uri: string;
    ContentType?: ContentType;
};

export const defaultInputDataConfig: IInputDataConfig = {
    S3Uri: 'default',
};

export const defaultInputDataConfigValue: Readonly<IInputDataConfig> = defaultInputDataConfig;

export type IBatchTranslate = {
    JobId?: string;
    JobName: string;
    JobStatus?: TranslateJobStatus;
    SourceLanguageCode: string;
    TargetLanguageCodes: string[];
    SubmittedTime?: string;
    EndTime?: string;
    InputDataConfig: IInputDataConfig;
    OutputDataConfig: IOutputDataConfig;
    DataAccessRoleArn?: string;
    TerminologyNames?: string;
    Settings?: IBatchSettings;
    JobDetails?: IJobDetails;
    Error?: IError;
};

export const defaultBatchJob: IBatchTranslate = {
    JobName: 'defaultBatchJobName',
    InputDataConfig: defaultInputDataConfig,
    OutputDataConfig: defaultOutputDataConfig,
    SourceLanguageCode: '',
    TargetLanguageCodes: [],
};

export const defaultValue: Readonly<IBatchTranslate> = defaultBatchJob;

export type IRealtimeTranslate = {
    Text?: string;
    Document?: {
        Content: number[];
        ContentType: string;
    };
    SourceLanguageCode: string;
    TargetLanguageCode: string;
    TerminologyNames: string[];
    Settings?: {
        Formality?: string;
        Profanity?: string;
    };
};

export const defaultRealtimeTextTranslateRequest: Readonly<IRealtimeTranslate> = {
    Text: '',
    SourceLanguageCode: 'auto',
    TargetLanguageCode: 'en',
    Settings: {},
    TerminologyNames: [],
};

export const defaultRealtimeDocumentTranslateRequest: Readonly<IRealtimeTranslate> = {
    Document: {
        Content: [],
        ContentType: 'text/plain',
    },
    SourceLanguageCode: 'auto',
    TargetLanguageCode: 'en',
    Settings: {},
    TerminologyNames: [],
};
