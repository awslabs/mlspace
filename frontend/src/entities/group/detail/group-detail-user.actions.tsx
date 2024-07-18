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
import { Button, ButtonDropdown, ButtonDropdownProps, Icon, SpaceBetween } from '@cloudscape-design/components';
import { currentGroupUsers, getGroupUsers, removeGroupUser } from '../group.reducer';
import React, { useEffect, useState } from 'react';
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import { NavigateFunction, useNavigate, useParams } from 'react-router-dom';
import { setDeleteModal } from '../../../modules/modal/modal.reducer';
import { ModalProps } from '../../../modules/modal';
import { IGroupUser } from '../../../shared/model/groupUser.model';
import AddGroupUserModal from './add-group-user-modal';
import { IUser, Permission } from '../../../shared/model/user.model';
import { hasPermission } from '../../../shared/util/permission-utils';
import { useNotificationService } from '../../../shared/util/hooks';
import { getAllUsers, selectCurrentUser } from '../../user/user.reducer';
import { INotificationService } from '../../../shared/layout/notification/notification.service';

function GroupDetailUserActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { groupName } = useParams();
    const allUsers: IUser[] = useAppSelector((state) => state.user.allUsers);
    const groupUsers: IGroupUser[] = useAppSelector(currentGroupUsers);
    const groupUsernames = groupUsers.map((user) => user.user);
    const addableUsers = allUsers.filter((user) => !groupUsernames.includes(user.username!));
    const [addUserModalVisible, setAddUserModalVisible] = useState(false);
    const currentUser = useAppSelector(selectCurrentUser);

    useEffect(() => {
        dispatch(getAllUsers());
    }, [dispatch]);

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <AddGroupUserModal dispatch={dispatch} setVisible={setAddUserModalVisible} visible={addUserModalVisible} addableUsers={addableUsers} groupName={groupName!}/>
            <Button 
                onClick={() => dispatch(getGroupUsers(groupName!))} 
                ariaLabel={'Refresh groups list'}
            >
                <Icon name='refresh'/>
            </Button>
            {GroupDetailUserActionsButton(navigate, dispatch, currentUser, allUsers, setAddUserModalVisible, props)}
        </SpaceBetween>
    );
}

function GroupDetailUserActionsButton (navigate: NavigateFunction, dispatch: Dispatch, currentUser: IUser, allUsers: IUser[], setAddUserModalVisible: (boolean) => void, props?: any) {
    const selectedUser: IGroupUser = props?.selectedItems[0];
    const items: ButtonDropdownProps.Item[] = [];
    const notificationService = useNotificationService(dispatch);
    if (selectedUser) {
        items.push({
            text: 'Remove from Group',
            id: 'removeFromGroup',
        });
    }
    
    const [modalState, setModalState] = React.useState<Partial<ModalProps>>({
        visible: false,
        confirmText: 'Confirm',
        dismissText: 'Cancel',
    });

    return (
        <> { hasPermission(Permission.ADMIN, currentUser.permissions) && (
            <>
                <ButtonDropdown
                    items={items}
                    variant='primary'
                    disabled={!selectedUser}
                    onItemClick={(e) => GroupDetailUserActionHandler(e, dispatch, modalState as ModalProps, setModalState, selectedUser, notificationService)}
                >
                    Actions
                </ButtonDropdown>
                <Button
                    variant='primary'
                    onClick={() => setAddUserModalVisible(true)}
                    disabled={allUsers.length === 0}
                >
                    Add User{allUsers.length > 1 ? 's' : ''}
                </Button>
            </>
        )}
        </>
    );
}

const GroupDetailUserActionHandler = async (
    e: CustomEvent<ButtonDropdownProps.ItemClickDetails>,
    dispatch:  ThunkDispatch<any, any, Action>,
    modalState: ModalProps,
    setModalState: (state: Partial<ModalProps>) => void,
    selectedUser: IGroupUser,
    notificationService: INotificationService
) => {
    switch (e.detail.id) {
        case 'removeFromGroup':
            dispatch(
                setDeleteModal({
                    resourceName: 'Group User',
                    resourceType: 'groupUser',
                    postConfirm: () => dispatch(getGroupUsers(selectedUser.group)),
                    onConfirm: async () => {
                        dispatch(removeGroupUser(selectedUser)).then((result) => {
                            setModalState({
                                ...modalState,
                                visible: false,
                            });
                            notificationService.showActionNotification(
                                'remove group user',
                                `User ${selectedUser.user} removed from ${selectedUser.group}.`,
                                result
                            );
                        });
                    },
                    description: `This will remove user: ${selectedUser.user} from the following group: ${selectedUser.group}.`
                })
            );
            break;
        default:
            return;
    }
};

export { GroupDetailUserActions };