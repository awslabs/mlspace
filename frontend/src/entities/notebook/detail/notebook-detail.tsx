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

import React, { ReactNode, useEffect, useState } from 'react';
import { SpaceBetween, Header, Button } from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../../config/store';
import { INotebook } from '../../../shared/model/notebook.model';
import {
    deleteNotebookInstance,
    describeNotebookInstance,
    loadingNotebookInstance,
    notebookInstance,
    startNotebookInstance,
    stopNotebookInstance,
} from '../notebook.reducer';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { prettyStatus } from '../../../shared/util/table-utils';
import DetailsContainer from '../../../modules/details-container';
import { formatDate, formatTerminationTimestamp } from '../../../shared/util/date-utils';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { setDeleteModal, setResourceScheduleModal } from '../../../modules/modal/modal.reducer';
import { getNotebookInstanceUrl, notebookCluster } from '../notebook.service';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { LogsComponent } from '../../../shared/util/log-utils';
import { Permission } from '../../../shared/model/user.model';
import { modifyResourceTerminationSchedule } from '../../../shared/util/resource-schedule.service';
import { IProject } from '../../../shared/model/project.model';
import { getProject } from '../../project/project.reducer';
import { selectCurrentUser } from '../../user/user.reducer';
import { hasPermission, isAdminOrOwner } from '../../../shared/util/permission-utils';
import { deletionDescription } from '../../../shared/util/form-utils';
import { useBackgroundRefresh, useNotificationService } from '../../../shared/util/hooks';
import ContentLayout from '../../../shared/layout/content-layout';

function NotebookDetail () {
    const { projectName, name } = useParams();

    const notebook: INotebook = useAppSelector(notebookInstance);
    const loadingNotebook = useAppSelector(loadingNotebookInstance);
    const currentUser = useAppSelector(selectCurrentUser);
    const project: IProject = useAppSelector((state) => state.project.project);
    const projectPermissions = useAppSelector((state) => state.project.permissions);
    const [notebookInstanceURL, setNotebookInstanceUrl] = useState('' as string);

    const [initialLoaded, setInitialLoaded] = useState(false);

    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const navigate = useNavigate();
    const basePath = projectName ? `/project/${projectName}` : '/personal';

    scrollToPageHeader();
    DocTitle('Notebook Instance: ', notebook.NotebookInstanceName);

    useEffect(() => {
        if (name) {
            dispatch(describeNotebookInstance(name))
                .unwrap()
                .then((resp) => {
                    if (!projectName && resp.data.Project) {
                        dispatch(getProject({projectName: resp.data.Project}));
                    }
                    setInitialLoaded(true);
                })
                .catch(() => {
                    navigate('/404');
                });
            dispatch(
                setBreadcrumbs([
                    getBase(projectName),
                    { text: 'Notebook instances', href: `#${basePath}/notebook` },
                    { text: `${name}`, href: `#${basePath}/notebook/${name}` },
                ])
            );
        }
    }, [dispatch, navigate, basePath, name, projectName]);

    useEffect(() => {
        if (name && notebook.NotebookInstanceStatus === 'InService') {
            getNotebookInstanceUrl(name).then((response: string) => {
                setNotebookInstanceUrl(response);
            });
        }
    }, [name, notebook.NotebookInstanceStatus]);

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(async () => {
        await dispatch(describeNotebookInstance(name!));
    }, [dispatch], (notebook.NotebookInstanceStatus !== 'InService' && notebook.NotebookInstanceStatus !== 'Stopped' && notebook.NotebookInstanceStatus !== 'Failed'));

    const notebookDetails = new Map<string, ReactNode>();
    notebookDetails.set('Name', notebook.NotebookInstanceName);
    notebookDetails.set('Status', prettyStatus(isBackgroundRefreshing ? 'Loading' : notebook.NotebookInstanceStatus));
    notebookDetails.set('Notebook instance type', notebook.InstanceType);
    notebookDetails.set('Platform identifier', notebook.PlatformIdentifier);
    notebookDetails.set('ARN', notebook.NotebookInstanceArn);
    notebookDetails.set('Creation time', formatDate(notebook.CreationTime));
    notebookDetails.set('Elastic inference', undefined);
    notebookDetails.set(`${window.env.APPLICATION_NAME} owner`, notebook.Owner);
    notebookDetails.set('Lifecycle configuration', notebook.NotebookInstanceLifecycleConfigName);
    notebookDetails.set('Last updated', formatDate(notebook.LastModifiedTime));
    notebookDetails.set('Volume size', notebook.VolumeSizeInGB);
    if (project.metadata?.terminationConfiguration.defaultNotebookStopTime) {
        notebookDetails.set(
            'Auto stop time',
            <>
                {notebook.NotebookDailyStopTime
                    ? formatTerminationTimestamp(notebook.NotebookDailyStopTime)
                    : 'Disabled'}
                {(hasPermission(Permission.PROJECT_OWNER, projectPermissions) ||
                    hasPermission(Permission.ADMIN, currentUser.permissions) ||
                    (project.metadata?.terminationConfiguration?.allowNotebookOwnerOverride &&
                        notebook.Owner === currentUser.username)) && (
                    <Button
                        iconName='edit'
                        variant='inline-icon'
                        onClick={() =>
                            dispatch(
                                setResourceScheduleModal({
                                    timezone: currentUser.preferences?.timezone,
                                    resourceType: 'SageMaker Notebook',
                                    resourceName: name!,
                                    resourceTerminationTime: notebook.NotebookDailyStopTime,
                                    onConfirm: (updatedTerminationDate?: Date) =>
                                        modifyResourceTerminationSchedule(
                                            'notebook',
                                            name!,
                                            updatedTerminationDate
                                        ),
                                    postConfirm: () => dispatch(describeNotebookInstance(name!)),
                                })
                            )
                        }
                        ariaLabel='Edit notebook auto stop time'
                    />
                )}
            </>
        );
    }
    notebookDetails.set(
        'EMR Cluster',
        notebookCluster(notebook.NotebookInstanceLifecycleConfigName, '-')
    );

    const permissionsInfo = new Map<string, any>();
    permissionsInfo.set('IAM role ARN', notebook.RoleArn);
    permissionsInfo.set('Root access', notebook.RootAccess);
    permissionsInfo.set('Encryption key', notebook.KmsKeyId);

    const notebookStopped = ['Stopped', 'Failed'].includes(notebook.NotebookInstanceStatus!);
    const disableLaunch =
        notebook.Owner !== currentUser.username ||
        notebook.NotebookInstanceStatus !== 'InService' ||
        notebookInstanceURL === '';
    const ownerOrPrivileged =
        notebook.Owner === currentUser.username ||
        isAdminOrOwner(currentUser, projectPermissions);
    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    actions={
                        <SpaceBetween direction='horizontal' size='xs'>
                            <Button
                                data-cy='notebook-delete'
                                disabled={!ownerOrPrivileged || !notebookStopped}
                                onClick={() => {
                                    dispatch(
                                        setDeleteModal({
                                            resourceName: notebook.NotebookInstanceName!,
                                            resourceType: 'notebook instance',
                                            onConfirm: async () =>
                                                await dispatch(
                                                    deleteNotebookInstance(
                                                        notebook.NotebookInstanceName!
                                                    )
                                                ),
                                            postConfirm: () => navigate(`${basePath}/notebook`),
                                            description: deletionDescription('Notebook instance'),
                                        })
                                    );
                                }}
                            >
                                Delete
                            </Button>
                            <Button
                                data-cy='notebook-stop'
                                disabled={
                                    !ownerOrPrivileged ||
                                    notebook.NotebookInstanceStatus !== 'InService'
                                }
                                onClick={async () => {
                                    try {
                                        const response = await dispatch(
                                            stopNotebookInstance({
                                                notebookName: notebook.NotebookInstanceName!,
                                                projectName: projectName!,
                                            })
                                        );
                                        if (response.type.endsWith('/fulfilled')) {
                                            notificationService.generateNotification(
                                                `Stopping notebook instance ${notebook.NotebookInstanceName!}.`,
                                                'success'
                                            );
                                            dispatch(
                                                describeNotebookInstance(
                                                    notebook.NotebookInstanceName!
                                                )
                                            );
                                        }
                                    } catch (err: any) {
                                        notificationService.generateNotification(
                                            `Failed to stop notebook instance ${notebook.NotebookInstanceName!} because: ${
                                                err.response.data
                                            }`,
                                            'error'
                                        );
                                    }
                                }}
                            >
                                Stop
                            </Button>
                            <Button
                                data-cy='notebook-start'
                                disabled={
                                    !notebookStopped || notebook.Owner !== currentUser.username
                                }
                                onClick={async () => {
                                    try {
                                        const response = await dispatch(
                                            startNotebookInstance({
                                                notebookName: notebook.NotebookInstanceName!,
                                                projectName: projectName!,
                                            })
                                        );
                                        if (response.type.endsWith('/fulfilled')) {
                                            notificationService.generateNotification(
                                                `Successfully started notebook instance ${notebook.NotebookInstanceName!}.`,
                                                'success'
                                            );
                                        }
                                        dispatch(
                                            describeNotebookInstance(notebook.NotebookInstanceName!)
                                        );
                                    } catch (err: any) {
                                        notificationService.generateNotification(
                                            `Failed to start notebook instance ${notebook.NotebookInstanceName!} because: ${
                                                err.response.data
                                            }`,
                                            'error'
                                        );
                                    }
                                }}
                            >
                                Start
                            </Button>
                            <Button
                                data-cy='notebook-jupyter'
                                disabled={disableLaunch}
                                href={notebookInstanceURL}
                                target='_blank'
                                ariaLabel='Open Jupyter notebook in new tab'
                            >
                                Open Jupyter
                            </Button>
                            <Button
                                data-cy='notebook-jupyter-lab'
                                disabled={disableLaunch}
                                href={`${notebookInstanceURL}&view=lab`}
                                target='_blank'
                                ariaLabel='Open JupyterLab notebook in new tab'
                            >
                                Open JupyterLab
                            </Button>
                        </SpaceBetween>
                    }
                >
                    {notebook.NotebookInstanceName}
                </Header>
            }
        >
            <SpaceBetween direction='vertical' size='xxl'>
                <DetailsContainer
                    header='Notebook instance settings'
                    columns={4}
                    info={notebookDetails}
                    actions={
                        <Button
                            data-cy='notebook-edit'
                            disabled={!notebookStopped}
                            onClick={() =>
                                navigate(
                                    `${basePath}/notebook/${notebook.NotebookInstanceName}/edit`
                                )
                            }
                        >
                            Edit
                        </Button>
                    }
                    loading={loadingNotebook && !initialLoaded}
                />
                <DetailsContainer
                    header='Permissions and encryption'
                    columns={3}
                    info={permissionsInfo}
                    loading={loadingNotebook && !initialLoaded}
                />
                <LogsComponent
                    resourceType='NotebookInstances'
                    resourceName={name!}
                    resourceCreationTime={notebook.CreationTime}
                />
            </SpaceBetween>
        </ContentLayout>
    );
}

export default NotebookDetail;
