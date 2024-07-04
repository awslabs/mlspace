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
import { IUser } from '../../../shared/model/user.model';
import Table from '../../../modules/table';
import { addUserVisibleColumns, userColumns } from '../../user/user.columns';
import React, { useState } from 'react';
import { AddGroupUserRequest, addGroupUsers, getGroupUsers } from '../group.reducer';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import NotificationService from '../../../shared/layout/notification/notification.service';

export type AddGroupUserModalProps = {
    dispatch:  ThunkDispatch<any, any, Action>,
    visible: boolean;
    setVisible: (boolean) => void;
    addableUsers: IUser[];
    groupName: string;
};

export function AddGroupUserModal (props: AddGroupUserModalProps) {
    const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
    const notificationService = NotificationService(props.dispatch);
    return (
        <Modal
            visible={props.visible}
            onDismiss={() => props.setVisible(false)}
            header={<Header>Add member to Group</Header>}
            footer={
                <Box float='right'>
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button onClick={() => props.setVisible(false)}>Cancel</Button>
                        <Button
                            variant='primary'
                            disabled={selectedUsers.length === 0}
                            onClick={async () => {
                                const request: AddGroupUserRequest = {
                                    groupName: props.groupName,
                                    usernames: selectedUsers.map((user) => user.username)
                                };
                                props.dispatch(addGroupUsers(request)).then((result) => {
                                    notificationService.showActionNotification(
                                        'add group users',
                                        `Users added to group: ${props.groupName}.`,
                                        result
                                    );
                                }).catch((e) => {
                                    notificationService.showActionNotification(
                                        'remove group user',
                                        `Unable to add users to group: ${props.groupName} with error ${e}.`,
                                        'error'
                                    );
                                }).finally(() => {
                                    props.dispatch(getGroupUsers(props.groupName));
                                    setSelectedUsers([]);
                                    props.setVisible(false);
                                });

                            }}>
                            Add members
                        </Button>
                    </SpaceBetween>
                </Box>
            }
        >
            <SpaceBetween direction='vertical' size='s'>
                <Table
                    tableName='Users'
                    header={<></>}
                    tableType='multi'
                    selectItemsCallback={(e) => {
                        setSelectedUsers(e);
                    }}
                    trackBy='username'
                    allItems={props.addableUsers}
                    columnDefinitions={userColumns}
                    visibleColumns={addUserVisibleColumns}
                    variant='embedded'
                />
            </SpaceBetween>
        </Modal>
    );
}

export default AddGroupUserModal;