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
import React, { useState } from 'react';
import { Button, FileUpload, FormField, Select, SpaceBetween } from '@cloudscape-design/components';
import { z } from 'zod';
import { AdditionalSettings, LanguageSelects } from './translate-realtime.common';
import _ from 'lodash';
import axios from '../../shared/util/axios-utils';
import {
    defaultRealtimeDocumentTranslateRequest,
    IRealtimeTranslate,
} from '../../shared/model/translate.model';
import { scrollToInvalid } from '../../shared/validation';
import { AxiosError, AxiosResponse } from 'axios';
import NotificationService from '../../shared/layout/notification/notification.service';
import { useAppDispatch } from '../../config/store';
import { findOptionByValue } from '../../shared/util/select-utils';
import { OptionDefinition } from '@cloudscape-design/components/internal/components/option/interfaces';

/**
 * The React component that populates the 'Document' tab for Translate real-time
 * @param props Properties that are required for the document tab to operate
 */
export const TranslateRealtimeDocument = () => {
    // The available options for translate_document
    // There doesn't appear to be an API for retrieving this currently
    // See: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/translate/client/translate_document.html
    const plainTextOption: OptionDefinition = {
        label: 'Plain text (.txt)',
        value: 'text/plain',
    };
    const docTypeOptions: OptionDefinition[] = [
        plainTextOption,
        { label: 'HTML (.html)', value: 'text/html' },
        {
            label: 'Word document (.docx)',
            value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
    ];

    const [uploadFile, setUploadFile] = useState<File[]>([]);
    const [fileName, setFileName] = useState<string>();
    const [docType, setDocType] = useState<OptionDefinition>(plainTextOption);
    const [formSubmitting, setFormSubmitting] = useState(false);
    const translateDocErrorRegex = /TranslateDocument operation: /gm;
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);

    const documentFormSchema = z.object({
        Document: z.object({
            Content: z
                .array(z.number())
                .refine((array: Array<number>) => new Uint8Array(array).byteLength < 100000, {
                    message: 'The document size must be less than 100KB',
                }),
        }),
    });

    const translateRequest: IRealtimeTranslate = defaultRealtimeDocumentTranslateRequest;

    /**
     * Handle the updates for the real-time translate document request
     */
    const handleUpdate = (updates?: Record<string, any>) => {
        _.mergeWith(translateRequest, updates);
        // We could also update the lambda to handle this instead but for now strip out values if
        // profanity is null or formality is None
        if (translateRequest.Settings?.Profanity === null) {
            delete translateRequest.Settings.Profanity;
        }
        if (translateRequest.Settings?.Formality === null) {
            delete translateRequest.Settings.Formality;
        }
        if (
            translateRequest.TerminologyNames.length > 0 &&
            updates?.TerminologyNames &&
            (updates?.TerminologyNames.length === 0 || updates?.TerminologyNames[0] === undefined)
        ) {
            translateRequest.TerminologyNames.length = 0;
        }
        // Override the document content (merge doesn't work if current content length exceeds updated content length)
        if (translateRequest?.Document && updates?.Document && updates.Document.Content) {
            translateRequest.Document.Content = updates.Document.Content;
        }
    };

    const automaticallyDownloadFileFromResponse = (response: AxiosResponse) => {
        const fileBlob = new Blob([new Uint8Array(response.data.TranslatedDocument.Content)]);
        const downloadUrl = window.URL.createObjectURL(fileBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.setAttribute('download', `${translateRequest.TargetLanguageCode}.${fileName}`);
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.parentNode!.removeChild(downloadLink);
    };

    const handleSubmit = async () => {
        const parseResult = documentFormSchema.safeParse(translateRequest);

        if (parseResult.success) {
            try {
                setFormSubmitting(true);
                const response = await axios.post('/translate/realtime/document', translateRequest);
                automaticallyDownloadFileFromResponse(response);
                notificationService.generateNotification(
                    `Your ${fileName} document was translated successfully.`,
                    'success'
                );
                // Remove the current file - behavior from the console
                setUploadFile([]);
            } catch (err) {
                let errorMessage = '';
                if (err instanceof AxiosError && err.response) {
                    translateDocErrorRegex.exec(err.response.data);
                    if (translateDocErrorRegex.lastIndex > 0) {
                        errorMessage = `Translate Document Processing Error: ${err.response.data.substring(
                            translateDocErrorRegex.lastIndex
                        )}`;
                    } else {
                        errorMessage = err.response.data;
                    }
                } else if (err instanceof Error) {
                    errorMessage = err.message;
                } else {
                    errorMessage = 'Encountered an unknown error';
                }
                notificationService.generateNotification(errorMessage, 'error');
            } finally {
                setFormSubmitting(false);
            }
        } else {
            scrollToInvalid();
        }
    };

    /**
     * The contents of the 'Document' tab for Translate real-time
     */
    return (
        <SpaceBetween direction='vertical' size='l'>
            <LanguageSelects translateRequest={translateRequest} changeCallback={handleUpdate} />
            <FormField label='Upload file'>
                <FileUpload
                    onChange={({ detail }) => {
                        setUploadFile(detail.value);
                        if (detail.value.length > 0) {
                            const foundDocType = findOptionByValue(
                                docTypeOptions,
                                detail.value[0].type
                            ) as OptionDefinition;
                            if (foundDocType !== undefined) {
                                setDocType(foundDocType);
                                handleUpdate({ Document: { ContentType: foundDocType.value } });
                            } else {
                                notificationService.generateNotification(
                                    'Uploaded file was not of the currently accepted file types: .txt, .html, or .docx',
                                    'warning'
                                );
                            }
                            setFileName(detail.value[0].name);
                            const fr = new FileReader();
                            // When the file reader has completed a read
                            fr.onload = () => {
                                // Ensure that a valid result was read
                                if (fr.result != null && fr.result instanceof ArrayBuffer) {
                                    // Set the document so that it can be transmitted in form submission
                                    // Since typescript doesn't support bytes as a type we will use Uint8Array which can be decoded by Python into bytes
                                    handleUpdate({
                                        Document: {
                                            Content: Array.from(new Uint8Array(fr.result)),
                                        },
                                    });
                                }
                            };
                            // We can only take one file as is currently supported by translate_document
                            // By default FileUpload is a single file upload and so the list will only contain one element
                            fr.readAsArrayBuffer(detail.value[0]);
                        }
                    }}
                    value={uploadFile}
                    i18nStrings={{
                        uploadButtonText: (e) => (e ? 'Choose files' : 'Choose file'),
                        dropzoneText: (e) => (e ? 'Drop files to upload' : 'Drop file to upload'),
                        removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                        limitShowFewer: 'Show fewer files',
                        limitShowMore: 'Show more files',
                        errorIconAriaLabel: 'Error',
                    }}
                    showFileLastModified
                    showFileSize
                    showFileThumbnail
                    constraintText="The maximum file size is 100 KB. See the 'Document type' options below for valid file types."
                />
            </FormField>
            <FormField label='Document type'>
                <Select
                    selectedOption={docType}
                    onChange={({ detail }) => {
                        setDocType(detail.selectedOption);
                        handleUpdate({ Document: { ContentType: detail.selectedOption.value } });
                    }}
                    options={docTypeOptions}
                />
            </FormField>
            <AdditionalSettings translateRequest={translateRequest} changeCallback={handleUpdate} />
            <Button
                variant='primary'
                onClick={() => {
                    handleSubmit();
                }}
                loading={formSubmitting}
                disabled={uploadFile.length === 0 || formSubmitting}
            >
                Translate and download
            </Button>
        </SpaceBetween>
    );
};
