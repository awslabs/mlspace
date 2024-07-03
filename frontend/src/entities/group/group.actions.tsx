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
import { Button, ButtonDropdown, Icon, SpaceBetween } from '@cloudscape-design/components';
import { deleteGroup, getAllGroups } from './group.reducer';
import React from 'react';
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import { IGroup } from '../../shared/model/group.model';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { NavigateFunction, useNavigate } from 'react-router-dom';

function GroupActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <Button onClick={() => dispatch(getAllGroups())} ariaLabel={'Refresh groups list'}>
                <Icon name='refresh'/>
            </Button>
            {GroupActionButton(navigate, dispatch, props)}
            <Button
                variant='primary'
                onClick={() => navigate('/admin/groups/create')}
            >
                Create Group
            </Button>
        </SpaceBetween>
    );
}

function GroupActionButton (navigate: NavigateFunction, dispatch: Dispatch, props?: any) {
    const selectedGroup: IGroup = props?.selectedItems[0];
    const items = [];
    if (selectedGroup) {
        items.push({
            text: 'Delete Group',
            id: 'deleteGroup',
        });
        items.push({
            text: 'Edit Group',
            id: 'editGroup',
        });
    }

    return (
        <ButtonDropdown
            items={items}
            variant='primary'
            disabled={!selectedGroup}
            onItemClick={(e) => GroupActionHandler(e, selectedGroup, dispatch, navigate)}
        >
            Actions
        </ButtonDropdown>
    );
}

const GroupActionHandler = async (
    e: any,
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
                    onConfirm: async () => dispatch(deleteGroup(selectedGroup.name)),
                    postConfirm: () => dispatch(getAllGroups()),
                    description: `This will delete the following group: ${selectedGroup.name}.`
                })
            );
            break;
        case 'editGroup':
            navigate(`/admin/groups/edit/${selectedGroup.name}`);
            break;
        default:
            return;
    }
};

export { GroupActions };