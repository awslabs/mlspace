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
import {
    ExpandableSection,
    Header,
    SpaceBetween,
    Container,
    Button,
    Input,
    FileUpload,
    Toggle,
    FormField,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { appConfig, appConfigList, getConfiguration, listConfigurations, updateConfiguration } from './configuration-reducer';
import { IAppConfiguration } from '../../shared/model/app.configuration.model';
import { useValidationReducer } from '../../shared/validation';
import { z } from 'zod';
import NotificationService from '../../shared/layout/notification/notification.service';

export function DynamicConfiguration () {
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const configList: IAppConfiguration[] = useAppSelector(appConfigList);
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const [selectedFile, setSelectedFile] = useState<File[]>([]);

    const formSchema = z.object({
        configuration: z.object({
        }),
    });

    const { state, setState, isValid, setFields, touchFields } = useValidationReducer(formSchema, {
        validateAll: false as boolean,
        needsValidation: false,
        touched: {},
        form: {
            ...applicationConfig,
        },
        formValid: false,
        formSubmitting: false as boolean,
    });

    useEffect(() => {
        dispatch(listConfigurations({configScope: 'global', numVersions: 5}));
    }, [dispatch]);


    const handleSubmit = async () => {
        if (isValid) {
            setState({ formSubmitting: true });
            const resp = await dispatch(updateConfiguration({appConfiguration: state.form}));
            const responseStatus = resp.payload.status;
            if (responseStatus >= 400) {
                if (responseStatus === 429) {
                    notificationService.generateNotification(
                        'Outdated configuration - please refresh to get the latest configuration, then try again.',
                        'error'
                    );
                } else {
                    notificationService.generateNotification(
                        'Something went wrong while uploading the configuration. Please try again or check system logs.',
                        'error'
                    );
                }
            } else {
                dispatch(getConfiguration('global'));
                notificationService.generateNotification(
                    'Successfully updated configuration.',
                    'success'
                );
            }
        }
        setState({ formSubmitting: false });
    };


    const JSONToFile = () => {
        const blob = new Blob([JSON.stringify(applicationConfig.configuration, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${window.env.APPLICATION_NAME}_configuration.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = async () => {
        const file: File = selectedFile[0];
        if (file.type !== 'application/json') {
            notificationService.generateNotification(
                'Invalid file type. File must be a JSON file.',
                'error'
            );
        } else {
            const fileText = await file.text();
            const parsedJSON = JSON.parse(fileText);
            state.form.configuration = parsedJSON;
            state.form.changeReason = 'Imported configuration file.';
            handleSubmit();
        }
    };

    return (
        <Container
            header={
                <Header
                    variant='h2'
                    description={`The current dynamic configuration of ${window.env.APPLICATION_NAME}. These settings can be modified without redeploying the application.`}
                >
                    {window.env.APPLICATION_NAME} Dynamic Configuration
                </Header>
            }
        >
            <SpaceBetween direction='vertical' size='xl'>
                <ExpandableSection headerText='Allowed Instance Types' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                </ExpandableSection>
                <ExpandableSection headerText='Enabled Services' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                </ExpandableSection>
                <ExpandableSection headerText='EMR Config' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                    <Input
                        data-cy='test-input'
                        value={state.form.configuration.EMRConfig.clusterSizes[0].name}
                        onChange={(event) => {
                            setFields({ 'configuration.EMRConfig.clusterSizes[0].name': event.detail.value });
                        }}
                        onBlur={() => touchFields(['configuration.EMRConfig.clusterSizes[0].name'])}
                    />
                </ExpandableSection>
                <ExpandableSection headerText='Project Creation' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                </ExpandableSection>
                <ExpandableSection headerText='System Banner' variant='default' defaultExpanded>
                    <SpaceBetween direction='vertical' size='l'>
                        <Toggle
                            onChange={({ detail }) => {
                                setFields({ 'configuration.SystemBanner.isEnabled': detail.checked });
                            }}
                            checked={state.form.configuration.SystemBanner.isEnabled!}
                        >
                            Enable System Banner
                        </Toggle>
                        <FormField
                            label='Banner Text'
                        >
                            <Input
                                onChange={({ detail }) => {
                                    setFields({ 'configuration.SystemBanner.text': detail.value });
                                }}
                                onBlur={() => touchFields(['configuration.SystemBanner.text'])}
                                value={state.form.configuration.SystemBanner.text}
                                placeholder='Enter system banner text'
                                disabled={!state.form.configuration.SystemBanner.isEnabled}
                            />
                        </FormField>
                        <SpaceBetween direction='horizontal' size='l'>
                            <FormField
                                label='Text Color'
                            >
                                <input
                                    type='color'
                                    onInput={(event) =>
                                        setFields({ 'configuration.SystemBanner.textColor': event.target.value })
                                    }
                                    value={state.form.configuration.SystemBanner.textColor}
                                    disabled={!state.form.configuration.SystemBanner.isEnabled}
                                    style={{border: '2px solid #7F8897', borderRadius: '6px', padding: '3px'}}
                                />
                            </FormField>
                            <FormField
                                label='Background Color'
                            >   
                                <input
                                    type='color'
                                    onInput={(event) =>
                                        setFields({ 'configuration.SystemBanner.backgroundColor': event.target.value })
                                    }
                                    value={state.form.configuration.SystemBanner.backgroundColor}
                                    disabled={!state.form.configuration.SystemBanner.isEnabled}
                                    style={{border: '2px solid #7F8897', borderRadius: '6px', padding: '3px'}}
                                />
                            </FormField>
                        </SpaceBetween>
                    </SpaceBetween>
                </ExpandableSection>
                <Button
                    iconAlt='Update dynamic configuration'
                    variant='primary'
                    onClick={handleSubmit}
                    loading={state.formSubmitting}
                    data-cy='dynamic-configuration-submit'
                    disabled={!isValid}
                >
                    Save Changes
                </Button>
                <Container
                    header={
                        <Header
                            variant='h3'
                            description={`Export the latest dynamic configuration of ${window.env.APPLICATION_NAME}. This will download a JSON file to your machine with the current configuration. This JSON file can be used for a new ${window.env.APPLICATION_NAME} to ensure it has the same settings.`}

                        >
                            Export Configuration
                        </Header>
                    }
                >
                    <Button
                        iconAlt='Export dynamic configuration'
                        variant='primary'
                        onClick={JSONToFile}
                        loading={state.formSubmitting}
                        data-cy='export-configuration-submit'
                        iconName='download'
                    >
                        Export Configuration as JSON File
                    </Button>
                </Container>
                <Container
                    header={
                        <Header
                            variant='h3'
                            description={`Upload a JSON configuration for ${window.env.APPLICATION_NAME}. This will be parsed for validity and then uploaded as the active configuraion. The import will fail if the provided configuration doesn't have the required values.`}
                        >
                            Import Configuration
                        </Header>
                    }
                >
                    <SpaceBetween direction='vertical' size='s'>
                        <FileUpload
                            onChange={({ detail }) => { 
                                setSelectedFile([]); // ensure there's never more than one file
                                setSelectedFile(detail.value);
                            }}
                            value={selectedFile}
                            i18nStrings={{
                                uploadButtonText: (e) =>
                                    e ? 'Choose files' : 'Choose file',
                                dropzoneText: (e) =>
                                    e ? 'Drop files to upload' : 'Drop file to upload',
                                removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                                limitShowFewer: 'Show fewer files',
                                limitShowMore: 'Show more files',
                                errorIconAriaLabel: 'Error uploading file'
                            }}
                        />
                        <Button
                            onClick={async () => handleFileUpload()}
                            disabled={selectedFile.length === 0}
                            variant='primary'
                        >
                            Upload Configuration
                        </Button>
                    </SpaceBetween>
                </Container>
                <ExpandableSection headerText='Configuration History' variant='default' defaultExpanded>
                    {<pre>View the configuration history and rollback to prior versions.</pre>}
                    {configList.length}
                </ExpandableSection>
            </SpaceBetween>
        </Container>
    );
}

export default DynamicConfiguration;
