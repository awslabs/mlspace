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
import {
    Button,
    ButtonDropdown,
    FlashbarProps,
    Icon,
    SpaceBetween,
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import {
    toggleAddUserModal,
    addUsersToProject,
    removeUserFromProject,
    getUsersInProject,
    updateUsersInProject,
    selectCurrentUser,
} from '../../user/user.reducer';
import { IUser, Permission } from '../../../shared/model/user.model';
import { IProjectUser } from '../../../shared/model/projectUser.model';
import { isAdminOrProjectOwner, togglePermission } from '../../../shared/util/permission-utils';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { useParams } from 'react-router-dom';
import { setUpdateModal } from '../../../modules/modal/modal.reducer';

function ProjectUserActions (props?: any) {
    const projectName = props?.projectName;
    const dispatch = useAppDispatch();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <Button
                onClick={() => dispatch(getUsersInProject(projectName))}
                ariaLabel={'Refresh project users list'}
            >
                <Icon name='refresh' />
            </Button>
            {ProjectUserActionButton(dispatch, props)}
            {ProjectUserAddButton()}
        </SpaceBetween>
    );
}

function AddProjectUserActions (props?: any) {
    const dispatch = useAppDispatch();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {AddProjectUserActionButton(dispatch, props)}
        </SpaceBetween>
    );
}

function IsAdminOrProjectOwner () {
    const currentUser = useAppSelector(selectCurrentUser);
    const projectPermissions = useAppSelector((state) => state.project.permissions);
    return isAdminOrProjectOwner(currentUser, projectPermissions);
}

function ProjectUserActionButton (dispatch: Dispatch, props?: any) {
    const selectedUsers: IProjectUser[] = props?.selectedItems;
    const projectName = props?.projectName;

    const items = [
        {
            text: `${
                selectedUsers[0]?.permissions?.includes(Permission.PROJECT_OWNER)
                    ? 'Remove'
                    : 'Make'
            } Project Owner`,
            id: 'owner',
            disabled: selectedUsers.length > 1 ? true : false,
        },
        {
            text: `${
                selectedUsers[0]?.permissions?.includes(Permission.COLLABORATOR) ? 'Remove' : 'Make'
            } Collaborator`,
            id: 'collaborator',
            disabled: selectedUsers.length > 1 ? true : false,
        },
        { text: 'Remove from Project', id: 'remove' },
    ];
    const disabled =
        !IsAdminOrProjectOwner() || (Array.isArray(selectedUsers) && selectedUsers.length === 0);
    return (
        <ButtonDropdown
            items={items}
            variant='primary'
            disabled={disabled}
            onItemClick={(e) => ProjectUserActionHandler(e, selectedUsers, projectName, dispatch)}
        >
            Actions
        </ButtonDropdown>
    );
}

async function addProjectUsers (
    projectName: string,
    users: IUser[],
    dispatch: ThunkDispatch<any, any, Action>
) {
    const notificationService = NotificationService(dispatch);
    const response = await dispatch(
        addUsersToProject({
            usernames: users.map((user) => user.username!),
            projectName: projectName!,
        })
    );
    let message = 'Failed to add user(s) to Project.';
    let responseType: FlashbarProps.Type = 'error';
    if (response.type.endsWith('fulfilled')) {
        message = 'Successfully added user(s) to Project.';
        responseType = 'success';
    }
    notificationService.generateNotification(message, responseType);
}

function AddProjectUserActionButton (dispatch: Dispatch, props?: any) {
    const { projectName } = useParams();
    const selectedUsers: IUser[] = props?.selectedItems;

    const items = [{ text: 'Add to Project', id: 'add_member' }];

    return (
        <ButtonDropdown
            items={items}
            variant='primary'
            disabled={!selectedUsers}
            onItemClick={() => addProjectUsers(projectName!, selectedUsers, dispatch)}
        >
            Actions
        </ButtonDropdown>
    );
}

function ProjectUserAddButton () {
    const dispatch = useAppDispatch();
    return (
        <Button
            variant='primary'
            disabled={!IsAdminOrProjectOwner()}
            onClick={() => dispatch(toggleAddUserModal(true))}
        >
            Add User
        </Button>
    );
}

const ProjectUserActionHandler = async (
    e: any,
    selectedUsers: IProjectUser[],
    projectName: string,
    dispatch: ThunkDispatch<any, any, Action>
) => {
    switch (e.detail.id) {
        case 'collaborator':
            for (const user of selectedUsers) {
                // Use lodash once it's added
                const updatedUser: IProjectUser = JSON.parse(JSON.stringify(user));
                togglePermission(Permission.COLLABORATOR, updatedUser.permissions!);
                await dispatch(updateUsersInProject(updatedUser));
            }
            break;
        case 'owner':
            for (const user of selectedUsers) {
                // Use lodash once it's added
                const updatedUser: IProjectUser = JSON.parse(JSON.stringify(user));
                togglePermission(Permission.PROJECT_OWNER, updatedUser.permissions!);
                await dispatch(updateUsersInProject(updatedUser));
            }
            break;
        case 'remove':
            for (const user of selectedUsers) {
                dispatch(
                    setUpdateModal({
                        selectedUser: user,
                        onConfirm: async () => await dispatch(removeUserFromProject(user)),
                        postConfirm: () => dispatch(getUsersInProject(projectName)),
                        description: `This will remove ${user.user} from the project ${projectName}.`,
                    })
                );
            }
            break;
        default:
            return;
    }
    await dispatch(getUsersInProject(projectName));
};

export { ProjectUserActions, AddProjectUserActions };
