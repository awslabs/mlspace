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
import { groupColumns } from '../../group/group.columns';
import React, { useState } from 'react';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { IGroup } from '../../../shared/model/group.model';
import { addUsersToGroup } from '../../group/user/group-user-functions';

export type AddGroupUserModalProps = {
    dispatch:  ThunkDispatch<any, any, Action>,
    visible: boolean;
    setVisible: (boolean) => void;
    addableGroups: IGroup[];
    username: string,
    refresh?: () => void
};

export function AddGroupUserModal (props: AddGroupUserModalProps) {
    const [selectedGroups, setSelectedGroups] = useState<IGroup[]>([]);

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
                            disabled={selectedGroups.length === 0}
                            onClick={() => {
                                Promise.allSettled(
                                    selectedGroups.map((group) => addUsersToGroup(props.dispatch, group.name, [{username: props.username, email: '', displayName: '', suspended: false}]))
                                ).finally(() => {
                                    setSelectedGroups([]);
                                    props.setVisible(false);
                                    props?.refresh?.();
                                });
                            }}>
                            Add groups
                        </Button>
                    </SpaceBetween>
                </Box>
            }
        >
            <SpaceBetween direction='vertical' size='s'>
                <Table
                    tableName='Group'
                    header={<></>}
                    tableType='multi'
                    selectItemsCallback={(e) => {
                        setSelectedGroups(e);
                    }}
                    trackBy='name'
                    allItems={props.addableGroups}
                    columnDefinitions={groupColumns}
                    variant='embedded'
                />
            </SpaceBetween>
        </Modal>
    );
}

export default AddGroupUserModal;