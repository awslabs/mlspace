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
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { useAddGroupUsersMutation } from '../group.reducer';

export type AddGroupUserModalProps = {
    dispatch:  ThunkDispatch<any, any, Action>,
    visible: boolean;
    setVisible: (boolean) => void;
    addableUsers: IUser[];
    groupName: string;
};

export function AddGroupUserModal (props: AddGroupUserModalProps) {
    const [addGroupUsers, result] = useAddGroupUsersMutation();
    const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);

    return (
        <Modal
            visible={props.visible}
            onDismiss={() => props.setVisible(false)}
            header={<Header>Add user to Group</Header>}
            footer={
                <Box float='right'>
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button onClick={() => props.setVisible(false)}>Cancel</Button>
                        <Button
                            loading={result.isLoading}
                            variant='primary'
                            disabled={selectedUsers.length === 0}
                            onClick={ async () => {
                                await addGroupUsers({
                                    groupName: props.groupName,
                                    usernames: selectedUsers.map((user) => user.username)
                                }).finally(() => {
                                    setSelectedUsers([]);
                                    props.setVisible(false);
                                });
                            }}>
                            Add user{selectedUsers.length > 1 ? 's' : ''}
                        </Button>
                    </SpaceBetween>
                </Box>
            }
        >
            <SpaceBetween direction='vertical' size='s'>
                <Table
                    tableName='User'
                    header={<></>}
                    tableType='multi'
                    selectItemsCallback={(e) => {
                        setSelectedUsers(e || []);
                    }}
                    trackBy='username'
                    allItems={props.addableUsers}
                    columnDefinitions={userColumns}
                    visibleColumns={addUserVisibleColumns}
                    variant='embedded'
                    keepSelection={props.visible}
                />
            </SpaceBetween>
        </Modal>
    );
}

export default AddGroupUserModal;