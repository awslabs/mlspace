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
import { useNavigate, useParams } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import {
    Button,
    SpaceBetween,
    Header,
    FormField,
    Input,
    Container,
    ContentLayout,
    Select,
    Multiselect,
    Toggle,
    RadioGroup,
    SelectProps,
} from '@cloudscape-design/components';
import { useAppDispatch } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { createBatchTranslateJob } from '../batch-translate.reducer';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { issuesToErrors, scrollToInvalid, useValidationReducer } from '../../../shared/validation';
import { z } from 'zod';
import { DocTitle, scrollToPageHeader } from '../../../shared/doc';
import {
    ContentType,
    FormalityOptions,
    ProfanityOptions,
    defaultEncryptionKey,
} from '../../../shared/model/translate.model';
import { enumToOptions } from '../../../shared/util/enum-utils';
import { listDatasetsLocations } from '../../dataset/dataset.reducer';
import { DatasetType } from '../../../shared/model/dataset.model';
import { useAuth } from 'react-oidc-context';
import { OptionDefinition } from '@cloudscape-design/components/internal/components/option/interfaces';
import {
    getCustomTerminologyList,
    getTranslateLanguagesList,
} from '../../../shared/util/translate-utils';

export function BatchTranslateCreate () {
    const [errorText] = useState('');
    const [customTerminologies, setCustomTerminologies] = useState([]);
    const [languages, setLanguages] = useState([]);
    const autoOption: SelectProps.Option = { label: 'Auto (auto)', value: 'auto' };
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const navigate = useNavigate();
    const auth = useAuth();
    const userName = auth.user!.profile.preferred_username;
    const nameConstraintText =
        'Maximum of 255 alphanumeric characters. Can include hyphens (-), but not spaces. Must be unique within your account in an AWS Region.';
    scrollToPageHeader();
    DocTitle('Create translation job');

    //JobName is prepended with '{projectname}-{username}'
    const formSchema = z.object({
        JobName: z
            .string({ required_error: 'A job name must be specified.' })
            .min(1)
            .max(255)
            .regex(/^[a-zA-Z0-9-]*$/, {
                message: nameConstraintText,
            }),
        InputDataConfig: z.object({
            S3Uri: z
                .string({ required_error: 'You must select an S3 input URI.' })
                .startsWith('s3://'),
            ContentType: z.string({ required_error: 'A content type must be selected.' }),
        }),
        OutputDataConfig: z.object({
            S3Uri: z
                .string({ required_error: 'You must select an S3 output URI.' })
                .startsWith('s3://'),
            EncryptionKey: z.object({
                Type: z.string(),
                Id: z.string(),
            }),
        }),
        SourceLanguageCode: z.string({ required_error: 'You must select an input language code.' }),
        DisplayLanguageCodes: z
            .array(
                z.object({
                    label: z.string({
                        required_error: 'You must select one or more output languages.',
                    }),
                    value: z.string({
                        required_error: 'You must select one or more output language codes.',
                    }),
                })
            )
            .max(10),
        TerminologyNames: z.string(),
        Settings: z.object({
            Formality: z.string(),
            Profanity: z.string(),
        }),
    });

    const { state, setState, setFields, touchFields } = useValidationReducer(formSchema, {
        validateAll: false as boolean,
        needsValidation: false,
        touched: {},
        form: {
            JobName: '',
            InputDataConfig: {
                S3Uri: '',
                ContentType: ContentType.TEXT_PLAIN,
            },
            InputDataset: {
                Type: DatasetType.GLOBAL,
                Name: '',
            },
            OutputDataset: {
                Type: DatasetType.GLOBAL,
                Name: '',
            },
            OutputDataConfig: {
                S3Uri: '',
                EncryptionKey: defaultEncryptionKey,
            },
            SourceLanguageCode: '',
            TargetLanguageCodes: [] as string[],
            DisplayLanguageCodes: [] as OptionDefinition[],
            TerminologyNames: '',
            Settings: {
                Formality: FormalityOptions.None,
                Profanity: ProfanityOptions.NoMask,
            },
            inputBucket: '',
            inputDatasets: [] as any[],
            outputBucket: '',
            outputDatasets: [] as any[],
        },
        formValid: false,
        formSubmitting: false as boolean,
    });

    let formErrors = {} as any;
    const parseResult = formSchema.safeParse(state.form);
    if (!parseResult.success) {
        formErrors = issuesToErrors(
            parseResult.error.issues,
            state.validateAll === true ? undefined : state.touched
        );
    }

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Batch Translate Jobs', href: `#/project/${projectName}/batch-translate` },
                {
                    text: 'Create translation job',
                    href: `#/project/${projectName}/batch-translate/create `,
                },
            ])
        );

        getCustomTerminologyList().then((response: any) => {
            setCustomTerminologies(response);
        });

        getTranslateLanguagesList().then((response: any) => {
            setLanguages(response);
        });

        scrollToPageHeader('h1', 'Create translation job');
    }, [dispatch, projectName, userName]);

    useEffect(() => {
        // set up the input dataset locations based on user-selected scope
        let scope = 'global';
        switch (state.form.InputDataset.Type) {
            case DatasetType.PRIVATE:
                scope = userName!;
                break;
            case DatasetType.PROJECT:
                scope = projectName!;
                break;
        }

        dispatch(listDatasetsLocations({ scope, type: state.form.InputDataset.Type }))
            .then((response) => response.payload)
            .then((datasets) => {
                if (datasets) {
                    setFields({
                        inputBucket: datasets.bucket,
                        inputDatasets: datasets.locations,
                    });
                } else {
                    setFields({
                        inputBucket: '',
                        inputDatasets: [],
                    });
                }
            });
        // This useEffect currently relies on datasets from state which causes a render loop
        // temporarily disabling rule until it can be reworked
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.form.InputDataset.Type]);

    useEffect(() => {
        // set up the output dataset locations based on user-selected scope
        let scope = 'global';
        switch (state.form.OutputDataset.Type) {
            case DatasetType.PRIVATE:
                scope = userName!;
                break;
            case DatasetType.PROJECT:
                scope = projectName!;
                break;
        }

        dispatch(listDatasetsLocations({ scope, type: state.form.OutputDataset.Type }))
            .then((response) => response.payload)
            .then((datasets) => {
                if (datasets) {
                    setFields({
                        outputBucket: datasets.bucket,
                        outputDatasets: datasets.locations,
                    });
                } else {
                    setFields({
                        outputBucket: '',
                        outputDatasets: [],
                    });
                }
            });
        // This useEffect currently relies on datasets from state which causes a render loop
        // temporarily disabling rule until it can be reworked
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.form.OutputDataset.Type]);

    const handleSubmit = async () => {
        const parseResult = formSchema.safeParse(state.form);
        if (parseResult.success) {
            setState({ formSubmitting: true });
            notificationService.generateNotification(
                'Creating translate batch job. Please wait.',
                'info'
            );

            const response = await dispatch(
                createBatchTranslateJob({
                    batchTranslateJob: state.form,
                    projectName: projectName!,
                })
            );

            if (response.type.endsWith('/fulfilled')) {
                notificationService.generateNotification(
                    `Successfully created translation job ${state.form.JobName}.`,
                    'success'
                );
                navigate(`/project/${projectName}/batch-translate/${response.payload.JobId}`);
            } else {
                notificationService.generateNotification(
                    `Failed to create translation job: ${response.payload}`,
                    'error'
                );
            }
            setState({ formSubmitting: false });
        } else {
            scrollToInvalid();
            formErrors = issuesToErrors(parseResult.error.issues);
            setState({ validateAll: true, formSubmitting: false });
        }
    };

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description='Translate large collections of documents (up to 5 GB in size), using the AWS Translate asynchronous batch processing operation'
                >
                    Create batch translate job
                </Header>
            }
        >
            <Form
                actions={
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button
                            formAction='none'
                            iconAlt='Cancel'
                            variant='link'
                            onClick={() =>
                                navigate(`/project/${projectName}/batch-translate`, {
                                    state: { prevPath: window.location.hash },
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            iconAlt='Create batch translate job'
                            variant='primary'
                            onClick={handleSubmit}
                            disabled={state.formSubmitting}
                            loading={state.formSubmitting}
                            data-cy='batch-translate-submit'
                        >
                            Create batch translate job
                        </Button>
                    </SpaceBetween>
                }
                errorText={errorText}
            >
                <SpaceBetween direction='vertical' size='xl'>
                    <Container header={<Header variant='h2'>Job settings</Header>}>
                        <SpaceBetween direction='vertical' size='m'>
                            <FormField
                                label='Job name'
                                constraintText={nameConstraintText}
                                errorText={formErrors.JobName}
                            >
                                <Input
                                    value={state.form.JobName}
                                    onChange={(event) => {
                                        setFields({ JobName: event.detail.value });
                                    }}
                                    onBlur={() => touchFields(['JobName'])}
                                    data-cy='name-input'
                                />
                            </FormField>
                            <FormField
                                description="The language code of the input language. Specify the language if all input documents share the same language. If you do not know the language of the source files, or your input documents contains different source languages, select 'auto'."
                                errorText={formErrors.SourceLanguageCode}
                                label='Source Language'
                            >
                                <Select
                                    selectedOption={{ label: state.form.SourceLanguageCode }}
                                    onChange={({ detail }) => {
                                        setFields({
                                            SourceLanguageCode: detail.selectedOption.value!,
                                        });
                                    }}
                                    options={[autoOption, ...languages]}
                                    selectedAriaLabel='Selected input language'
                                    filteringType='auto'
                                    data-cy='source-language-select'
                                />
                            </FormField>
                            <FormField
                                description='The target languages of the translation job. Enter up to 10 language codes. Each input file is translated into each target language.'
                                errorText={formErrors.DisplayLanguageCodes}
                                label='Target Languages'
                            >
                                <Multiselect
                                    selectedOptions={state.form.DisplayLanguageCodes}
                                    onChange={({ detail }) => {
                                        //[{"label":"Afrikaans","value":"af"}]
                                        const languageCodeList: string[] = [];
                                        detail.selectedOptions.forEach((element) => {
                                            languageCodeList.push(element.value!);
                                        });
                                        setFields({
                                            TargetLanguageCodes: languageCodeList,
                                            DisplayLanguageCodes: detail.selectedOptions,
                                        });
                                    }}
                                    options={languages}
                                    placeholder='Choose options'
                                    deselectAriaLabel={(e) => `Remove ${e.label}`}
                                    selectedAriaLabel='Selected target language'
                                    filteringType='auto'
                                    data-cy='target-language-multiselect'
                                />
                            </FormField>
                        </SpaceBetween>
                    </Container>
                    <Container header={<Header variant='h2'>Input data</Header>}>
                        <SpaceBetween direction='vertical' size='m'>
                            <FormField label='Data access type'>
                                <RadioGroup
                                    value={state.form.InputDataset!.Type}
                                    items={enumToOptions(DatasetType, true)}
                                    onChange={(event) => {
                                        setFields({
                                            InputDataset: {
                                                Type: DatasetType[
                                                    event.detail.value.toUpperCase() as keyof typeof DatasetType
                                                ],
                                            },
                                        });
                                    }}
                                />
                            </FormField>
                            <FormField
                                label='S3 location'
                                errorText={formErrors?.InputDataset?.Name}
                            >
                                <Select
                                    placeholder='Select an input location'
                                    empty='No datasets found.'
                                    selectedOption={
                                        state.form.InputDataset?.Name
                                            ? { value: state.form.InputDataset?.Name }
                                            : null
                                    }
                                    options={state.form.inputDatasets.map(
                                        (inputLocation: { name: string; location: string }) => {
                                            return { value: inputLocation.name };
                                        }
                                    )}
                                    onChange={(event) => {
                                        const dataset = state.form.inputDatasets.find(
                                            (dataset: { name: string; location: string }) =>
                                                dataset.name === event.detail.selectedOption.value
                                        );
                                        setFields({
                                            InputDataset: {
                                                Type: state.form.InputDataset!.Type,
                                                Name: event.detail.selectedOption.value,
                                            },
                                            'InputDataConfig.S3Uri': dataset.location,
                                        });
                                    }}
                                    data-cy='s3-input-location-select'
                                />
                            </FormField>
                            <FormField
                                description='Describes the format of the data that you submit to AWS Translate as input.'
                                errorText={formErrors.InputDataConfig?.ContentType}
                                label='Content Type'
                            >
                                <Select
                                    selectedOption={{
                                        label: state.form.InputDataConfig.ContentType,
                                    }}
                                    onChange={({ detail }) => {
                                        setFields({
                                            'InputDataConfig.ContentType':
                                                detail.selectedOption.label!,
                                        });
                                    }}
                                    options={enumToOptions(ContentType)}
                                />
                            </FormField>
                        </SpaceBetween>
                    </Container>
                    <Container header={<Header variant='h2'>Output data</Header>}>
                        <SpaceBetween direction='vertical' size='m'>
                            <FormField label='Data access type'>
                                <RadioGroup
                                    value={state.form.OutputDataset!.Type}
                                    items={enumToOptions(DatasetType, true)}
                                    onChange={(event) => {
                                        setFields({
                                            OutputDataset: {
                                                Type: DatasetType[
                                                    event.detail.value.toUpperCase() as keyof typeof DatasetType
                                                ],
                                            },
                                        });
                                    }}
                                />
                            </FormField>
                            <FormField label='S3 location' errorText={formErrors?.Dataset?.Name}>
                                <Select
                                    placeholder='Select an output location'
                                    empty='No datasets found.'
                                    selectedOption={
                                        state.form.OutputDataset?.Name
                                            ? { value: state.form.OutputDataset?.Name }
                                            : null
                                    }
                                    options={state.form.outputDatasets.map(
                                        (location: { name: string; location: string }) => {
                                            return { value: location.name };
                                        }
                                    )}
                                    onChange={(event) => {
                                        const dataset = state.form.outputDatasets.find(
                                            (dataset: { name: string; location: string }) =>
                                                dataset.name === event.detail.selectedOption.value
                                        );
                                        setFields({
                                            OutputDataset: {
                                                Type: state.form.OutputDataset!.Type,
                                                Name: event.detail.selectedOption.value,
                                            },
                                            'OutputDataConfig.S3Uri': dataset.location,
                                        });
                                    }}
                                    data-cy='s3-output-location-select'
                                />
                            </FormField>
                        </SpaceBetween>
                    </Container>
                    <Container header={<Header variant='h2'>Customization - optional</Header>}>
                        <SpaceBetween direction='vertical' size='m'>
                            <FormField
                                description='You can optionally specify the desired level of formality for translations to supported target languages. If you do not specify a value for formality, or if the target language does not support formality, the translation will ignore the formality setting.'
                                errorText={formErrors.Settings?.Formality}
                                label='Formality'
                            >
                                <Select
                                    selectedOption={{ label: state.form.Settings.Formality }}
                                    onChange={({ detail }) => {
                                        setFields({
                                            'Settings.Formality': detail.selectedOption.label!,
                                        });
                                    }}
                                    options={enumToOptions(FormalityOptions)}
                                />
                            </FormField>
                            <FormField
                                description='Enable the profanity setting if you want Amazon Translate to mask profane words and phrases in your translation output.
                                To mask profane words and phrases, Amazon Translate replaces them with the grawlix string “?$#@$“. This 5-character sequence is used for each profane word or phrase, regardless of the length or number of words.'
                                errorText={formErrors.Settings?.Profanity}
                                label='Profanity'
                            >
                                <Toggle
                                    onChange={({ detail }) => {
                                        setFields({
                                            'Settings.Profanity': detail.checked!
                                                ? ProfanityOptions.Mask
                                                : ProfanityOptions.NoMask,
                                        });
                                    }}
                                    checked={
                                        state.form.Settings.Profanity === ProfanityOptions.Mask
                                    }
                                />
                            </FormField>
                            <FormField
                                description='The name of a custom terminology resource to add to the translation job. This parameter accepts only one custom terminology resource.'
                                label='Terminology Name'
                            >
                                <Select
                                    selectedOption={{ label: state.form.TerminologyNames }}
                                    onChange={({ detail }) => {
                                        setFields({
                                            TerminologyNames: detail.selectedOption.label!,
                                        });
                                    }}
                                    options={[{ label: '-', value: '' }, ...customTerminologies]}
                                    placeholder={'Choose a terminology'}
                                    empty={'No options'}
                                />
                            </FormField>
                        </SpaceBetween>
                    </Container>
                </SpaceBetween>
            </Form>
        </ContentLayout>
    );
}

export default BatchTranslateCreate;
