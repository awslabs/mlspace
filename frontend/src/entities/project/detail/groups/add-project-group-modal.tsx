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
import Table from '../../../../modules/table';
import React, { useState } from 'react';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { IGroup } from '../../../../shared/model/group.model';
import { groupColumns } from '../../../group/group.columns';
import { addGroupsToProject } from '../../project.reducer';
import { IProject } from '../../../../shared/model';
import { useNotificationService } from '../../../../shared/util/hooks';
import { useAppDispatch } from '../../../../config/store';

export type AddProjectUserModalProps = {
    dispatch:  ThunkDispatch<any, any, Action>,
    visible: boolean;
    setVisible: (boolean) => void;
    addableGroups: IGroup[];
    project: IProject,
    refresh?: () => void
};

export function AddProjectGroupModal (props: AddProjectUserModalProps) {
    const [selectedGroups, setSelectedGroups] = useState<IGroup[]>([]);
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const [performingAction, setPerformingAction] = useState(false);

    return (
        <Modal
            visible={props.visible}
            onDismiss={() => props.setVisible(false)}
            header={<Header>Add group to Project</Header>}
            footer={
                <Box float='right'>
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button onClick={() => props.setVisible(false)}>Cancel</Button>
                        <Button
                            variant='primary'
                            loading={performingAction}
                            loadingText={'Adding group'}
                            disabled={selectedGroups.length === 0 || performingAction}
                            onClick={() => {
                                
                                if (!props.project) {
                                    return;
                                }
                                
                                if (props.project.name) {
                                    setPerformingAction(true);
                                    dispatch(addGroupsToProject({projectName: props.project.name, groupNames: selectedGroups.map((group) => group.name)})).then((response) => {
                                        notificationService.showAxiosActionNotification(
                                            'add groups to project',
                                            'Added groups to project.',
                                            response
                                        );
                                    }).finally(() => {
                                        setSelectedGroups([]);
                                        setPerformingAction(false);
                                        props?.refresh?.();
                                        props.setVisible(false);
                                    });
                                }
                            }}>
                            Add group
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
                    selectItemsCallback={(e) => setSelectedGroups(e || [])}
                    trackBy='name'
                    allItems={props.addableGroups}
                    columnDefinitions={groupColumns}
                    variant='embedded'
                    keepSelection={props?.visible}
                />
            </SpaceBetween>
        </Modal>
    );
}

export default AddProjectGroupModal;