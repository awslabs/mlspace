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
import { useAppSelector, useAppDispatch } from '../../../config/store';
import Modal from '../../../modules/modal';
import Table from '../../../modules/table';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { IUser } from '../../../shared/model/user.model';
import { projectUserColumns, visibleProjectUserColumns } from '../../user/user.columns';
import AddProjectUser from './add/user-add';
import { ProjectUserActions } from './project.user.actions';
import {
    getUsersInProject,
    getAllUsers,
    toggleAddUserModal,
    addUsersToProject,
} from '../../user/user.reducer';
import { IProjectUser } from '../../../shared/model/projectUser.model';
import { useParams } from 'react-router-dom';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle } from '../../../../src/shared/doc';
import { useNotificationService } from '../../../shared/util/hooks';

export function ProjectUser () {
    const { projectName } = useParams();
    const projectUsers: IProjectUser[] = useAppSelector((state) => state.user.projectUsers);
    const loadingProjectUsers = useAppSelector((state) => state.user.loading);
    const allUsers: IUser[] = useAppSelector((state) => state.user.allUsers);
    const addUserModal: boolean = useAppSelector((state) => state.user.addUserModal);
    const tableType = 'multi';
    const actions = (e: any) => ProjectUserActions({ ...e, projectName });
    const projectUsernames = projectUsers.map((user) => user.user);
    const addableUsers = allUsers.filter((user) => !projectUsernames.includes(user.username!));

    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);

    DocTitle(projectName!.concat(' Project Members'));

    let selectedUsers: IUser[] = [];

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Users', href: `#/project/${projectName}/user` },
            ])
        );
        dispatch(getUsersInProject(projectName!));
        dispatch(getAllUsers());
    }, [dispatch, projectName]);

    return (
        <div>
            <Table
                tableName='Project user'
                tableType={tableType}
                actions={actions}
                trackBy='user'
                allItems={projectUsers}
                columnDefinitions={projectUserColumns}
                visibleColumns={visibleProjectUserColumns}
                loadingItems={loadingProjectUsers}
                loadingText='Loading Project users'
            />
            <Modal
                title='Add user to Project'
                visible={addUserModal}
                dismissText='Cancel'
                confirmText='Add users'
                onDismiss={async () => {
                    await dispatch(getUsersInProject(projectName!));
                    await dispatch(toggleAddUserModal(false));
                }}
                onConfirm={async () => {
                    if (selectedUsers.length > 0) {
                        await dispatch(
                            addUsersToProject({
                                usernames: selectedUsers.map((user) => user.username!),
                                projectName: projectName!,
                            })
                        ).then((result: any) => {
                            if (result.type.endsWith('/fulfilled')) {
                                notificationService.generateNotification(
                                    `Successfully added user${selectedUsers.length > 1 ? 's' : ''}`,
                                    'success'
                                );
                            } else {
                                notificationService.generateNotification(
                                    `Failed to add user${selectedUsers.length > 1 ? 's' : ''}`,
                                    'error'
                                );
                            }
                        });
                    }
                    await dispatch(getUsersInProject(projectName!));
                    await dispatch(toggleAddUserModal(false));
                }}
            >
                <AddProjectUser
                    users={addableUsers}
                    selectUsers={(users: IUser[]) => (selectedUsers = users)}
                />
            </Modal>
        </div>
    );
}

export default ProjectUser;
