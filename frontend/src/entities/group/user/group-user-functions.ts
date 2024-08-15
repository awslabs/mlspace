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
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { AddGroupUserRequest, addGroupUsers, getGroupMembershipHistory, getGroupUsers } from '../group.reducer';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { IUser } from '../../../shared/model/user.model';

export async function addUsersToGroup (
    dispatch: ThunkDispatch<any, any, Action>,
    groupName: string,
    users: IUser[]
) {
    const notificationService = NotificationService(dispatch);
    const request: AddGroupUserRequest = {
        groupName: groupName,
        usernames: users.map((user) => user.username)
    };
    await dispatch(addGroupUsers(request)).then((result) => {
        notificationService.showActionNotification(
            'add group users',
            `Users added to group: ${groupName}.`,
            result
        );
    }).catch((e) => {
        notificationService.showActionNotification(
            'remove group user',
            `Unable to add users to group: ${groupName} with error ${e}.`,
            'error'
        );
    }).finally(() => {
        dispatch(getGroupUsers(groupName));
        dispatch(getGroupMembershipHistory(groupName));
    });
}