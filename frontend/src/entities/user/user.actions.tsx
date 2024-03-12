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

import React from 'react';
import { Button, ButtonDropdown, Icon, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch } from '../../config/store';
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import { getAllUsers, updateUser } from './user.reducer';
import { IUser, Permission } from '../../shared/model/user.model';
import { togglePermission } from '../../shared/util/permission-utils';
import { setUpdateModal } from '../../modules/modal/modal.reducer';

function UserActions (props?: any) {
    const dispatch = useAppDispatch();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <Button onClick={() => dispatch(getAllUsers())} ariaLabel={'Refresh users list'}>
                <Icon name='refresh' />
            </Button>
            {UserActionButton(dispatch, props)}
        </SpaceBetween>
    );
}

function UserActionButton (dispatch: Dispatch, props?: any) {
    const selectedUser: IUser = props?.selectedItems[0];
    const items = [];
    if (selectedUser) {
        items.push({
            text: `${selectedUser.suspended ? 'Reinstate ' : 'Suspend '} User`,
            id: 'toggleStatus',
        });
        items.push({
            text: `${
                selectedUser.permissions?.includes(Permission.ADMIN) ? 'Revoke ' : 'Grant'
            } Admin Permission`,
            id: 'toggleAdmin',
        });
    }

    return (
        <ButtonDropdown
            items={items}
            variant='primary'
            disabled={!selectedUser}
            onItemClick={(e) => UserActionHandler(e, selectedUser, dispatch)}
        >
            Actions
        </ButtonDropdown>
    );
}

const UserActionHandler = async (
    e: any,
    selectedUser: IUser,
    dispatch: ThunkDispatch<any, any, Action>
) => {
    // Clone current user (switch this to lodash once it's pulled in)
    const updatedUser = JSON.parse(JSON.stringify(selectedUser));
    switch (e.detail.id) {
        case 'toggleStatus':
            updatedUser.suspended = !selectedUser.suspended;
            dispatch(
                setUpdateModal({
                    selectedUser: selectedUser,
                    onConfirm: async () => dispatch(updateUser(updatedUser)),
                    postConfirm: () => dispatch(getAllUsers()),
                    description: `This will ${updatedUser.suspended ? 'disable' : 'reinstate'} ${
                        selectedUser.username
                    }.`,
                })
            );
            break;
        case 'toggleAdmin':
            togglePermission(Permission.ADMIN, updatedUser.permissions!);
            dispatch(
                setUpdateModal({
                    selectedUser: selectedUser,
                    onConfirm: async () => dispatch(updateUser(updatedUser)),
                    postConfirm: () => dispatch(getAllUsers()),
                    description: `This will ${
                        updatedUser.permissions!.includes(Permission.ADMIN) ? 'grant' : 'revoke'
                    } ${selectedUser.username} admin permissions.`,
                })
            );
            break;
        default:
            return;
    }
};

export { UserActions };
