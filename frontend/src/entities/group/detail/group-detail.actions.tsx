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

import React, { useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import { ButtonDropdown, ButtonDropdownProps, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch } from '../../../config/store';
import { useGetCurrentUserQuery } from '../../user/user.reducer';
import { hasPermission } from '../../../shared/util/permission-utils';
import { Permission } from '../../../shared/model/user.model';
import NotificationService from '../../../shared/layout/notification/notification.service';
import Modal, { ModalProps } from '../../../modules/modal';
import { setDeleteModal } from '../../../modules/modal/modal.reducer';
import { BasePathContext } from '../../../shared/layout/base-path-context';
import { useDeleteGroupMutation, useGetAllGroupsQuery } from '../group.reducer';

function GroupDetailActions () {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const nav = (endpoint: string) => navigate(endpoint);
    const {groupName} = useParams();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {GroupActionButton(nav, dispatch, groupName)}
        </SpaceBetween>
    );
}

function GroupActionButton (
    nav: (endpoint: string) => void,
    dispatch: Dispatch,
    groupName: string
) {
    const actionItems: Array<ButtonDropdownProps.ItemOrGroup> = [];
    const { data: currentUser } = useGetCurrentUserQuery();

    const [modalState, setModalState] = React.useState<Partial<ModalProps>>({
        visible: false,
        confirmText: 'Confirm',
        dismissText: 'Cancel',
    });

    if (currentUser && hasPermission(Permission.ADMIN, currentUser.permissions)) {
        actionItems.push(
            ...[
                {text: 'Update', id: 'update_group'},
                {text: 'Delete', id: 'delete_group'},
            ]
        );
    }

    return (
        <> { currentUser && hasPermission(Permission.ADMIN, currentUser.permissions) && (
            <ButtonDropdown
                items={actionItems}
                variant='primary'
                disabled={groupName === undefined}
                onItemClick={(e) =>
                    GroupActionHandler(
                        e,
                        groupName,
                        nav,
                        dispatch,
                        modalState as ModalProps,
                        setModalState
                    )
                }
            >
                <Modal {...(modalState as ModalProps)} />
                Actions
            </ButtonDropdown>
        )}
        </>
    );
}

const GroupActionHandler = (
    e: CustomEvent<ButtonDropdownProps.ItemClickDetails>,
    groupName: string,
    nav: (endpoint: string) => void,
    dispatch: ThunkDispatch<any, any, Action>,
    modalState: ModalProps,
    setModalState: (state: Partial<ModalProps>) => void
) => {
    const notificationService = NotificationService(dispatch);
    const basePath = useContext(BasePathContext);
    const { refetch: refetchAllGroups } = useGetAllGroupsQuery({adminGetAll: basePath.includes('admin')});
    const [ deleteGroup ] = useDeleteGroupMutation();

    switch (e.detail.id) {
        case 'update_group':
            nav(`${basePath}/${groupName}`);
            break;
        case 'delete_group':
            dispatch(
                setDeleteModal({
                    resourceName: 'Group',
                    resourceType: 'group',
                    postConfirm: refetchAllGroups,
                    onConfirm: async () =>  {
                        const result = await deleteGroup(groupName!);

                        setModalState({
                            ...modalState,
                            visible: false,
                        });

                        notificationService.showActionNotification(
                            'delete group',
                            `Group ${groupName} deleted.`,
                            result
                        );

                        if (result.isSuccess) {
                            nav(`${basePath}/groups`);
                        }
                    },
                    description: `This will delete the following group: ${groupName}.`
                })
            );
            break;
    }
};

export default GroupDetailActions;
