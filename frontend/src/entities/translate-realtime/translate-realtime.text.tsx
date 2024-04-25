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
import {
    ColumnLayout,
    FormField,
    Header,
    SpaceBetween,
    Textarea,
} from '@cloudscape-design/components';
import { AdditionalSettings, LanguageSelects } from './translate-realtime.common';
import { z } from 'zod';
import axios from '../../shared/util/axios-utils';
import { defaultRealtimeTextTranslateRequest } from '../../shared/model/translate.model';
import Condition from '../../modules/condition';
import Table from '../../modules/table';
import { scrollToInvalid } from '../../shared/validation';
import { useDebounce } from '../../shared/util/hooks';

/**
 * The React component that populates the 'Text' tab for Translate real-time
 * @param props Properties that are required for the document tab to operate
 */
export const TranslateRealtimeText = () => {
    const [translatedText, setTranslatedText] = useState('');
    const [textToTranslate, setTextToTranslate] = useState('');
    const [textError, setTextError] = useState('');
    const [terminologyMatches, setTerminologyMatches] = useState<
        { SourceText: string; TargetText: string }[]
    >([]);
    // The only customer controlled input that needs validation is the text to be translated, which must be under 10KB
    const textFormSchema = z.object({
        Text: z
            .string()
            // The size can't be over 10KB
            .refine((str) => new Blob([str]).size < 10000),
    });
    const translateRequest = defaultRealtimeTextTranslateRequest;

    /**
     * Handle the submission of realtime translation requests for both text and document translation
     */
    const handleSubmit = async (updates?: Record<string, any>) => {
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

        if (translateRequest.Text!.length > 0) {
            const parseResult = textFormSchema.safeParse(translateRequest);

            if (parseResult.success) {
                const response = await axios.post('/translate/realtime/text', translateRequest);
                setTranslatedText(response.data.TranslatedText);
                if (response!.data.AppliedTerminologies?.length > 0) {
                    setTerminologyMatches(response!.data.AppliedTerminologies[0].Terms || []);
                } else {
                    setTerminologyMatches([]);
                }
                setTextError('');
            } else {
                setTextError('Source text must be a string less than 10KB.');
                scrollToInvalid();
            }
        }
    };

    // Once the delay has concluded update the primary form Text. This will trigger a form submission
    const debounceFormTextUpdate = useDebounce(() => {
        handleSubmit({ Text: textToTranslate });
    }, 400, [textToTranslate]);

    /**
     * The contents of the 'Text' tab for Translate real-time
     */
    return (
        <SpaceBetween direction='vertical' size='xxl'>
            <SpaceBetween direction='vertical' size='l'>
                <LanguageSelects
                    translateRequest={translateRequest}
                    changeCallback={handleSubmit}
                />
                <ColumnLayout columns={2}>
                    <FormField label='Enter text' errorText={textError}>
                        <Textarea
                            value={textToTranslate}
                            onChange={(event) => {
                                setTextToTranslate(event.detail.value!);
                                debounceFormTextUpdate();
                            }}
                            placeholder='Enter text'
                        />
                    </FormField>
                    <FormField label='Translated text'>
                        <Textarea placeholder='Translated text' value={translatedText} readOnly />
                    </FormField>
                </ColumnLayout>
                <AdditionalSettings
                    translateRequest={translateRequest}
                    changeCallback={handleSubmit}
                />
            </SpaceBetween>
            <Condition condition={terminologyMatches.length > 0}>
                <Table
                    columnDefinitions={[
                        {
                            id: 'source',
                            header: 'Source text',
                            cell: (item) => item.SourceText,
                            isRowHeader: true,
                        },
                        {
                            id: 'target',
                            header: 'Target text',
                            cell: (item) => item.TargetText,
                        },
                    ]}
                    allItems={terminologyMatches}
                    loadingText='Loading resources'
                    trackBy='name'
                    empty='No matches'
                    header={<Header>Terminology matches</Header>}
                />
            </Condition>
        </SpaceBetween>
    );
};
