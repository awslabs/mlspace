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
import { Button, Icon, SpaceBetween } from '@cloudscape-design/components';
import { getUserGroups } from '../user.reducer';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IGroupUser } from '../../../shared/model/groupUser.model';
import { TableActionProps } from '../../../modules/table/table.types';
import { isSuccessfulResponse } from '../../../shared/reducers/reducer.utils';
import { setDeleteModal } from '../../../modules/modal/modal.reducer';
import { getAllGroups, removeGroupUser, selectAllGroups } from '../../group/group.reducer';
import AddGroupUserModal from './add-group-user-modal';
import { IGroup } from '../../../shared/model/group.model';
import { useNotificationService } from '../../../shared/util/hooks';

function UserDetailGroupActions (props?: TableActionProps<IGroupUser>) {
    const dispatch = useAppDispatch();
    const {username} = useParams();
    const [addUserModalVisible, setAddUserModalVisible] = useState(false);
    const notificationService = useNotificationService(dispatch);

    const allGroups: IGroup[] = useAppSelector(selectAllGroups);
    const groupNames = props?.allItems.map((group) => group.group) || [];
    const addableGroups = allGroups.filter((group) => !groupNames.includes(group.name!));


    useEffect(() => {
        dispatch(getAllGroups());
    }, [dispatch]);

    const refreshHandler = () => {
        if (username !== undefined) {
            dispatch(getUserGroups(username)).then((response) => {
                if (isSuccessfulResponse(response)) {
                    props?.setItemsOverride?.(response.payload.data);
                }
            });
        }
    };

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <AddGroupUserModal dispatch={dispatch} setVisible={setAddUserModalVisible} visible={addUserModalVisible} addableGroups={addableGroups} username={username!} refresh={refreshHandler} />
            <Button onClick={refreshHandler} ariaLabel={'Refresh groups list'}>
                <Icon name='refresh'/>
            </Button>
            <Button
                disabled={(props?.selectedItems?.length || 0) < 1}
                onClick={() => dispatch(
                    setDeleteModal({
                        resourceName: 'Group User',
                        resourceType: 'groupUser',
                        description: `This will remove user: ${username} from the group: ${props?.selectedItems?.[0].group}.`,
                        onConfirm: async () => {
                            const groupUser = props?.selectedItems?.[0];
                            if (groupUser) {
                                dispatch(removeGroupUser(groupUser)).then((response) => {
                                    if (isSuccessfulResponse(response)) {
                                        notificationService.showActionNotification(
                                            'remove group user',
                                            `User ${username} removed from ${props?.selectedItems?.[0].group}.`,
                                            response
                                        );
    
                                    }
                                }).finally(() => {
                                    dispatch(refreshHandler);
                                });
                            }
                        }
                    })
                )}
                variant='normal'
            >
                Remove Group
            </Button>
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