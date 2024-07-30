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
    ButtonDropdown,
    Icon,
    SpaceBetween,
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../../../config/store';
import {
    selectCurrentUser,
} from '../../../user/user.reducer';
import { isAdminOrProjectOwner, togglePermission } from '../../../../shared/util/permission-utils';
import { useParams } from 'react-router-dom';
import { useNotificationService } from '../../../../shared/util/hooks';
import AddProjectGroupModal from './add-project-group-modal';
import { TableActionProps } from '../../../../modules/table/table.types';
import { getAllGroups, selectAllGroups } from '../../../group/group.reducer';
import { removeGroupFromProject, selectProject, updateProjectGroup } from '../../project.reducer';
import { setDeleteModal } from '../../../../modules/modal/modal.reducer';
import { CallbackFunction } from '../../../../types';
import { Permission } from '../../../../shared/model/user.model';
import { IProjectGroup } from '../../../../shared/model/projectGroup.model';
import { isRejected } from '@reduxjs/toolkit';

export type ProjectGroupActionProps = TableActionProps<IProjectGroup> & {
    refreshHandler: CallbackFunction,
    projectGroups?: IProjectGroup[]
};

function ProjectGroupActions (props?: ProjectGroupActionProps) {
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [performingAction, setPerformingAction] = useState<boolean>(false);
    const project = useAppSelector(selectProject);
    const allGroups = useAppSelector(selectAllGroups);
    const addableGroups = allGroups.filter((group) => {
        return !props?.projectGroups?.map((project_group) => project_group.group)?.includes(group.name);
    });

    const actionItems = [
        {
            text: `${props?.selectedItems?.[0]?.permissions?.includes(Permission.PROJECT_OWNER)
                ? 'Remove'
                : 'Make'
            } Project Owner`,
            id: 'owner',
            disabled: props?.selectedItems?.length !== 1,
        },
        { text: 'Remove from Project', id: 'remove' },
    ];

    useEffect(() => {
        dispatch(getAllGroups());
    }, [dispatch]);

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <AddProjectGroupModal dispatch={dispatch} visible={showModal} setVisible={setShowModal} addableGroups={addableGroups} project={project} refresh={props?.refreshHandler} />

            <Button
                onClick={() => props?.refreshHandler?.()}
                ariaLabel={'Refresh project groups list'}
            >
                <Icon name='refresh' />
            </Button>
            
            <ButtonDropdown
                items={actionItems}
                variant='primary'
                disabled={performingAction || (0 === props?.selectedItems?.length)}
                onItemClick={(e) => {
                    switch (e.detail.id) {
                        case 'owner':
                            Promise.allSettled((props?.selectedItems || []).map((project_group) => {
                                togglePermission(Permission.PROJECT_OWNER, project_group.permissions!);
                                return dispatch(updateProjectGroup(project_group)).then((response) => {
                                    if (isRejected(response)) {
                                        notificationService.showAxiosRejectedActionNotification('update group permissions', response);
                                    }
                                });
                            })).finally(() => {
                                props?.refreshHandler?.();
                            });
                            break;
                        case 'remove':
                            dispatch(setDeleteModal({
                                resourceName: 'Project group',
                                resourceType: 'projectGroup',
                                description: `This will remove groups from the project: ${projectName}.`,
                                disabled: performingAction,
                                onConfirm: async () => {
                                    setPerformingAction(true);
                                    
                                    await Promise.allSettled((props?.selectedItems || []).map((project_group) => dispatch(removeGroupFromProject(project_group)).then((response) => {
                                        notificationService.showAxiosActionNotification(
                                            'add group to project',
                                            `Added ${project_group.group}} to project: ${projectName}.`,
                                            response
                                        );
                                    }))).finally(() => {
                                        setPerformingAction(false);
                                        props?.refreshHandler?.();
                                    });
                                }
                            }));
                            break;
                        default:
                            return;
                    }
                }}
            >
                Actions
            </ButtonDropdown>

            <Button
                variant='primary'
                disabled={!IsAdminOrProjectOwner() || addableGroups.length === 0}
                onClick={() => setShowModal(true)}
            >
                Add Group
            </Button>
        </SpaceBetween>
    );
}

function IsAdminOrProjectOwner () {
    const currentUser = useAppSelector(selectCurrentUser);
    const projectPermissions = useAppSelector((state) => state.project.permissions);
    return isAdminOrProjectOwner(currentUser, projectPermissions);
}

export { ProjectGroupActions };
