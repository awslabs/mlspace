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
    Header,
    SpaceBetween,
    Container,
    Button,
    ButtonDropdown,
    Grid,
    Alert
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { appConfig, getConfiguration, updateConfiguration } from './configuration-reducer';
import { IAppConfiguration } from '../../shared/model/app.configuration.model';
import { scrollToInvalid, useValidationReducer } from '../../shared/validation';
import { z } from 'zod';
import NotificationService from '../../shared/layout/notification/notification.service';
import { listEMRApplications } from '../emr/emr.reducer';
import { ConfigurationImportModal } from './configuration-import-modal';
import  SystemBannerConfiguration  from './system-banner-configuration';
import ProjectCreationConfiguration from './project-creation-configuration';
import EmrConfiguration from './emr-configuration';
import ActivatedServicesConfiguration from './activated-services-configuration';
import AllowedInstanceTypesConfiguration from './allowed-instance-types-configuration';
import ConfirmConfigurationChangesModal from './confirm-configuration-changes-modal';

export function DynamicConfiguration () {
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const [importConfigVisible, setImportConfigVisible] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [expandedSections, setExpandedSections] = useState({notebookInstances: false, trainingAndHpo: false, transform: false, endpoints: false, applications: false, clusterTypes: false, autoScaling: false});

    const formSchema = z.object({
        configuration: z.object({
            EMRConfig: z.object({
                autoScaling: z.object({
                    maxInstances: z.number().positive(),
                    minInstances: z.number().positive(),
                    scaleOut: z.object({
                        increment: z.number().positive(),
                        cooldown: z.number().positive(),
                        percentageMemAvailable: z.number().positive(),
                        evalPeriods: z.number().positive(),
                    }),
                    scaleIn: z.object({
                        increment: z.number().negative(),
                        cooldown: z.number().positive(),
                        percentageMemAvailable: z.number().positive(),
                        evalPeriods: z.number().positive(),
                    })
                }),
                clusterTypes: z.array(
                    z.object({
                        name: z.string().min(1),
                        size: z.number().positive()
                    })
                )
            })
        }),
    });

    const { state, setState, setFields, touchFields, isValid, errors } = useValidationReducer(formSchema, {
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
        dispatch(listEMRApplications());
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
                dispatch(getConfiguration({configScope: 'global'}));
                notificationService.generateNotification(
                    'Successfully updated configuration.',
                    'success'
                );
                // Increment the versionId so subsequent changes don't fail from "stale" config
                setFields({ 'versionId': state.form.versionId + 1});
            }
        } else {
            scrollToInvalid();
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
        <>
            <ConfigurationImportModal
                visible={importConfigVisible}
                setVisible={setImportConfigVisible}
                upload={handleFileUpload}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile} />
            <ConfirmConfigurationChangesModal
                visible={modalVisible}
                setVisible={setModalVisible}
                setFields={setFields}
                isSubmitting={state.formSubmitting}
                appConfiguration={applicationConfig.configuration}
                inMemoryConfiguration={state.form.configuration}
                submit={handleSubmit} />
            <Container
                header={
                    <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                        <Header
                            variant='h2'
                            description={`Manage ${window.env.APPLICATION_NAME}'s configuration below. These settings apply across the application.`}
                        >
                            {window.env.APPLICATION_NAME} Dynamic Configuration
                        </Header>
                        <SpaceBetween direction='vertical' alignItems='end' size='m'>
                            <ButtonDropdown
                                items={[
                                    { text: 'Import Configuration', id: 'import-config' },
                                    { text: 'Export Configuration', id: 'export-config'},
                                    { text: 'Expand All', id: 'expand-all' },
                                ]}
                                onItemClick={(e) => {
                                    if (e.detail.id === 'export-config') {
                                        JSONToFile();
                                    } else if (e.detail.id === 'expand-all') {
                                        setExpandedSections({notebookInstances: true, trainingAndHpo: true, transform: true, endpoints: true, applications: true, clusterTypes: true, autoScaling: true});
                                    } else if (e.detail.id === 'import-config') {
                                        setImportConfigVisible(true);
                                    }
                                }}
                            >
                                    Actions
                            </ButtonDropdown>
                        </SpaceBetween>
                    </Grid>
                }
            >
                <SpaceBetween direction='vertical' size='xl'>
                    { window.env.MANAGE_IAM_ROLES && <AllowedInstanceTypesConfiguration
                        setFields={setFields}
                        expandedSections={expandedSections}
                        setExpandedSections={setExpandedSections}
                        enabledNotebookInstanceTypes={state.form.configuration.EnabledInstanceTypes.notebook}
                        enabledTrainingInstanceTypes={state.form.configuration.EnabledInstanceTypes.trainingJob}
                        enabledTransformInstanceTypes={state.form.configuration.EnabledInstanceTypes.transformJob}
                        enabledEndpointInstanceTypes={state.form.configuration.EnabledInstanceTypes.endpoint} /> }
                    { window.env.MANAGE_IAM_ROLES && <ActivatedServicesConfiguration
                        setFields={setFields}
                        enabledServices={state.form.configuration.EnabledServices} /> }
                    <EmrConfiguration
                        expandedSections={expandedSections}
                        setExpandedSections={setExpandedSections}
                        setFields={setFields}
                        touchFields={touchFields}
                        errors={errors}
                        form={state.form}
                        maxInstances={state.form.configuration.EMRConfig.autoScaling.maxInstances}
                        minInstances={state.form.configuration.EMRConfig.autoScaling.minInstances}
                        scaleInCooldown={state.form.configuration.EMRConfig.autoScaling.scaleIn?.cooldown}
                        scaleInEvalPeriods={state.form.configuration.EMRConfig.autoScaling.scaleIn?.evalPeriods}
                        scaleInIncrement={state.form.configuration.EMRConfig.autoScaling.scaleIn?.increment}
                        scaleInPercentageMemAvailable={state.form.configuration.EMRConfig.autoScaling.scaleIn?.percentageMemAvailable}
                        scaleOutCooldown={state.form.configuration.EMRConfig.autoScaling.scaleOut?.cooldown}
                        scaleOutEvalPeriods={state.form.configuration.EMRConfig.autoScaling.scaleOut?.evalPeriods}
                        scaleOutIncrement={state.form.configuration.EMRConfig.autoScaling.scaleOut?.increment}
                        scaleOutPercentageMemAvailable={state.form.configuration.EMRConfig.autoScaling.scaleOut?.percentageMemAvailable} />
                    <ProjectCreationConfiguration
                        setFields={setFields}
                        isAdminOnly={state.form.configuration.ProjectCreation.isAdminOnly} />
                    <SystemBannerConfiguration
                        setFields={setFields}
                        touchFields={touchFields}
                        isEnabled={state.form.configuration.SystemBanner.isEnabled}
                        text={state.form.configuration.SystemBanner.text}
                        backgroundColor={state.form.configuration.SystemBanner.backgroundColor}
                        textColor={state.form.configuration.SystemBanner.textColor} />
                    { !window.env.MANAGE_IAM_ROLES && 
                        <Alert statusIconAriaLabel='Info'>
                            {window.env.APPLICATION_NAME} has the ability to configure which services are available and what instance types are available if dynamic roles are enabled
                        </Alert>
                    }
                    <SpaceBetween alignItems='end' direction='vertical'>
                        <Button
                            iconAlt='Update dynamic configuration'
                            variant='primary'
                            onClick={() => {
                                setModalVisible(true);
                            }}
                            loading={state.formSubmitting}
                            data-cy='dynamic-configuration-submit'
                            disabled={!isValid || state.formSubmitting}
                        >
                        Save Changes
                        </Button>
                    </SpaceBetween>
                </SpaceBetween>
            </Container>
        </>
    );
}

export default DynamicConfiguration;
