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
import { Header as CloudscapeHeader, ButtonDropdown } from '@cloudscape-design/components';
import { persistor, useAppDispatch, useAppSelector } from '../../../config/store';
import { useAuth } from 'react-oidc-context';
import Condition from '../../../modules/condition';
import { Timezone } from '../../model/user.model';
import { selectCurrentUser, updateUser } from '../../../entities/user/user.reducer';
import { Mode, applyMode } from '@cloudscape-design/global-styles';
import { useNotificationService } from '../../util/hooks';

export default function Header () {
    const auth = useAuth();
    const currentUser = useAppSelector(selectCurrentUser);

    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);

    return (
        <CloudscapeHeader
            variant='h1'
            actions={
                <Condition condition={auth.isAuthenticated}>
                    <ButtonDropdown
                        data-cy='user-actions'
                        items={[
                            {
                                text: 'Timezone Preference',
                                id: 'timezonePreference',
                                items: [
                                    { text: 'Local', id: Timezone.LOCAL },
                                    { text: 'UTC', id: Timezone.UTC },
                                ],
                            },
                            {
                                text: 'Display Mode Preference',
                                id: 'preference',
                                items: [
                                    { text: 'Light', id: Mode.Light },
                                    { text: 'Dark', id: Mode.Dark },
                                ],
                            },
                            { text: 'Logout', id: 'logout' },
                        ]}
                        variant='primary'
                        onItemClick={(e) => {
                            if (e.detail.id === 'logout') {
                                persistor.purge().then(() => {
                                    persistor.flush().then(() => {
                                        persistor.pause();
                                        auth.signoutRedirect();
                                    });
                                });
                            } else if (
                                [Timezone.UTC.toString(), Timezone.LOCAL.toString()].includes(
                                    e.detail.id
                                )
                            ) {
                                dispatch(updateUser({
                                    ...currentUser,
                                    preferences: {
                                        ...currentUser.preferences,
                                        timezone: e.detail.id as Timezone,
                                    },
                                })).unwrap()
                                    .then((request) => {
                                        if (request.status === 200) {
                                            notificationService.generateNotification(
                                                `Successfully updated timezone preference to "${e.detail.id}".`,
                                                'success'
                                            );
                                        } else {
                                            notificationService.generateNotification(
                                                'Failed to update timezone preference.',
                                                'error'
                                            );
                                        }
                                    });
                            } else if (
                                [Mode.Dark.toString(), Mode.Light.toString()].includes(e.detail.id)
                            ) {
                                dispatch(updateUser({
                                    ...currentUser,
                                    preferences: {
                                        ...currentUser.preferences,
                                        displayMode: e.detail.id as Mode,
                                    },
                                })).unwrap()
                                    .then((result) => {
                                        applyMode(e.detail.id as Mode);
                                        if (result.status === 200) {
                                            notificationService.generateNotification(
                                                `Successfully updated display mode preference to "${e.detail.id}".`,
                                                'success'
                                            );
                                        } else {
                                            notificationService.generateNotification(
                                                'Failed to update display mode preference.',
                                                'error'
                                            );
                                        }
                                    });
                            }
                        }}
                    >
                        Greetings, {auth.user?.profile.name}!
                    </ButtonDropdown>
                </Condition>
            }
        ></CloudscapeHeader>
    );
}
