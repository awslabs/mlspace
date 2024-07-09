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

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import {
    Button,
    SpaceBetween,
    Header,
    FormField,
    Input,
    Container,
    Textarea,
    Toggle,
    ExpandableSection,
    Grid,
    TimeInput,
    Checkbox,
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { scrollToInvalid, useValidationState } from '../../../shared/validation';
import { selectProject } from '../card/project-card.reducer';
import { createProject, getProject, listProjectsForUser, updateProject } from '../project.reducer';
import { IProject } from '../../../shared/model/project.model';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { z } from 'zod';
import {
    convertDailyStopTime,
    hoursToDays,
    timezoneDisplayString,
} from '../../../shared/util/date-utils';
import { selectCurrentUser } from '../../user/user.reducer';
import { Timezone } from '../../../shared/model/user.model';
import ContentLayout from '../../../shared/layout/content-layout';
import { useNotificationService } from '../../../shared/util/hooks';

export type ResourceCreateProperties = {
    isEdit?: boolean;
};

export function ProjectCreate ({ isEdit }: ResourceCreateProperties) {
    const [submitLoading, setSubmitLoading] = React.useState(false);
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const { projectName } = useParams();
    const navigate = useNavigate();
    const currentUser = useAppSelector(selectCurrentUser);
    const existingProject: IProject = useAppSelector((state) => state.project.project);
    const existingTerminationConfig = existingProject.metadata?.terminationConfiguration;

    const projectSchema = z.object({
        name: z
            .string()
            .min(3, {
                message: 'Project name must be longer than 3 characters',
            })
            .max(24, {
                message: 'Project name cannot be more than 24 characters',
            })
            .regex(/^[a-zA-Z0-9]+$/, {
                message: 'Project name can only contain alphanumeric characters.',
            }),
        description: z
            .string({
                invalid_type_error: 'Project description must be a string',
            })
            .min(1, {
                message: 'Project description cannot be empty',
            })
            .max(4000, {
                message: 'Project description cannot be more than 4000 characters.',
            })
            .regex(/[ -~]/, {
                message: 'Project description can only contain printable characters',
            }),
        emrRuntime: z
            .number({ invalid_type_error: 'Valid values: positive integer between 1 and 30' })
            .min(1, { message: 'Valid values: positive integer between 1 and 30' })
            .max(30, { message: 'Valid values: positive integer between 1 and 30' }),
        endpointRuntime: z
            .number({ invalid_type_error: 'Valid values: positive integer between 1 and 30' })
            .min(1, { message: 'Valid values: positive integer between 1 and 30' })
            .max(30, { message: 'Valid values: positive integer between 1 and 30' }),
    });

    const { updateForm, touchFieldHandler, setState, state } = useValidationState(projectSchema, {
        validateAll: false,
        needsValidation: false,
        form: {
            name: existingProject.name || '',
            description: existingProject.description || '',
            enableEMRTermination: !!existingTerminationConfig?.defaultEMRClusterTTL,
            emrRuntime: hoursToDays(existingTerminationConfig?.defaultEMRClusterTTL) || 7,
            allowEMRTerminationOverride: existingTerminationConfig?.allowEMROwnerOverride,
            enableEndpointTermination: !!existingTerminationConfig?.defaultEndpointTTL,
            endpointRuntime: hoursToDays(existingTerminationConfig?.defaultEndpointTTL) || 7,
            allowEndpointTerminationOverride: existingTerminationConfig?.allowEndpointOwnerOverride,
            enableNotebookAutoStop: !!existingTerminationConfig?.defaultNotebookStopTime,
            notebookStopTime:
                convertDailyStopTime(
                    existingTerminationConfig?.defaultNotebookStopTime,
                    Timezone.UTC,
                    currentUser.preferences?.timezone
                ) || '17:00',
            allowNotebookStopOverride: existingTerminationConfig?.allowNotebookOwnerOverride,
        },
        touched: {
            inputDataConfig: [],
        },
        formErrors: {} as any,
        formValid: false,
        formSubmitting: false,
    });

    useEffect(() => {
        if (isEdit) {
            DocTitle('Edit Project: ', projectName);
            dispatch(getProject({projectName: projectName!}))
                .unwrap()
                .catch(() => {
                    navigate('/404');
                });
        } else {
            DocTitle('Create Project');
        }
        dispatch(
            setBreadcrumbs([
                { text: 'Projects', href: '#/' },
                isEdit
                    ? { text: 'Create project', href: '#/project/create' }
                    : { text: 'Update project', href: `#/project/${projectName}/edit` },
            ])
        );
        scrollToPageHeader('h1', 'project');
    }, [dispatch, navigate, isEdit, projectName]);

    async function handleSubmit () {
        if (state.formValid) {
            setState({ type: 'updateState', payload: { formSubmitting: true } });
            setSubmitLoading(true);
            const projectPayload: IProject = {
                name: state.form.name,
                description: state.form.description,
                metadata: {
                    terminationConfiguration: {
                        allowEMROwnerOverride: state.form.allowEMRTerminationOverride,
                        defaultEMRClusterTTL: state.form.enableEMRTermination
                            ? state.form.emrRuntime * 24
                            : undefined,
                        allowEndpointOwnerOverride: state.form.allowEndpointTerminationOverride,
                        defaultEndpointTTL: state.form.enableEndpointTermination
                            ? state.form.endpointRuntime * 24
                            : undefined,
                        allowNotebookOwnerOverride: state.form.allowNotebookStopOverride,
                        defaultNotebookStopTime: state.form.enableNotebookAutoStop
                            ? state.form.notebookStopTime
                            : undefined,
                    },
                },
            };
            // Notebook stop time is entered based on the users timezone preference (local default)
            // but it's stored as UTC on the backend so we need to convert that here since
            // the backend ha no concept of timezone
            if (projectPayload.metadata?.terminationConfiguration.defaultNotebookStopTime) {
                projectPayload.metadata.terminationConfiguration.defaultNotebookStopTime =
                    convertDailyStopTime(
                        projectPayload.metadata.terminationConfiguration.defaultNotebookStopTime,
                        currentUser.preferences?.timezone,
                        Timezone.UTC
                    );
            }
            if (isEdit) {
                try {
                    await dispatch(updateProject(projectPayload));
                    notificationService.generateNotification(
                        `Successfully updated project ${projectPayload.name}`,
                        'success'
                    );
                    navigate(`/project/${projectPayload.name}`);
                } catch (error) {
                    notificationService.generateNotification(
                        `Failed to update project ${projectPayload.name} with error: ${error}`,
                        'error'
                    );
                } finally {
                    setState({ type: 'updateState', payload: { formSubmitting: false } });
                    setSubmitLoading(false);
                }
            } else {
                createProject(projectPayload)
                    .then((response) => {
                        if (response.status === 200) {
                            notificationService.generateNotification(
                                `Successfully created project ${projectPayload.name}`,
                                'success'
                            );
                            dispatch(selectProject(projectPayload));
                            dispatch(listProjectsForUser());
                            navigate(`/project/${projectPayload.name}`);
                        } else {
                            notificationService.generateNotification(
                                `Failed to create project ${projectPayload.name} with error: ${response.data}`,
                                'error'
                            );
                        }
                    })
                    .catch((error) => {
                        notificationService.generateNotification(
                            `Failed to create project ${projectPayload.name} with error: ${error.response.data}`,
                            'error'
                        );
                    })
                    .finally(() => {
                        setState({ type: 'updateState', payload: { formSubmitting: false } });
                        setSubmitLoading(false);
                    });
            }
        } else {
            scrollToInvalid();
        }
    }

    const advancedOptionsGridSettings = [{ colspan: 4 }, { colspan: 4 }];

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description={`${window.env.APPLICATION_NAME} groups and controls access to resources through projects. Projects allow multiple users to conduct data science on shared datasets.`}
                >
                    {isEdit ? 'Update project' : 'Create project'}
                </Header>
            }
        >
            <Form
                actions={
                    <SpaceBetween direction='horizontal' size='xl'>
                        <Button
                            formAction='none'
                            variant='link'
                            onClick={() =>
                                navigate('/', {
                                    state: { prevPath: window.location.hash },
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            data-cy='submit'
                            loading={submitLoading}
                            variant='primary'
                            onClick={() => {
                                setState({ type: 'validateAll' });
                                handleSubmit();
                            }}
                            disabled={state.formSubmitting}
                        >
                            Submit
                        </Button>
                    </SpaceBetween>
                }
            >
                <Container header={<Header variant='h2'>Project details</Header>}>
                    <SpaceBetween direction='vertical' size='m'>
                        <FormField
                            description='The name can only contain alphanumeric characters.'
                            errorText={state.formErrors.name}
                            label='Project name'
                        >
                            <Input
                                data-cy='name-input'
                                value={state.form.name!}
                                onChange={(event) => {
                                    updateForm({ name: event.detail.value! });
                                }}
                                onBlur={touchFieldHandler('name')}
                                disabled={isEdit}
                            />
                        </FormField>
                        <FormField
                            description='Set a description for your project.'
                            errorText={state.formErrors.description}
                            label='Project description'
                        >
                            <Textarea
                                data-cy='description-input'
                                value={state.form.description!}
                                onChange={(event) => {
                                    updateForm({ description: event.detail.value! });
                                }}
                                onBlur={touchFieldHandler('description')}
                            />
                        </FormField>
                        <ExpandableSection
                            headerText='Advanced resource scheduling'
                            headingTagOverride='h3'
                        >
                            <SpaceBetween direction='vertical' size='xxl'>
                                <div>
                                    <FormField
                                        label='EMR'
                                        description={`
                                            Enable EMR auto-termination in order to apply a default limit
                                            to how long user created EMR Clusters can run. When
                                            auto-termination is enabled any EMR Cluster created in this
                                            project will automatically be terminated after running for the
                                            selected period of time.
                                            `}
                                    >
                                        <Toggle
                                            onChange={({ detail }) => {
                                                updateForm({
                                                    enableEMRTermination: detail.checked,
                                                });
                                            }}
                                            checked={state.form.enableEMRTermination}
                                        >
                                            Enable Auto-Termination
                                        </Toggle>
                                    </FormField>
                                    <Grid gridDefinition={advancedOptionsGridSettings}>
                                        <FormField
                                            label='Max runtime'
                                            description='Maximum number of days for which an EMR Cluster can run before being terminated.'
                                            errorText={state.formErrors.emrRuntime}
                                        >
                                            <Input
                                                value={state.form.emrRuntime}
                                                inputMode='numeric'
                                                onChange={({ detail }) => {
                                                    updateForm({ emrRuntime: +detail.value! });
                                                }}
                                                onBlur={touchFieldHandler('emrRuntime')}
                                                disabled={!state.form.enableEMRTermination}
                                            />
                                        </FormField>
                                        <FormField
                                            label='Enable owner override'
                                            description='Whether or not the owner of an EMR Cluster should be able to update/disable the default termination time.'
                                        >
                                            <Checkbox
                                                onChange={({ detail }) => {
                                                    updateForm({
                                                        allowEMRTerminationOverride: detail.checked,
                                                    });
                                                }}
                                                checked={state.form.allowEMRTerminationOverride}
                                                disabled={!state.form.enableEMRTermination}
                                            >
                                                {' '}
                                                Allow Override{' '}
                                            </Checkbox>
                                        </FormField>
                                    </Grid>
                                </div>
                                <div>
                                    <FormField
                                        label='SageMaker Endpoints'
                                        description={`
                                            Enable SageMaker Endpoint auto-termination in order to apply a
                                            default limit to how long user created Endpoints can run. When
                                            auto-termination is enabled any SageMaker Endpoints created in this
                                            project will automatically be terminated after running for the
                                            selected period of time.
                                            `}
                                    >
                                        <Toggle
                                            onChange={({ detail }) => {
                                                updateForm({
                                                    enableEndpointTermination: detail.checked,
                                                });
                                            }}
                                            checked={state.form.enableEndpointTermination}
                                        >
                                            Enable auto-termination
                                        </Toggle>
                                    </FormField>
                                    <Grid gridDefinition={advancedOptionsGridSettings}>
                                        <FormField
                                            label='Max runtime'
                                            description='Maximum number of days for which an endpoint can run before being terminated.'
                                            errorText={state.formErrors.endpointRuntime}
                                        >
                                            <Input
                                                value={state.form.endpointRuntime}
                                                inputMode='numeric'
                                                onChange={({ detail }) => {
                                                    updateForm({ endpointRuntime: +detail.value! });
                                                }}
                                                onBlur={touchFieldHandler('endpointRuntime')}
                                                disabled={!state.form.enableEndpointTermination}
                                            />
                                        </FormField>
                                        <FormField
                                            label='Enable owner override'
                                            description='Whether or not the owner of a SageMaker Endpoint should be able to update/disable the default termination time.'
                                        >
                                            <Checkbox
                                                onChange={({ detail }) => {
                                                    updateForm({
                                                        allowEndpointTerminationOverride:
                                                            detail.checked,
                                                    });
                                                }}
                                                checked={
                                                    state.form.allowEndpointTerminationOverride
                                                }
                                                disabled={!state.form.enableEndpointTermination}
                                            >
                                                {' '}
                                                Allow Override{' '}
                                            </Checkbox>
                                        </FormField>
                                    </Grid>
                                </div>
                                <div>
                                    <FormField
                                        label='SageMaker Notebooks'
                                        description={`
                                            Enable SageMaker Notebook auto-stop in order to apply a
                                            default time of the day when running notebooks will be stopped.
                                            When auto-stop is enabled any SageMaker Notebook created in this
                                            project that is actively running will automatically be stopped
                                            each day after the specified time. Notebooks can be restarted by
                                            their owners but any actively running work will be interrupt when
                                            the instances are stopped.
                                            `}
                                    >
                                        <Toggle
                                            onChange={({ detail }) => {
                                                updateForm({
                                                    enableNotebookAutoStop: detail.checked,
                                                });
                                            }}
                                            checked={state.form.enableNotebookAutoStop}
                                        >
                                            Enable auto-stop
                                        </Toggle>
                                    </FormField>
                                    <Grid gridDefinition={advancedOptionsGridSettings}>
                                        <FormField
                                            label='Daily stop time'
                                            description={`Time after which notebooks will be stopped (${timezoneDisplayString(
                                                currentUser.preferences?.timezone
                                            )}).`}
                                        >
                                            <TimeInput
                                                onChange={({ detail }) => {
                                                    updateForm({
                                                        notebookStopTime: detail.value!,
                                                    });
                                                }}
                                                value={state.form.notebookStopTime}
                                                format='hh:mm'
                                                placeholder='HH:mm'
                                                onBlur={touchFieldHandler('notebookStopTime')}
                                                disabled={!state.form.enableNotebookAutoStop}
                                            />
                                        </FormField>
                                        <FormField
                                            label='Enable owner override'
                                            description='Whether or not the owner of a SageMaker Notebook instance should be able to update/disable the default daily stop time.'
                                        >
                                            <Checkbox
                                                onChange={({ detail }) => {
                                                    updateForm({
                                                        allowNotebookStopOverride: detail.checked,
                                                    });
                                                }}
                                                checked={state.form.allowNotebookStopOverride}
                                                disabled={!state.form.enableNotebookAutoStop}
                                            >
                                                {' '}
                                                Allow Override{' '}
                                            </Checkbox>
                                        </FormField>
                                    </Grid>
                                </div>
                            </SpaceBetween>
                        </ExpandableSection>
                    </SpaceBetween>
                </Container>
            </Form>
        </ContentLayout>
    );
}

export default ProjectCreate;
