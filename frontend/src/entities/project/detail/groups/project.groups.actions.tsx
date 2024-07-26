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
import { isAdminOrProjectOwner } from '../../../../shared/util/permission-utils';
import { useParams } from 'react-router-dom';
import { useNotificationService } from '../../../../shared/util/hooks';
import AddProjectGroupModal from './add-project-group-modal';
import { TableActionProps } from '../../../../modules/table/table.types';
import { IGroup } from '../../../../shared/model/group.model';
import { getAllGroups, selectAllGroups } from '../../../group/group.reducer';
import { selectProject, updateProject } from '../../project.reducer';
import _ from 'lodash';
import { setDeleteModal } from '../../../../modules/modal/modal.reducer';
import { CallbackFunction } from '../../../../types';

export type ProjectGroupActionProps = TableActionProps<IGroup> & {
    refreshHandler: CallbackFunction
};

function ProjectGroupActions (props?: ProjectGroupActionProps) {
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [performingAction, setPerformingAction] = useState<boolean>(false);
    const project = useAppSelector(selectProject);
    const allGroups = useAppSelector(selectAllGroups);
    const addableGroups = allGroups.filter((group) => !(project?.groups || []).includes(group.name));
    console.log('allGroups', allGroups, 'addableGroups', addableGroups, 'project.groups', project?.groups);
    const actionItems = [
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
                        case 'remove':
                            dispatch(setDeleteModal({
                                resourceName: 'Project group',
                                resourceType: 'projectGroup',
                                description: `This will remove groups from the project: ${projectName}.`,
                                disabled: performingAction,
                                onConfirm: async () => {
                                    setPerformingAction(true);
                                    const project_clone = _.cloneDeep(project);
                                    project_clone.groups = (project_clone?.groups || []).filter((group_name) =>
                                        props?.selectedItems?.findIndex((group) => group_name === group.name) || -1 !== -1
                                    );
                        
                                    await dispatch(updateProject(project_clone)).then((response) => {
                                        notificationService.showAxiosActionNotification(
                                            'remove groups from project',
                                            'Removed groups from project.',
                                            response
                                        );                                    
                                        
                                        return props?.refreshHandler?.();
                                    }).finally(() => {
                                        setPerformingAction(false);
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
