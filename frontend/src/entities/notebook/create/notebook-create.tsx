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
    Button,
    Container,
    ContentLayout,
    ExpandableSection,
    Form,
    FormField,
    Header,
    Input,
    Select,
    SpaceBetween,
    TimeInput,
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import {
    createNotebookInstance,
    describeNotebookInstance,
    getNotebookOptions,
    loadingNotebookOptions,
    notebookLifecycleConfigs,
    updateNotebookInstance,
} from '../notebook.reducer';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { z } from 'zod';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { issuesToErrors, scrollToInvalid, useValidationReducer } from '../../../shared/validation';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { INotebook, defaultNotebook } from '../../../shared/model/notebook.model';
import {
    clearClustersList,
    listEMRClusters,
    loadingClustersList,
    selectEMRClusters,
    toggleSelectClusterModal,
} from '../../emr/emr.reducer';
import Modal from '../../../modules/modal';
import Table from '../../../modules/table';
import { defaultColumns, visibleContentPreference } from '../../emr/emr-clusters.columns';
import Condition from '../../../modules/condition';
import { IProject } from '../../../shared/model/project.model';
import { getProject } from '../../project/project.reducer';
import { hasPermission } from '../../../shared/util/permission-utils';
import { Permission, Timezone } from '../../../shared/model/user.model';
import { selectCurrentUser } from '../../user/user.reducer';
import { EMRStatusState } from '../../emr/emr.model';
import { notebookCluster } from '../notebook.service';
import { InstanceTypeSelector } from '../../../shared/metadata/instance-type-selector';
import { convertDailyStopTime, timezoneDisplayString } from '../../../shared/util/date-utils';
import { EMRResourceMetadata } from '../../../shared/model/resource-metadata.model';

export type NotebookCreateProps = {
    update?: boolean;
};

export function NotebookCreate ({ update }: NotebookCreateProps) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const currentUser = useAppSelector(selectCurrentUser);
    const projectPermissions = useAppSelector((state) => state.project.permissions);
    const notebook: INotebook = useAppSelector((state) => state.notebook.notebook);
    const lifecycleConfigs = useAppSelector(notebookLifecycleConfigs);
    const loadingOptions = useAppSelector(loadingNotebookOptions);
    const emrClusters: EMRResourceMetadata[] = useAppSelector(selectEMRClusters);
    const selectClusterModalVisible: boolean = useAppSelector(
        (state) => state.emr.selectClusterModalVisible
    );
    const loadingEMRClusters: boolean = useAppSelector(loadingClustersList);
    const [selectedCluster, setSelectedCluster] = useState({} as EMRResourceMetadata);

    const notificationService = NotificationService(dispatch);

    const { projectName, name } = useParams();

    const basePath = projectName ? `/project/${projectName}` : '/personal';
    const project: IProject = useAppSelector((state) => state.project.project);

    const formSchema = z.object({
        NotebookInstanceName: z
            .string()
            .min(1)
            .max(63)
            .regex(/^[A-Za-z0-9]+([a-zA-Z0-9-]+)*$/, {
                message: 'Name can only contain alphanumeric characters and hyphens (-).',
            }),
        InstanceType: z
            .string({ invalid_type_error: 'An instance type must be selected.' })
            .min(1, 'An instance type must be selected.'),
        NotebookInstanceLifecycleConfigName: z.string({
            invalid_type_error: 'A lifecycle configuration must be selected.',
        }),
        VolumeSizeInGB: z.number().int().gte(5).lte(16384),
    });

    const getStopTimeFromTimestamp = (timestamp: number | undefined): string | undefined => {
        if (timestamp) {
            return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                timeZone:
                    currentUser.preferences?.timezone === Timezone.LOCAL
                        ? Intl.DateTimeFormat().resolvedOptions().timeZone
                        : Timezone.UTC,
                hour12: false,
            });
        }
        return undefined;
    };

    const defaultStopTime = update
        ? getStopTimeFromTimestamp(notebook.NotebookDailyStopTime)
        : convertDailyStopTime(
            project.metadata?.terminationConfiguration?.defaultNotebookStopTime,
            Timezone.UTC,
            currentUser.preferences?.timezone
        );

    const { state, setState, setFields, touchFields } = useValidationReducer(formSchema, {
        validateAll: false as boolean,
        needsValidation: false,
        touched: {},
        form: {
            NotebookInstanceName: defaultNotebook.NotebookInstanceName,
            InstanceType: defaultNotebook.InstanceType,
            NotebookInstanceLifecycleConfigName:
                defaultNotebook.NotebookInstanceLifecycleConfigName,
            VolumeSizeInGB: defaultNotebook.VolumeSizeInGB,
            emrCluster: 'None',
            clusterId: '',
            NotebookDailyStopTime: defaultStopTime as any,
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
        if (update) {
            DocTitle('Edit Notebook Instance: ', name);
            // If they aren't viewing the notebook via project route we need to make sure we grab
            // the project
            if (!projectName) {
                dispatch(getProject({projectName: name!.split('-')[0]}));
            }
            dispatch(describeNotebookInstance(name!))
                .unwrap()
                .catch(() => {
                    navigate('/404');
                });
            setFields({
                NotebookInstanceName: notebook.NotebookInstanceName,
                InstanceType: notebook.InstanceType,
                NotebookInstanceLifecycleConfigName: notebook.NotebookInstanceLifecycleConfigName,
                VolumeSizeInGB: notebook.VolumeSizeInGB,
                emrCluster: notebookCluster(notebook.NotebookInstanceLifecycleConfigName, 'None'),
                NotebookDailyStopTime: defaultStopTime,
            });
        } else {
            DocTitle('Create Notebook Instance');
        }
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Notebook instances', href: `#${basePath}/notebook` },
                update
                    ? { text: `${name}`, href: `#${basePath}/notebook/${name}` }
                    : { text: 'Create notebook instance', href: `#${basePath}/notebook/create` },
            ])
        );
        dispatch(getNotebookOptions());

        scrollToPageHeader('h1', 'notebook instance');

        // State recursively refreshes for ListNotebookInstanceLifecycleConfigs operation
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, navigate, basePath, name, projectName, update]);

    async function handleSubmit () {
        const parseResult = formSchema.safeParse(state.form);
        if (parseResult.success) {
            setState({ formSubmitting: true });
            const requestPayload = { ...state.form };
            notificationService.generateNotification(
                `${update ? 'Updating' : 'Creating'} notebook instance. Please wait.`,
                'info'
            );
            if (project.metadata?.terminationConfiguration?.defaultNotebookStopTime) {
                if (project.metadata?.terminationConfiguration.allowNotebookOwnerOverride) {
                    if (requestPayload.NotebookDailyStopTime) {
                        // If the user is using UTC nothing to do else we need to ge the local time
                        if (currentUser.preferences?.timezone !== Timezone.UTC) {
                            requestPayload.NotebookDailyStopTime = convertDailyStopTime(
                                requestPayload.NotebookDailyStopTime,
                                currentUser.preferences?.timezone,
                                Timezone.UTC
                            );
                        }
                    } else {
                        // If stopTime time is empty then we're disabling auto stop so send
                        // an empty string to the service
                        requestPayload.NotebookDailyStopTime = '';
                    }
                }
            }
            if (update) {
                dispatch(updateNotebookInstance(requestPayload)).then((response) => {
                    setState({ formSubmitting: false });
                    if (response.type.endsWith('/fulfilled')) {
                        notificationService.generateNotification(
                            `Successfully updated notebook instance ${requestPayload.NotebookInstanceName}.`,
                            'success'
                        );
                        navigate(`${basePath}/notebook/${requestPayload.NotebookInstanceName}`);
                    } else {
                        notificationService.generateNotification(
                            `Failed to edit notebook ${requestPayload.NotebookInstanceName} because: ${response.payload}`,
                            'error'
                        );
                    }
                });
            } else {
                try {
                    const response = await dispatch(
                        createNotebookInstance({
                            notebookInstance: requestPayload,
                            projectName: projectName!,
                        })
                    );

                    if (response.type.endsWith('/fulfilled')) {
                        notificationService.generateNotification(
                            `Successfully created notebook instance ${requestPayload.NotebookInstanceName}`,
                            'success'
                        );
                        navigate(`${basePath}/notebook/${requestPayload.NotebookInstanceName}`);
                    } else {
                        notificationService.generateNotification(
                            `Failed to create notebook instance because: ${response.payload}`,
                            'error'
                        );
                    }
                } catch (err: any) {
                    notificationService.generateNotification(
                        `Failed to create notebook instance because: ${err.response.data}`,
                        'error'
                    );
                }
            }
            setState({ formSubmitting: false });
        } else {
            scrollToInvalid();
            formErrors = issuesToErrors(parseResult.error.issues);
            setState({ validateAll: true, formSubmitting: false });
        }
    }

    return (
        <ContentLayout
            header={
                <div>
                    <Header
                        variant='h1'
                        description='Amazon SageMaker provides pre-built fully managed notebook instances that run Jupyter notebooks. The notebook instances include example code for common model training and hosting exercises.'
                    >
                        {update ? 'Update notebook instance' : 'Create notebook instance'}
                    </Header>
                </div>
            }
        >
            <Form
                actions={
                    <SpaceBetween direction='horizontal' size='xl'>
                        <Button
                            formAction='none'
                            variant='link'
                            onClick={() => {
                                navigate(`${basePath}/notebook`, {
                                    state: { prevPath: window.location.hash },
                                });
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            data-cy='submit'
                            loading={state.formSubmitting}
                            variant='primary'
                            onClick={handleSubmit}
                            disabled={
                                state.formSubmitting ||
                                (update && notebook.NotebookInstanceStatus !== 'Stopped')
                            }
                        >
                            {update ? 'Update notebook instance' : 'Create notebook instance'}
                        </Button>
                    </SpaceBetween>
                }
            >
                <SpaceBetween direction='vertical' size='xxl'>
                    <Container header={<Header variant='h2'>Notebook instance settings</Header>}>
                        <SpaceBetween direction='vertical' size='xxl'>
                            <FormField
                                label='Notebook instance name'
                                errorText={formErrors.NotebookInstanceName}
                            >
                                <Input
                                    data-cy='name-input'
                                    value={state.form.NotebookInstanceName}
                                    onChange={(event) => {
                                        setFields({ NotebookInstanceName: event.detail.value });
                                    }}
                                    onBlur={() => touchFields(['NotebookInstanceName'])}
                                    disabled={update}
                                />
                            </FormField>
                            <FormField
                                label='Notebook instance type'
                                errorText={formErrors?.InstanceType}
                            >
                                <InstanceTypeSelector
                                    enabledInstances='notebook'
                                    selectedOption={
                                        state.form.InstanceType
                                            ? { value: state.form.InstanceType }
                                            : null
                                    }
                                    onChange={({ detail }) => {
                                        setFields({ InstanceType: detail.selectedOption.value });
                                    }}
                                    onBlur={() => touchFields(['InstanceType'])}
                                />
                            </FormField>
                            <FormField
                                label='Attach to EMR Cluster'
                                description='Optionally select an EMR Cluster to attach this notebook to.'
                                secondaryControl={
                                    <SpaceBetween direction='horizontal' size='s'>
                                        <Button
                                            iconName='search'
                                            onClick={() => dispatch(toggleSelectClusterModal(true))}
                                        >
                                            Select EMR Cluster
                                        </Button>
                                        <Button
                                            iconName='remove'
                                            onClick={() => {
                                                setFields({
                                                    clusterId: '',
                                                    emrCluster: '',
                                                    NotebookInstanceLifecycleConfigName:
                                                        'No configuration',
                                                });
                                                touchFields([
                                                    'NotebookInstanceLifecycleConfigName',
                                                ]);
                                            }}
                                            disabled={!state.form.clusterId}
                                        >
                                            Clear
                                        </Button>
                                    </SpaceBetween>
                                }
                            >
                                <Input
                                    placeholder='None'
                                    ariaLabel='EMR Cluster Name'
                                    value={state.form.emrCluster}
                                    data-cy='emr-cluster'
                                    disabled
                                />
                            </FormField>
                            <Condition
                                condition={
                                    !!project.metadata?.terminationConfiguration
                                        ?.defaultNotebookStopTime
                                }
                            >
                                <FormField
                                    label='Daily stop time'
                                    description={`Daily time at which the notebook will be stopped if it is currently running (HH:mm ${timezoneDisplayString(
                                        currentUser.preferences?.timezone
                                    )}). Clear this value to disable automatic stopping of the notebook.`}
                                    errorText={formErrors?.NotebookDailyStopTime}
                                >
                                    <TimeInput
                                        onChange={({ detail }) => {
                                            setFields({ NotebookDailyStopTime: detail.value! });
                                        }}
                                        value={state.form.NotebookDailyStopTime}
                                        format='hh:mm'
                                        placeholder='hh:mm'
                                        onBlur={() => touchFields(['NotebookDailyStopTime'])}
                                        disabled={
                                            !(
                                                hasPermission(
                                                    Permission.PROJECT_OWNER,
                                                    projectPermissions
                                                ) ||
                                                hasPermission(
                                                    Permission.ADMIN,
                                                    currentUser.permissions
                                                )
                                            ) ||
                                            !project.metadata?.terminationConfiguration
                                                ?.allowNotebookOwnerOverride
                                        }
                                    />
                                </FormField>
                            </Condition>

                            <ExpandableSection
                                headerText='Additional configuration'
                                headingTagOverride='h3'
                            >
                                <FormField
                                    label='Lifecycle configuration'
                                    info='Customize your notebook environment with default scripts and plugins.'
                                    description={`If you select 'No configuration', then ${window.env.APPLICATION_NAME} will apply the default lifecycle configuration included in this deployment.`}
                                    errorText={formErrors.NotebookInstanceLifecycleConfigName}
                                >
                                    <Select
                                        selectedOption={{
                                            label: state.form.NotebookInstanceLifecycleConfigName,
                                            value: state.form.NotebookInstanceLifecycleConfigName,
                                        }}
                                        onChange={({ detail }) => {
                                            setFields({
                                                NotebookInstanceLifecycleConfigName:
                                                    detail.selectedOption.label!,
                                            });
                                        }}
                                        onBlur={() =>
                                            touchFields(['NotebookInstanceLifecycleConfigName'])
                                        }
                                        options={(lifecycleConfigs || []).map(
                                            (lifecycleConfig: string) => ({
                                                value: lifecycleConfig,
                                                label: lifecycleConfig,
                                            })
                                        )}
                                        loadingText='Loading lifecycle configurations'
                                        statusType={loadingOptions ? 'loading' : 'finished'}
                                        disabled={!!state.form.clusterId}
                                    />
                                </FormField>
                                <FormField
                                    label='Volume Size'
                                    description='Enter the volume size of the notebook instance in GB. The volume size must be from 5 GB to 16384 GB (16 TB).'
                                    errorText={formErrors.VolumeSizeInGB}
                                >
                                    <Input
                                        value={`${state.form.VolumeSizeInGB}`}
                                        inputMode='numeric'
                                        type='number'
                                        onChange={(e) => {
                                            setFields({ VolumeSizeInGB: Number(e.detail.value) });
                                        }}
                                        onBlur={() => touchFields(['VolumeSizeInGB'])}
                                    />
                                </FormField>
                            </ExpandableSection>
                        </SpaceBetween>
                    </Container>
                </SpaceBetween>
            </Form>
            <Modal
                title='Select an EMR Cluster'
                visible={selectClusterModalVisible}
                dismissText='Cancel'
                confirmText='Select cluster'
                onDismiss={async () => {
                    await dispatch(toggleSelectClusterModal(false));
                }}
                onConfirm={async () => {
                    if (selectedCluster.resourceId) {
                        setFields({
                            clusterId: selectedCluster.resourceId,
                            emrCluster: selectedCluster.metadata.Name,
                            NotebookInstanceLifecycleConfigName: 'No configuration',
                        });
                    }
                    await dispatch(toggleSelectClusterModal(false));
                }}
            >
                <>
                    <p>
                        Select one of the available EMR Clusters listed below to attach this
                        notebook instance to. Notebooks can only be attached to clusters in a &nbsp;
                        <strong>WAITING</strong> state. If the cluster you are looking for is not
                        listed below please check the cluster state.
                    </p>
                    <Table
                        header={<></>}
                        tableName='EMR Cluster'
                        tableType='single'
                        trackBy='resourceId'
                        itemNameProperty='Name'
                        allItems={emrClusters}
                        columnDefinitions={defaultColumns}
                        visibleColumns={['name', 'created']}
                        visibleContentPreference={visibleContentPreference}
                        loadingItems={loadingEMRClusters}
                        loadingText='Loading resources'
                        serverFetch={listEMRClusters}
                        storeClear={clearClustersList}
                        serverRequestProps={{ resourceStatus: EMRStatusState.WAITING }}
                        selectItemsCallback={(clusters: EMRResourceMetadata[]) => {
                            if (clusters.length === 1) {
                                setSelectedCluster(clusters[0]);
                            }
                        }}
                        variant='embedded'
                    />
                </>
            </Modal>
        </ContentLayout>
    );
}

export default NotebookCreate;
