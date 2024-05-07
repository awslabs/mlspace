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
import React, { useEffect, useState } from 'react';
import {
    Box,
    ColumnLayout,
    ExpandableSection,
    FormField,
    Select,
    SelectProps,
    SpaceBetween,
    Toggle,
} from '@cloudscape-design/components';
import { CallbackFunction } from '../../types';
import {
    getCustomTerminologyList,
    getTranslateLanguagesList,
} from '../../shared/util/translate-utils';
import { OptionDefinition } from '@cloudscape-design/components/internal/components/option/interfaces';
import Condition from '../../modules/condition';

const noneOption: SelectProps.Option = { label: 'None', value: undefined };
/**
 * Formality options that are available to choose from with the language selects
 */
const formalityOptions: OptionDefinition[] = [
    { label: 'Formal', value: 'FORMAL' },
    { label: 'Informal', value: 'INFORMAL' },
];

export type RealtimeTranslateProps = {
    changeCallback?: CallbackFunction;
};

export const LanguageSelects = (props: RealtimeTranslateProps) => {
    const autoOption: SelectProps.Option = { label: 'Auto (auto)', value: 'auto' };
    const [languages, setLanguages] = useState<OptionDefinition[]>([]);
    const [sourceLanguageOption, setSourceLanguageOption] = useState<OptionDefinition>(autoOption);
    const [targetLanguageOption, setTargetLanguageOption] = useState<OptionDefinition>({
        label: 'English (en)',
        value: 'en',
    });
    useEffect(() => {
        getTranslateLanguagesList().then((response: any) => {
            setLanguages(response);
        });
    }, []);

    return (
        <ColumnLayout columns={2}>
            <FormField label='Source language'>
                <Select
                    selectedOption={sourceLanguageOption}
                    onChange={({ detail }) => {
                        setSourceLanguageOption(detail.selectedOption);
                        if (props.changeCallback) {
                            props.changeCallback({
                                SourceLanguageCode: detail.selectedOption.value,
                            });
                        }
                        // The source language can't also be the target language
                        if (targetLanguageOption.value === detail.selectedOption.value) {
                            setTargetLanguageOption({ value: undefined });
                        }
                    }}
                    options={[autoOption, ...languages]}
                    filteringType='auto'
                    placeholder='Choose a source language'
                />
            </FormField>
            <FormField label='Target language'>
                <Select
                    selectedOption={targetLanguageOption}
                    onChange={({ detail }) => {
                        setTargetLanguageOption(detail.selectedOption);
                        if (props.changeCallback) {
                            props.changeCallback({
                                TargetLanguageCode: detail.selectedOption.value,
                            });
                        }
                    }}
                    // The source language can't also be the target language
                    options={languages.filter((language) => language !== sourceLanguageOption)}
                    filteringType='auto'
                    placeholder='Choose a target language'
                />
            </FormField>
        </ColumnLayout>
    );
};

/**
 * This supplies additional settings that are used for real-time translation.
 * These items are expected to be a footer for the primary form
 * @param props The reducer that is required to populate and maintain the additional settings
 */
export const AdditionalSettings = (props: RealtimeTranslateProps) => {
    const [useCustomTerminology, setUseCustomTerminology] = useState(false);
    const [customTerminology, setCustomTerminology] = useState<OptionDefinition | null>(null);
    const [formalityEnabled, setFormalityEnabled] = useState(false);
    const [formality, setFormality] = useState<OptionDefinition>(noneOption);
    const [maskProfanity, setMaskProfanity] = useState(false);
    const [customTerminologies, setCustomTerminologies] = useState([]);
    useEffect(() => {
        getCustomTerminologyList().then((response: any) => {
            setCustomTerminologies(response);
        });
    }, []);

    return (
        <ExpandableSection headerText='Additional settings' variant='footer'>
            <SpaceBetween size='s'>
                <Toggle
                    checked={useCustomTerminology}
                    onChange={({ detail }) => {
                        setUseCustomTerminology(detail.checked);
                        if (!detail.checked && props.changeCallback && customTerminology !== null) {
                            setCustomTerminology(null);
                            props.changeCallback({ TerminologyNames: [] });
                        }
                    }}
                >
                    Custom Terminology
                </Toggle>
                <Condition condition={useCustomTerminology}>
                    <Box padding={{ left: 'm' }}>
                        <Select
                            onChange={({ detail }) => {
                                if (detail.selectedOption === noneOption) {
                                    setCustomTerminology(null);
                                } else {
                                    setCustomTerminology(detail.selectedOption);
                                }
                                if (props.changeCallback) {
                                    props.changeCallback({
                                        TerminologyNames: [detail.selectedOption.value],
                                    });
                                }
                            }}
                            selectedOption={customTerminology}
                            options={[noneOption, ...customTerminologies]}
                            placeholder={'Choose a terminology'}
                            empty={'No options'}
                        />
                    </Box>
                </Condition>
                <Toggle
                    checked={formalityEnabled}
                    onChange={({ detail }) => {
                        setFormalityEnabled(detail.checked);
                        if (!detail.checked && props.changeCallback && formality !== noneOption) {
                            setFormality(noneOption);
                            props.changeCallback({ Settings: { Formality: null } });
                        }
                    }}
                    description={
                        'Choose whether the translation output uses a formal tone. Not all languages are supported'
                    }
                >
                    Formality
                </Toggle>
                <Condition condition={formalityEnabled}>
                    <Box padding={{ left: 'm' }}>
                        <Select
                            onChange={({ detail }) => {
                                setFormality(detail.selectedOption);
                                if (props.changeCallback) {
                                    props.changeCallback({
                                        Settings: {
                                            Formality: detail.selectedOption.value
                                                ? detail.selectedOption.value
                                                : null,
                                        },
                                    });
                                }
                            }}
                            selectedOption={formality}
                            options={[noneOption, ...formalityOptions]}
                            placeholder='Choose a formality'
                        />
                    </Box>
                </Condition>
                <Toggle
                    onChange={({ detail }) => {
                        setMaskProfanity(detail.checked);
                        if (props.changeCallback) {
                            props.changeCallback({
                                Settings: { Profanity: detail.checked ? 'MASK' : null },
                            });
                        }
                    }}
                    checked={maskProfanity}
                    description={
                        'Choose whether the translation output masks profane words or phrases. Not all languages are supported'
                    }
                >
                    Profanity masking
                </Toggle>
            </SpaceBetween>
        </ExpandableSection>
    );
};
