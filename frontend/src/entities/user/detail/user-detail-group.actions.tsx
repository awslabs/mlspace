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
import { useAppDispatch } from '../../../config/store';
import { Button, ButtonDropdown, ButtonDropdownProps, Icon, SpaceBetween } from '@cloudscape-design/components';
import { getUserGroups } from '../user.reducer';
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IGroupUser } from '../../../shared/model/groupUser.model';
import { TableActionProps } from '../../../modules/table/table.types';
import { setDeleteModal } from '../../../modules/modal/modal.reducer';
import AddGroupUserModal from './add-group-user-modal';
import { useNotificationService } from '../../../shared/util/hooks';
import { isFulfilled } from '@reduxjs/toolkit';
import { useGetAllGroupsQuery, useRemoveGroupUserMutation } from '../../group/group.reducer';

function UserDetailGroupActions (props?: TableActionProps<IGroupUser>) {
    const dispatch = useAppDispatch();
    const {username} = useParams();
    const [addUserModalVisible, setAddUserModalVisible] = useState(false);
    const notificationService = useNotificationService(dispatch);
    const { data: allGroups } = useGetAllGroupsQuery({adminGetAll: true});
    const groupNames = useMemo(() => props?.allItems.map((group) => group.group) || [], [props?.allItems]);
    const addableGroups = useMemo(() => allGroups?.filter((group) => !groupNames.includes(group.name!)), [groupNames, allGroups]) || [];
    const [ removeGroupUser, result ] = useRemoveGroupUserMutation();

    const refreshHandler = () => {
        if (username !== undefined) {
            dispatch(getUserGroups(username)).then((response) => {
                if (isFulfilled(response)) {
                    props?.setItemsOverride?.(response.payload.data);
                }
            });
        }
    };

    const buttonItems: ButtonDropdownProps.Item[] = [{
        id: 'removeGroup',
        text: 'Remove Group',
        disabled: (props?.selectedItems?.length || 0) === 0,
        disabledReason: 'No Group selected.'
    }];

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <AddGroupUserModal dispatch={dispatch} setVisible={setAddUserModalVisible} visible={addUserModalVisible} addableGroups={addableGroups} username={username!} refresh={refreshHandler} />
            <Button onClick={refreshHandler} ariaLabel={'Refresh groups list'}>
                <Icon name='refresh'/>
            </Button>

            <ButtonDropdown
                items={buttonItems}
                onItemClick={({detail}) => {
                    switch (detail.id) {
                        case 'removeGroup':
                            props?.selectedItems?.forEach((groupUser) => dispatch(setDeleteModal({
                                resourceName: 'Group User',
                                resourceType: 'groupUser',
                                description: `This will remove user: ${groupUser.user} from the group: ${groupUser.group}.`,
                                disabled: result.isLoading,
                                onConfirm: async () => {                                   
                                    removeGroupUser(groupUser).then((response) => {
                                        notificationService.showAxiosActionNotification(
                                            'remove user from group',
                                            `User ${groupUser.user} removed from ${groupUser.group}.`,
                                            response
                                        );
                                    });
                                }
                            })));
                            break;
                    }
                }}
            >Actions</ButtonDropdown>

            <Button
                disabled={addableGroups.length < 1}
                variant='primary'
                onClick={() => setAddUserModalVisible(true)}
            >
                Add Group
            </Button>
        </SpaceBetween>
    );
}

export { UserDetailGroupActions };