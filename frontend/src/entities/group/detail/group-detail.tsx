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

import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { currentGroupDatasets, selectCurrentGroupProjects, currentGroupUsers, getGroup, getGroupDatasets, getGroupProjects, getGroupUsers, selectLoadingGroupProjects } from '../group.reducer';
import { Header, SpaceBetween, Tabs } from '@cloudscape-design/components';
import DetailsContainer from '../../../modules/details-container';
import { IGroup } from '../../../shared/model/group.model';
import ContentLayout from '../../../shared/layout/content-layout';
import GroupDetailActions from './group-detail.actions';
import Table from '../../../modules/table';
import { groupUserColumns, visibleGroupUserColumns } from '../../user/user.columns';
import { IGroupUser } from '../../../shared/model/groupUser.model';
import { GroupDetailUserActions } from './group-detail-user.actions';
import { DocTitle, scrollToPageHeader } from '../../../shared/doc';
import { selectCurrentUser } from '../../user/user.reducer';
import { hasPermission } from '../../../shared/util/permission-utils';
import { Permission } from '../../../shared/model/user.model';
import { IDataset } from '../../../shared/model';
import { createDefaultColumnsWithUrlOverride, visibleColumns } from '../../dataset/dataset.columns';
import { GroupDetailDatasetActions } from './group-detail-dataset.actions';
import { isFulfilled } from '@reduxjs/toolkit';
import GroupDetailProjectActions from './group-detail-project.actions';
import { projectGroupColumns } from '../group.columns';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { getBase } from '../../../shared/util/breadcrumb-utils';

export function GroupDetail () {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const {groupName} = useParams();
    const [group, setGroup] = useState<IGroup>();
    const groupUsers: IGroupUser[] = useAppSelector(currentGroupUsers);
    const groupDatasets: IDataset[] = useAppSelector(currentGroupDatasets);
    const groupProjects = useAppSelector(selectCurrentGroupProjects);
    const loadingGroupProjects = useAppSelector(selectLoadingGroupProjects);
    const loadingGroupData = useAppSelector((state) => state.group.loading);
    const loadingDatasetData = useAppSelector((state) => state.group.datasetsLoading);
    const currentUser = useAppSelector(selectCurrentUser);
    const [initialLoaded, setInitialLoaded] = useState(false);
    DocTitle(`Group Details: ${groupName}`);
    const baseUrl = window.location.href.includes('#/admin') ? '#/admin/groups' : '#/personal/group';

    const groupDetails = new Map<string, ReactNode>();
    groupDetails.set('Name', group?.name);
    groupDetails.set('Description', group?.description);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(undefined),
                { text: 'Groups', href: baseUrl },
                { text: groupName, href: `${baseUrl}/${groupName}` },
            ])
        );

        scrollToPageHeader('h1', `${groupName}`);
    }, [dispatch, groupName, baseUrl]);

    useEffect(() => {
        if (initialLoaded === false && groupName) {
            dispatch(getGroup(groupName)).then((response) => {
                if (isFulfilled(response)) {
                    setGroup(response.payload.data.group);
                    dispatch(getGroupUsers(groupName));
                    dispatch(getGroupDatasets(groupName));
                    dispatch(getGroupProjects(groupName));
                    setInitialLoaded(true);
                } else {
                    navigate('/404');
                }
            });
        }
    }, [groupName, initialLoaded, dispatch, navigate]);

    const {pathname} = useLocation();
    let pathPrefix = 'personal/dataset';
    if (pathname.match(/^\/admin/)) {
        pathPrefix = 'admin/datasets';
    }

    return (
        <ContentLayout header={<Header variant='h1'>{groupName}</Header>}>
            <SpaceBetween direction='vertical' size='xxl'>
                <DetailsContainer
                    columns={1}
                    header='Group details'
                    actions={GroupDetailActions()}
                    info={groupDetails}
                    loading={!initialLoaded}
                />

                <Tabs variant='container' tabs={[{
                    id: 'members',
                    label: 'Members',
                    content: (
                        <Table
                            tableName='User'
                            tableType={hasPermission(Permission.ADMIN, currentUser.permissions) ? 'single' : undefined}
                            actions={GroupDetailUserActions}
                            itemNameProperty='user'
                            trackBy='user'
                            allItems={groupUsers}
                            columnDefinitions={groupUserColumns}
                            visibleColumns={visibleGroupUserColumns}
                            loadingItems={loadingGroupData || !initialLoaded}
                            loadingText='Loading Group users'
                            variant='borderless'
                        />
                    )
                }, {
                    id: 'datasets',
                    label: 'Datasets',
                    content: (
                        <Table
                            tableName='Dataset'
                            actions={GroupDetailDatasetActions}
                            itemNameProperty='name'
                            trackBy='location'
                            allItems={groupDatasets || []}
                            columnDefinitions={useMemo(() => createDefaultColumnsWithUrlOverride(pathPrefix), [pathPrefix])}
                            visibleColumns={visibleColumns}
                            loadingItems={loadingDatasetData || !initialLoaded}
                            loadingText='Loading Group datasets'
                            variant='borderless'
                        />
                    )
                }, {
                    id: 'projects',
                    label: 'Projects',
                    content: (
                        <Table
                            tableName='Project'
                            actions={GroupDetailProjectActions}
                            itemNameProperty='project'
                            trackBy='project'
                            allItems={groupProjects}
                            columnDefinitions={projectGroupColumns}
                            visibleColumns={projectGroupColumns.map((item) => item.id).filter((item): item is string => Boolean(item))}
                            loadingItems={loadingGroupProjects || !initialLoaded}
                            loadingText='Loading Group projects'
                            variant='borderless'
                        />
                    )
                }]} />

            </SpaceBetween>
        </ContentLayout>
    );
}

export default GroupDetail;