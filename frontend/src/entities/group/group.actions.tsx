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
import { useAppDispatch } from '../../config/store';
import { Button, ButtonDropdown, ButtonDropdownProps, Icon, SpaceBetween } from '@cloudscape-design/components';
import React, { useContext } from 'react';
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import { IGroup } from '../../shared/model/group.model';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import { useGetCurrentUserQuery } from '../user/user.reducer';
import { IUser, Permission } from '../../shared/model/user.model';
import { hasPermission } from '../../shared/util/permission-utils';
import BasePathContext from '../../shared/layout/base-path-context';
import { useGetAllGroupsQuery } from './group.reducer';

function GroupActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { data: currentUser } = useGetCurrentUserQuery();
    const basePath = useContext(BasePathContext);
    const { refetch: refetchAllGroups, isFetching: isFetchingAllGroups } = useGetAllGroupsQuery({adminGetAll: basePath.includes('admin')});

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <Button onClick={refetchAllGroups} ariaLabel={'Refresh groups list'} disabled={isFetchingAllGroups}>
                <Icon name='refresh'/>
            </Button>
            {GroupActionButton(navigate, dispatch, currentUser, props)}
        </SpaceBetween>
    );
}

function GroupActionButton (navigate: NavigateFunction, dispatch: Dispatch, currentUser: IUser, props?: any) {
    const selectedGroup: IGroup = props?.selectedItems[0];
    const items: ButtonDropdownProps.Item[] = [];
    if (selectedGroup) {
        items.push({
            text: 'Delete Group',
            id: 'deleteGroup',
        });
        items.push({
            text: 'Update Group',
            id: 'updateGroup',
        });
    }

    return (
        <> { hasPermission(Permission.ADMIN, currentUser.permissions) && (
            <>
                <ButtonDropdown
                    items={items}
                    variant='primary'
                    disabled={!selectedGroup}
                    onItemClick={(e) => GroupActionHandler(e, selectedGroup, dispatch, navigate)}
                >
                    Actions
                </ButtonDropdown>
                <Button
                    variant='primary'
                    onClick={() => navigate('/admin/groups/create')}
                >
                    Create Group
                </Button>
            </>
        )}
        </>
    );
}

const GroupActionHandler = async (
    e: CustomEvent<ButtonDropdownProps.ItemClickDetails>,
    selectedGroup: IGroup,
    dispatch: ThunkDispatch<any, any, Action>,
    navigate: NavigateFunction
) => {
    switch (e.detail.id) {
        case 'deleteGroup':
            dispatch(
                setDeleteModal({
                    resourceName: 'Group',
                    resourceType: 'group',
                    onConfirm: async () => deleteGroup(selectedGroup.name),
                    description: `This will delete the following group: ${selectedGroup.name}.`
                })
            );
            break;
        case 'updateGroup':
            navigate(`/admin/groups/edit/${selectedGroup.name}`);
            break;
        default:
            return;
    }
};

export { GroupActions };