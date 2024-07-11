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
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { Button, Icon, SpaceBetween } from '@cloudscape-design/components';
import { getUserProjects, removeUserFromProject } from '../user.reducer';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TableActionProps } from '../../../modules/table/table.types';
import { isSuccessfulResponse } from '../../../shared/reducers/reducer.utils';
import { setDeleteModal } from '../../../modules/modal/modal.reducer';
import { IProjectUser } from '../../../shared/model/projectUser.model';
import { IProject } from '../../../shared/model';
import { listProjectsForUser, selectUserProjects } from '../../project/project.reducer';
import AddProjectUserModal from './add-project-user-modal';
import { useNotificationService } from '../../../shared/util/hooks';

function UserDetailProjectActions (props?: TableActionProps<IProjectUser>) {
    const dispatch = useAppDispatch();
    const {username} = useParams();
    const [addUserModalVisible, setAddUserModalVisible] = useState(false);
    const notificationService = useNotificationService(dispatch);

    const allProjects: IProject[] = useAppSelector(selectUserProjects);
    const projectNames = props?.allItems.map((project) => project.project) || [];
    const addableProjects = allProjects.filter((project) => !projectNames.includes(project.name!));


    useEffect(() => {
        dispatch(listProjectsForUser());
    }, [dispatch]);

    const refreshHandler = () => {
        if (username !== undefined) {
            dispatch(getUserProjects(username)).then((response) => {
                if (isSuccessfulResponse(response)) {
                    props?.setItemsOverride?.(response.payload.data);
                }
            });
        }
    };

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <AddProjectUserModal dispatch={dispatch} setVisible={setAddUserModalVisible} visible={addUserModalVisible} addableProjects={addableProjects} username={username!} refresh={refreshHandler} />
            <Button onClick={refreshHandler} ariaLabel={'Refresh projects list'}>
                <Icon name='refresh'/>
            </Button>
            <Button
                disabled={(props?.selectedItems?.length || 0) < 1}
                onClick={() => dispatch(
                    setDeleteModal({
                        resourceName: 'Project User',
                        resourceType: 'projectUser',
                        description: `This will remove user: ${username} from the project: ${props?.selectedItems?.[0].project}.`,
                        onConfirm: async () => {
                            const projectUser = props?.selectedItems?.[0];
                            if (projectUser) {
                                dispatch(removeUserFromProject(projectUser)).then((response) => {
                                    if (isSuccessfulResponse(response)) {
                                        notificationService.showActionNotification(
                                            'remove project user',
                                            `User ${username} removed from ${props?.selectedItems?.[0].project}.`,
                                            response
                                        );
    
                                    }
                                }).finally(() => {
                                    dispatch(refreshHandler);
                                });
                            }
                        }
                    })
                )}
                variant='normal'
            >
                Remove Project
            </Button>
            <Button
                disabled={addableProjects.length < 1}
                variant='primary'
                onClick={() => setAddUserModalVisible(true)}
            >
                Add Project
            </Button>
        </SpaceBetween>
    );
}

export { UserDetailProjectActions };