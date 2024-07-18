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
import {
    Box,
    Button,
    Header,
    Modal,
    SpaceBetween
} from '@cloudscape-design/components';
import Table from '../../../modules/table';
import React, { useState } from 'react';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { IProject } from '../../../shared/model/project.model';
import { addUsersToProject } from '../user.reducer';
import { projectColumns } from '../../project/project.columns';
import { useAppDispatch } from '../../../config/store';
import { useNotificationService } from '../../../shared/util/hooks';

export type AddProjectUserModalProps = {
    dispatch:  ThunkDispatch<any, any, Action>,
    visible: boolean;
    setVisible: (boolean) => void;
    addableProjects: IProject[];
    username: string,
    refresh?: () => void
};

export function AddProjectUserModal (props: AddProjectUserModalProps) {
    const [selectedProjects, setSelectedProjects] = useState<IProject[]>([]);
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const [performingAction, setPerformingAction] = useState(false);

    return (
        <Modal
            visible={props.visible}
            onDismiss={() => props.setVisible(false)}
            header={<Header>Add user to Project</Header>}
            footer={
                <Box float='right'>
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button onClick={() => props.setVisible(false)}>Cancel</Button>
                        <Button
                            variant='primary'
                            loading={performingAction}
                            loadingText={'Adding project'}
                            disabled={selectedProjects.length === 0 || performingAction}
                            onClick={() => {
                                setPerformingAction(true);

                                Promise.allSettled(selectedProjects.map((project) => props.dispatch(addUsersToProject({
                                    projectName: project.name!,
                                    usernames: [props.username]
                                })).then((response) => {
                                    notificationService.showAxiosActionNotification(
                                        'add user to project',
                                        `Added ${props.username} to project: ${project.name}.`,
                                        response
                                    );
                                }))).finally(() => {
                                    setPerformingAction(false);
                                    setSelectedProjects([]);
                                    props?.refresh?.();
                                    props.setVisible(false);
                                });
                            }}>
                            Add project
                        </Button>
                    </SpaceBetween>
                </Box>
            }
        >
            <SpaceBetween direction='vertical' size='s'>
                <Table
                    tableName='Project'
                    header={<></>}
                    tableType='multi'
                    selectItemsCallback={(e) => {
                        setSelectedProjects(e);
                    }}
                    trackBy='name'
                    allItems={props.addableProjects}
                    columnDefinitions={projectColumns}
                    variant='embedded'
                    keepSelection={props?.visible}
                />
            </SpaceBetween>
        </Modal>
    );
}

export default AddProjectUserModal;