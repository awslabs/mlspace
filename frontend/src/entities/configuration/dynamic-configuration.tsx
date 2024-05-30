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
    Multiselect,
} from '@cloudscape-design/components';
import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { appConfig, appConfigList, getConfiguration, listConfigurations, updateConfiguration } from './configuration-reducer';
import { Application, IAppConfiguration } from '../../shared/model/app.configuration.model';
import { scrollToInvalid, useValidationReducer } from '../../shared/validation';
import { z } from 'zod';
import NotificationService from '../../shared/layout/notification/notification.service';
import { emrApplications, listEMRApplications } from '../emr/emr.reducer';
import { formatDisplayNumber } from '../../shared/util/form-utils';
import { ClusterTypeConfiguration } from './cluster-types';
import { InstanceTypeMultiSelector } from '../../shared/metadata/instance-type-dropdown';

export function DynamicConfiguration () {
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const configList: IAppConfiguration[] = useAppSelector(appConfigList);
    const emrApplicationList: string[] = useAppSelector(emrApplications);
    const [selectedApplicationOptions, setSelectedApplicationOptions] = useState([] as any[]);
    const [applicationOptions, setApplicationOptions] = useState([] as any);
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const [selectedFile, setSelectedFile] = useState<File[]>([]);

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
        dispatch(listConfigurations({configScope: 'global', numVersions: 5}));
    }, [dispatch]);

    useEffect(() => {
        dispatch(listEMRApplications());
    }, [dispatch]);

    useEffect(() => {
        const appList: any[] = [];
        emrApplicationList.forEach((application) => appList.push({value: application, label: application})); 
        setApplicationOptions(appList);

        // Make sure we're always starting from an empty array to prevent duplicates
        setSelectedApplicationOptions([]);
        const selectedApps: any  = [];
        for (const configApp of applicationConfig.configuration.EMRConfig.applications) {
            if (emrApplicationList.includes(configApp.Name) && !selectedApplicationOptions.includes(configApp.Name)) {
                selectedApps.push({
                    value: configApp.Name,
                    label: configApp.Name
                });
            }
        }
        setSelectedApplicationOptions((priorSelectedOptions) => [...priorSelectedOptions, ...selectedApps]);
        
        // eslint-disable-next-line react-hooks/exhaustive-deps 
    }, [emrApplicationList, applicationConfig]);

    // Initialize the notebook instance type selectors with the currently selected options
    const selectedNotebookInstanceOptions = useMemo(() => state.form.configuration.EnabledInstanceTypes.notebook.map((instance) => {
        return {
            value: instance,
            label: instance,
        };
    }), [state.form.configuration.EnabledInstanceTypes.notebook]);

    // Initialize the training job instance type selectors with the currently selected options
    const selectedTrainingJobInstanceOptions = useMemo(() => state.form.configuration.EnabledInstanceTypes.trainingJob.map((instance) => {
        return {
            value: instance,
            label: instance,
        };
    }), [state.form.configuration.EnabledInstanceTypes.trainingJob]);

    // Initialize the transform job instance type selectors with the currently selected options
    const selectedTransformJobInstanceOptions = useMemo(() => state.form.configuration.EnabledInstanceTypes.transformJob.map((instance) => {
        return {
            value: instance,
            label: instance,
        };
    }), [state.form.configuration.EnabledInstanceTypes.transformJob]);

    // Initialize the endpoint instance type selectors with the currently selected options
    const selectedEndpointInstanceOptions = useMemo(() => state.form.configuration.EnabledInstanceTypes.endpoint.map((instance) => {
        return {
            value: instance,
            label: instance,
        };
    }), [state.form.configuration.EnabledInstanceTypes.endpoint]);

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

    const addApplication = (detail: any) => {
        setSelectedApplicationOptions(detail.selectedOptions);
        const updatedSelectedApps: Application[] = [];
        detail.selectedOptions.forEach((option) => updatedSelectedApps.push({Name: option.value})); 
        setFields({ 'configuration.EMRConfig.applications': updatedSelectedApps });
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
                    <ExpandableSection headerText='Notebook instances' variant='default'>
                        <InstanceTypeMultiSelector
                            selectedOptions={selectedNotebookInstanceOptions}
                            onChange={({ detail }) => setFields({ 'configuration.EnabledInstanceTypes.notebook': detail.selectedOptions.map((option) => option.value)})}
                            instanceTypeCategory='InstanceType'
                        />
                    </ExpandableSection>
                    <ExpandableSection headerText='Training and HPO jobs' variant='default'>
                        <InstanceTypeMultiSelector
                            selectedOptions={selectedTrainingJobInstanceOptions}
                            onChange={({ detail }) => setFields({ 'configuration.EnabledInstanceTypes.trainingJob': detail.selectedOptions.map((option) => option.value)})}
                            instanceTypeCategory='TrainingInstanceType'
                        />
                    </ExpandableSection>
                    <ExpandableSection headerText='Transform jobs' variant='default'>
                        <InstanceTypeMultiSelector
                            selectedOptions={selectedTransformJobInstanceOptions}
                            onChange={({ detail }) => setFields({ 'configuration.EnabledInstanceTypes.transformJob': detail.selectedOptions.map((option) => option.value)})}
                            instanceTypeCategory='TransformInstanceType'
                        />
                    </ExpandableSection>
                    <ExpandableSection headerText='Endpoints' variant='default'>
                        <InstanceTypeMultiSelector
                            selectedOptions={selectedEndpointInstanceOptions}
                            onChange={({ detail }) => setFields({ 'configuration.EnabledInstanceTypes.endpoint': detail.selectedOptions.map((option) => option.value)})}
                            instanceTypeCategory='ProductionVariantInstanceType'
                        />
                    </ExpandableSection>
                </ExpandableSection>
                <ExpandableSection headerText='Enabled Services' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                </ExpandableSection>
                <ExpandableSection headerText='EMR Config' variant='default' defaultExpanded>
                    <ExpandableSection 
                        headerText='Applications'
                        variant='default' 
                        headingTagOverride='h3' 
                        headerDescription='A list of applications for Amazon EMR to install and configure when launching the cluster.'
                    >
                        <Multiselect
                            selectedOptions={selectedApplicationOptions}
                            onChange={({ detail }) =>
                                addApplication(detail)
                            }
                            options={applicationOptions}
                            placeholder='Select applications'
                        />
                    </ExpandableSection>
                    <ExpandableSection 
                        headerText='Cluster Types'
                        variant='default' 
                        headingTagOverride='h3' 
                        headerDescription='The cluster types options that users can select from when creating a new Amazon EMR Cluster.'
                    >
                        <ClusterTypeConfiguration
                            item={
                                state.form
                            }
                            setFields={setFields}
                            touchFields={touchFields}
                            formErrors={errors}
                        />
                    </ExpandableSection>
                    <ExpandableSection 
                        headerText='Auto Scaling Policy'
                        variant='default' 
                        headingTagOverride='h3' 
                        headerDescription='An automatic scaling policy for a core instance group or task instance group in an Amazon EMR cluster. The automatic scaling policy defines how an instance group dynamically adds and terminates Amazon EC2 instances.'
                    >
                        <SpaceBetween direction='vertical' size='m'>
                            <FormField
                                label='Max Instances'
                                constraintText='Must be an integer value.'
                                errorText={errors?.configuration?.EMRConfig?.autoScaling?.maxInstances}
                                description='The maximum number of instances supporting the Amazon EMR Cluster at any time.'
                            >
                                <Input
                                    data-cy='cluster-max-size'
                                    value={state.form.configuration.EMRConfig.autoScaling.maxInstances.toString()}
                                    onChange={(event) => {
                                        setFields({ 'configuration.EMRConfig.autoScaling.maxInstances': Number(event.detail.value) });
                                    }}
                                    onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.maxInstances'])}
                                />
                            </FormField>
                            <FormField
                                label='Min Instances'
                                constraintText='Must be an integer value.'
                                errorText={errors?.configuration?.EMRConfig?.autoScaling?.minInstances}
                                description='The minimum number of instances supporting the Amazon EMR Cluster at any time.'
                            >
                                <Input
                                    data-cy='cluster-min-size'
                                    value={state.form.configuration.EMRConfig.autoScaling.minInstances.toString()}
                                    onChange={(event) => {
                                        setFields({ 'configuration.EMRConfig.autoScaling.minInstances': Number(event.detail.value) });
                                    }}
                                    onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.minInstances'])}
                                />
                            </FormField>
                            <ExpandableSection
                                headerText='Scale-Out Policy'
                                headingTagOverride='h4'
                                headerDescription='Determines when new Amazon EC2 instances will be provisioned to the cluster.'
                            >
                                <SpaceBetween direction='vertical' size='s'>
                                    <FormField
                                        label='Increment'
                                        constraintText='Must be an integer value.'
                                        errorText={errors?.configuration?.EMRConfig?.autoScaling?.scaleOut?.increment}
                                        description='The number of Amazon EC2 instances that will be added when the Percentage-Memory-Available value is exceeded.'
                                    >
                                        <Input
                                            data-cy='cluster-scale-out-increment'
                                            value={state.form.configuration.EMRConfig.autoScaling.scaleOut?.increment.toString()}
                                            onChange={(event) => {
                                                setFields({ 'configuration.EMRConfig.autoScaling.scaleOut.increment': Number(event.detail.value) });
                                            }}
                                            onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.scaleOut.increment'])}
                                        />
                                    </FormField>
                                    <FormField
                                        label='Cooldown'
                                        constraintText='Must be an integer value.'
                                        errorText={errors?.configuration?.EMRConfig?.autoScaling?.scaleOut?.cooldown}
                                        description='The amount of time, in seconds, after a scaling activity completes before any further trigger-related scaling activities can start.'
                                    >
                                        <Input
                                            data-cy='cluster-scale-out-cooldown'
                                            value={state.form.configuration.EMRConfig.autoScaling.scaleOut?.cooldown.toString()}
                                            onChange={(event) => {
                                                setFields({ 'configuration.EMRConfig.autoScaling.scaleOut.cooldown': Number(event.detail.value) });
                                            }}
                                            onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.scaleOut.cooldown'])}
                                        />
                                    </FormField>
                                    <FormField
                                        label='Percentage Memory Available'
                                        constraintText='Must be an integer value.'
                                        errorText={errors?.configuration?.EMRConfig?.autoScaling?.scaleOut?.percentageMemAvailable}
                                        description='The threshold that determines when the Scale-Out policy is triggered. Triggered when the percentage of available memory drops below this value.'
                                    >
                                        <Input
                                            data-cy='cluster-scale-out-percentageMemAvailable'
                                            value={state.form.configuration.EMRConfig.autoScaling.scaleOut?.percentageMemAvailable.toString()}
                                            onChange={(event) => {
                                                setFields({ 'configuration.EMRConfig.autoScaling.scaleOut.percentageMemAvailable': Number(event.detail.value) });
                                            }}
                                            onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.scaleOut.percentageMemAvailable'])}
                                        />
                                    </FormField>
                                    <FormField
                                        label='Evaluation Periods'
                                        constraintText='Must be an integer value.'
                                        errorText={errors?.configuration?.EMRConfig?.autoScaling?.scaleOut?.evalPeriods}
                                        description='The number of periods, in five-minute increments, during which the "Percentage Memory Available" condition must exist before the Scale-Out policy is triggered.'
                                    >
                                        <Input
                                            data-cy='cluster-scale-out-evalPeriods'
                                            value={state.form.configuration.EMRConfig.autoScaling.scaleOut?.evalPeriods.toString()}
                                            onChange={(event) => {
                                                setFields({ 'configuration.EMRConfig.autoScaling.scaleOut.evalPeriods': Number(event.detail.value) });
                                            }}
                                            onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.scaleOut.evalPeriods'])}
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </ExpandableSection>
                            <ExpandableSection
                                headerText='Scale-In Policy'
                                headingTagOverride='h4'
                                headerDescription='Determines when existing Amazon EC2 instances will released from the cluster.'
                            >
                                <SpaceBetween direction='vertical' size='s'>
                                    <FormField
                                        label='Increment'
                                        constraintText='Must be an integer value.'
                                        errorText={errors?.configuration?.EMRConfig?.autoScaling?.scaleIn?.increment}
                                        description='The number of Amazon EC2 instances that will be released when the Percentage-Memory-Available value is exceeded.'
                                    >
                                        <Input
                                            data-cy='cluster-scale-in-increment'
                                            value={state.form.configuration.EMRConfig.autoScaling.scaleIn?.increment.toString()}
                                            onChange={(event) => {
                                                setFields({ 'configuration.EMRConfig.autoScaling.scaleIn.increment': formatDisplayNumber(Number(event.detail.value)) });
                                            }}
                                            onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.scaleIn.increment'])}
                                        />
                                    </FormField>
                                    <FormField
                                        label='Cooldown'
                                        constraintText='Must be an integer value.'
                                        errorText={errors?.configuration?.EMRConfig?.autoScaling?.scaleIn?.cooldown}
                                        description='The amount of time, in seconds, after a scaling activity completes before any further trigger-related scaling activities can start.'
                                    >
                                        <Input
                                            data-cy='cluster-scale-in-cooldown'
                                            value={state.form.configuration.EMRConfig.autoScaling.scaleIn?.cooldown.toString()}
                                            onChange={(event) => {
                                                setFields({ 'configuration.EMRConfig.autoScaling.scaleIn.cooldown': Number(event.detail.value) });
                                            }}
                                            onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.scaleIn.cooldown'])}
                                        />
                                    </FormField>
                                    <FormField
                                        label='Percentage Memory Available'
                                        constraintText='Must be an integer value.'
                                        errorText={errors?.configuration?.EMRConfig?.autoScaling?.scaleIn?.percentageMemAvailable}
                                        description='The threshold that determines when the Scale-In policy is triggered. Triggered when the percentage of available memory exceeds this value.'
                                    >
                                        <Input
                                            data-cy='cluster-scale-in-percentageMemAvailable'
                                            value={state.form.configuration.EMRConfig.autoScaling.scaleIn?.percentageMemAvailable.toString()}
                                            onChange={(event) => {
                                                setFields({ 'configuration.EMRConfig.autoScaling.scaleIn.percentageMemAvailable': Number(event.detail.value) });
                                            }}
                                            onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.scaleIn.percentageMemAvailable'])}
                                        />
                                    </FormField>
                                    <FormField
                                        label='Evaluation Periods'
                                        constraintText='Must be an integer value.'
                                        errorText={errors?.configuration?.EMRConfig?.autoScaling?.scaleIn?.evalPeriods}
                                        description='The number of periods, in five-minute increments, during which the "Percentage Memory Available" condition must exist before the Scale-In policy is triggered.'
                                    >
                                        <Input
                                            data-cy='cluster-scale-in-evalPeriods'
                                            value={state.form.configuration.EMRConfig.autoScaling.scaleIn?.evalPeriods.toString()}
                                            onChange={(event) => {
                                                setFields({ 'configuration.EMRConfig.autoScaling.scaleIn.evalPeriods': Number(event.detail.value) });
                                            }}
                                            onBlur={() => touchFields(['configuration.EMRConfig.autoScaling.scaleIn.evalPeriods'])}
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </ExpandableSection>
                        </SpaceBetween>
                    </ExpandableSection>
                </ExpandableSection>
                <ExpandableSection headerText='Project Creation' variant='default' defaultExpanded>
                    <Toggle
                        onChange={({ detail }) => {
                            setFields({ 'configuration.ProjectCreation.isAdminOnly': detail.checked });
                        }}
                        checked={state.form.configuration.ProjectCreation.isAdminOnly}
                    >
                        Admin Only - restrict creation of projects to users with Admin permissions
                    </Toggle>
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
                    disabled={!isValid || state.formSubmitting}
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
