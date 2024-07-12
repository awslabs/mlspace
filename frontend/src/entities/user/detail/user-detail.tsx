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

import React, { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header, SpaceBetween, Tabs } from '@cloudscape-design/components';
import DetailsContainer from '../../../modules/details-container';
import ContentLayout from '../../../shared/layout/content-layout';
import { DocTitle } from '../../../shared/doc';
import { IUser } from '../../../shared/model/user.model';
import { getUser, getUserGroups, getUserProjects } from '../user.reducer';
import { useAppDispatch } from '../../../config/store';
import { formatDisplayBoolean, formatDisplayText, formatDisplayTimestamp } from '../../../shared/util/form-utils';
import Table from '../../../modules/table';
import { IGroupUser } from '../../../shared/model/groupUser.model';
import { IProjectUser } from '../../../shared/model/projectUser.model';
import { UserDetailGroupActions } from './user-detail-group.actions';
import { UserDetailProjectActions } from './user-detail-project.actions';
import { isFulfilled } from '@reduxjs/toolkit';

export function UserDetail () {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const {username} = useParams();
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [user, setUser] = useState<IUser>();
    const [groups, setGroups] = useState<IGroupUser[]>([]);
    const [projects, setProjects] = useState<IProjectUser[]>([]);
    DocTitle(`Group Details: ${username}`);

    const userDetails = new Map<string, ReactNode>();
    userDetails.set('Name', formatDisplayText(user?.username));
    userDetails.set('DisplayName', formatDisplayText(user?.displayName));
    userDetails.set('Email', formatDisplayText(user?.email));
    userDetails.set('Suspended', formatDisplayBoolean(user?.suspended));
    userDetails.set('Last Login', formatDisplayTimestamp(user?.lastLogin));

    useEffect(() => {
        if (username && !initialLoaded) {
            setInitialLoaded(true);
            
            dispatch(getUser(username)).then((response) => {
                if (isFulfilled(response)) {
                    setUser(response.payload.data);
                } else {
                    navigate('/404');
                }
            });

            dispatch(getUserGroups(username)).then((response) => {
                if (isFulfilled(response)) {
                    setGroups(response.payload.data);
                    setLoadingGroups(false);
                }
            });

            dispatch(getUserProjects(username)).then((response) => {
                if (isFulfilled(response)) {
                    setProjects(response.payload.data);
                    setLoadingProjects(false);
                }
            });
        }
    }, [dispatch, username, navigate, initialLoaded]);

    return (
        <ContentLayout header={<Header variant='h1'>{username}</Header>}>
            <SpaceBetween direction='vertical' size='xxl'>
                <DetailsContainer
                    columns={2}
                    header='User details'
                    info={userDetails}
                    loading={!initialLoaded}
                />

                <Tabs variant='container' tabs={[{
                    id: 'projects',
                    label: 'Project Membership',
                    content: (
                        <Table
                            tableName='Project'
                            tableType='single'
                            actions={UserDetailProjectActions}
                            itemNameProperty='project'
                            trackBy='project'
                            allItems={projects}
                            columnDefinitions={[{
                                id: 'name',
                                header: 'Name',
                                cell: (item) => {
                                    return item.project;
                                },
                            }]}
                            setItemsOverride={setProjects}
                            loadingItems={loadingProjects || !initialLoaded}
                            loadingText='Loading Projects'
                            variant='borderless'
                        />
                    )
                }, {
                    id: 'groups',
                    label: 'Group Membership',
                    content: (
                        <Table
                            tableName='Group'
                            tableType='single'
                            actions={UserDetailGroupActions}
                            itemNameProperty='group'
                            trackBy='group'
                            allItems={groups}
                            columnDefinitions={[{
                                id: 'name',
                                header: 'Name',
                                cell: (item) => {
                                    return item.group;
                                },
                            }]}
                            setItemsOverride={setGroups}
                            loadingItems={loadingGroups && !initialLoaded}
                            loadingText='Loading Groups'
                            variant='borderless'
                        />
                    )
                }]} />
            </SpaceBetween>
        </ContentLayout>
    );
}

export default UserDetail;