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

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import { ButtonDropdown, ButtonDropdownProps, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { IProject } from '../../../shared/model/project.model';
import { removeUserFromProject, selectCurrentUser } from '../../user/user.reducer';
import { selectProject } from '../card/project-card.reducer';
import { deleteProject, getProject, listProjectsForUser, updateProject } from '../project.reducer';
import { useAuth } from 'react-oidc-context';
import { hasPermission } from '../../../shared/util/permission-utils';
import { Permission } from '../../../shared/model/user.model';
import Modal, { ModalProps } from '../../../modules/modal';
import { useNotificationService } from '../../../shared/util/hooks';
import { INotificationService } from '../../../shared/layout/notification/notification.service';

function ProjectDetailActions () {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const auth = useAuth();
    const nav = (endpoint: string) => navigate(endpoint);
    const { projectName } = useParams();
    let project: IProject = useAppSelector((state) => state.project.project);
    if (!project) {
        project = { name: projectName };
    }
    const username = auth.user!.profile.preferred_username!;

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {ProjectActionButton(nav, dispatch, { ...project }, projectName!, username)}
        </SpaceBetween>
    );
}

function ProjectActionButton (
    nav: (endpoint: string) => void,
    dispatch: Dispatch,
    project: IProject,
    projectName: string,
    username: string
) {
    const actionItems: Array<ButtonDropdownProps.ItemOrGroup> = [];
    const currentUser = useAppSelector(selectCurrentUser);
    const projectPermissions = useAppSelector((state) => state.project.permissions);
    const notificationService = useNotificationService(dispatch);

    const [modalState, setModalState] = React.useState<Partial<ModalProps>>({
        visible: false,
        confirmText: 'Confirm',
        dismissText: 'Cancel',
    });

    const canManage = hasPermission(Permission.PROJECT_OWNER, projectPermissions) || hasPermission(Permission.ADMIN, currentUser.permissions);
    const actionVerb = canManage ? 'Manage' : 'View';

    actionItems.push(
        ...[
            { text: `${actionVerb} membership`, id: 'membership' },
            { text: 'Leave Project', id: 'leave_project' },
        ]
    );

    if (canManage) {
        actionItems.push(
            ...[
                { text: 'Update', id: 'update' },
            ]
        );

        // if not suspended allow suspend
        if (!project.suspended) {
            actionItems.push({ text: 'Suspend project', id: 'suspend_project' });
        } else {
            actionItems.push({ text: 'Reinstate project', id: 'reinstate_project' });
            actionItems.push({ text: 'Delete project', id: 'delete_project' });
        }
    }

    return (
        <ButtonDropdown
            items={actionItems}
            variant='primary'
            disabled={project === undefined}
            onItemClick={(e) =>
                ProjectActionHandler(
                    e,
                    project,
                    projectName,
                    username,
                    nav,
                    dispatch,
                    modalState as ModalProps,
                    setModalState,
                    notificationService
                )
            }
        >
            <Modal {...(modalState as ModalProps)} />
            Actions
        </ButtonDropdown>
    );
}

const ProjectActionHandler = (
    e: any,
    project: IProject,
    projectName: string, 
    username: string,
    nav: (endpoint: string) => void,
    dispatch: ThunkDispatch<any, any, Action>,
    modalState: ModalProps,
    setModalState: (state: Partial<ModalProps>) => void,
    notificationService: INotificationService
) => {
    switch (e.detail.id) {
        case 'update':
            nav(`/project/${projectName}/edit`);
            break;
        case 'membership':
            nav(`/project/${projectName}/membership`);
            break;
        case 'leave_project':
            dispatch(removeUserFromProject({ user: username, project: projectName })).then(() => {
                dispatch(selectProject());
                dispatch(listProjectsForUser());
                nav('/');
            });
            break;
        case 'suspend_project':
            setModalState({
                ...modalState,
                visible: true,
                title: `Suspend ${projectName}?`,
                confirmText: 'Suspend',
                onConfirm: async () =>
                    dispatch(updateProject({ name: projectName, suspended: true })).then(
                        (result) => {
                            setModalState({
                                ...modalState,
                                visible: false,
                            });
                            notificationService.showActionNotification(
                                'suspend project',
                                `Project ${projectName} suspended.`,
                                result
                            );
                            if (result.type.endsWith('/fulfilled')) {
                                project.suspended = true;
                                dispatch(getProject({projectName: projectName}));
                            }
                        }
                    ),
                onDismiss: async () => setModalState({ ...modalState, visible: false }),
            });
            break;
        case 'reinstate_project':
            dispatch(updateProject({ name: projectName, suspended: false })).then((result) => {
                notificationService.showActionNotification(
                    'reinstate project',
                    `Project ${projectName} reinstated.`,
                    result
                );
                if (result.type.endsWith('/fulfilled')) {
                    project.suspended = false;
                    dispatch(getProject({projectName: projectName}));
                }
            });
            break;
        case 'delete_project':
            setModalState({
                ...modalState,
                visible: true,
                title: `Delete ${projectName}?`,
                confirmText: 'Delete',
                onConfirm: async () =>
                    dispatch(deleteProject(projectName)).then((result) => {
                        setModalState({
                            ...modalState,
                            visible: false,
                        });
                        notificationService.showActionNotification(
                            'delete project',
                            `Project ${projectName} deleted.`,
                            result
                        );
                        if (result.type.endsWith('/fulfilled')) {
                            nav('/');
                        }
                    }),
                onDismiss: async () => setModalState({ ...modalState, visible: false }),
            });
            break;
    }
};

export default ProjectDetailActions;
