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

import React, { RefObject } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    deleteNotebookInstance,
    startNotebookInstance,
    stopNotebookInstance,
} from './notebook.reducer';
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { Action, Dispatch, ThunkDispatch, isFulfilled } from '@reduxjs/toolkit';
import NotificationService from '../../shared/layout/notification/notification.service';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { openNotebookInstance } from './notebook.service';
import { selectCurrentUser } from '../user/user.reducer';
import { NotebookResourceMetadata } from '../../shared/model/resource-metadata.model';
import { isAdminOrProjectOwner } from '../../shared/util/permission-utils';
import { deletionDescription } from '../../shared/util/form-utils';

function NotebookActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const nav = (endpoint: string) => navigate(endpoint);
    const createNotebookRef = props?.focusProps?.createNotebookRef;
    const { projectName } = useParams();
    const currentUser = useAppSelector(selectCurrentUser);
    const projectPermissions = useAppSelector((state) => state.project.permissions);

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {NotebookActionButton(dispatch, nav, projectName, {
                currentUser,
                projectPermissions,
                ...props,
            })}
            {NotebookCreateButton(projectName, createNotebookRef)}
        </SpaceBetween>
    );
}

function NotebookActionButton (
    dispatch: Dispatch,
    nav: (endpoint: string) => void,
    projectName?: string,
    props?: any
) {
    const selectedNotebook: NotebookResourceMetadata = props?.selectedItems[0];
    const loadingAction = props?.loadingAction;
    const notebookStopped = ['Stopped', 'Failed'].includes(
        selectedNotebook?.metadata.NotebookInstanceStatus
    );
    const disableLaunch =
        selectedNotebook?.user !== props.currentUser.username ||
        selectedNotebook?.metadata.NotebookInstanceStatus !== 'InService';
    const ownerOrPrivileged =
        selectedNotebook?.user === props.currentUser.username ||
        isAdminOrProjectOwner(props.currentUser, props.projectPermissions);
    return (
        <ButtonDropdown
            items={[
                { text: 'Details', id: 'details' },
                {
                    text: 'Open Jupyter',
                    id: 'open_jupyter',
                    disabled: disableLaunch,
                },
                {
                    text: 'Open JupyterLab',
                    id: 'open_jupyterlab',
                    disabled: disableLaunch,
                },
                {
                    text: 'Stop',
                    id: 'stop',
                    disabled:
                        !ownerOrPrivileged ||
                        selectedNotebook?.metadata.NotebookInstanceStatus !== 'InService',
                },
                {
                    text: 'Start',
                    id: 'start',
                    disabled:
                        selectedNotebook?.user !== props.currentUser.username || !notebookStopped,
                },
                {
                    text: 'Update Settings',
                    id: 'update_settings',
                    disabled: !ownerOrPrivileged || !notebookStopped,
                },
                {
                    text: 'Delete',
                    id: 'delete',
                    disabled: !ownerOrPrivileged || !notebookStopped,
                },
            ]}
            variant='primary'
            disabled={selectedNotebook === undefined}
            loading={loadingAction}
            onItemClick={(e) =>
                NotebookActionHandler(e, selectedNotebook, nav, dispatch, projectName)
            }
        >
            Actions
        </ButtonDropdown>
    );
}

function NotebookCreateButton (
    projectName?: string,
    createNotebookRef?: RefObject<HTMLInputElement>
) {
    const navigate = useNavigate();
    return (
        projectName && (
            <Button
                variant='primary'
                ref={createNotebookRef}
                onClick={() => navigate(`/project/${projectName}/notebook/create`)}
            >
                Create notebook instance
            </Button>
        )
    );
}

const NotebookActionHandler = async (
    e: any,
    notebook: NotebookResourceMetadata,
    nav: (endpoint: string) => void,
    dispatch: ThunkDispatch<any, any, Action>,
    projectName?: string
) => {
    const basePath = projectName ? `/project/${projectName}` : '/personal';
    const notificationService = NotificationService(dispatch);

    let response: any | undefined = undefined;
    switch (e.detail.id) {
        case 'details':
            nav(`${basePath}/notebook/${notebook.resourceId}`);
            break;
        case 'open_jupyter':
            openNotebookInstance(notebook.resourceId);
            break;
        case 'open_jupyterlab':
            openNotebookInstance(notebook.resourceId, true);
            break;
        case 'stop':
            response = await dispatch(
                stopNotebookInstance({
                    notebookName: notebook.resourceId!,
                    projectName: projectName!,
                })
            );
            if (isFulfilled(response)) {
                notificationService.generateNotification(
                    `Successfully stopped notebook instance ${notebook.resourceId}`,
                    'success'
                );
            }
            break;
        case 'start':
            response = await dispatch(
                startNotebookInstance({
                    notebookName: notebook.resourceId!,
                    projectName: projectName!,
                })
            );
            if (isFulfilled(response)) {
                notificationService.generateNotification(
                    `Successfully started notebook instance ${notebook.resourceId}`,
                    'success'
                );
            }
            break;
        case 'update_settings':
            nav(`${basePath}/notebook/${notebook.resourceId}/edit`);
            break;
        case 'delete':
            dispatch(
                setDeleteModal({
                    resourceName: notebook.resourceId!,
                    resourceType: 'notebook instance',
                    onConfirm: async () =>
                        await dispatch(deleteNotebookInstance(notebook.resourceId!)),
                    postConfirm: () => nav(`${basePath}/notebook`),
                    description: deletionDescription('Notebook instance'),
                })
            );
            break;
    }
    if (response && !isFulfilled(response)) {
        notificationService.generateNotification(
            `Failed to ${e.detail.id} notebook instance ${notebook.resourceId} because: ${response.payload}`,
            'error'
        );
    }
};

export default NotebookActions;
