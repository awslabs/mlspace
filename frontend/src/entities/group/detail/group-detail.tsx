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

import React, { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useGetGroupDatasetsQuery, useGetGroupProjectsQuery, useGetGroupQuery, useGetGroupUsersQuery } from '../group.reducer';
import { Header, SpaceBetween, Tabs } from '@cloudscape-design/components';
import DetailsContainer from '../../../modules/details-container';
import ContentLayout from '../../../shared/layout/content-layout';
import GroupDetailActions from './group-detail.actions';
import Table from '../../../modules/table';
import { groupUserColumns, visibleGroupUserColumns } from '../../user/user.columns';
import { GroupDetailUserActions } from './group-detail-user.actions';
import { DocTitle } from '../../../shared/doc';
import { useGetCurrentUserQuery } from '../../user/user.reducer';
import { hasPermission } from '../../../shared/util/permission-utils';
import { Permission } from '../../../shared/model/user.model';
import { defaultColumnsWithUrlOverride, visibleColumns } from '../../dataset/dataset.columns';
import { GroupDetailDatasetActions } from './group-detail-dataset.actions';
import GroupDetailProjectActions from './group-detail-project.actions';
import { projectGroupColumns } from '../group.columns';

export function GroupDetail () {
    const {groupName} = useParams();
    const { data: group, isFetching: isFetchingGroup } = useGetGroupQuery(groupName!);
    const { data: groupUsers, isFetching: isFetchingGroupUsers } = useGetGroupUsersQuery(groupName!);
    const { data: groupDatasets, isFetching: isFetchingGroupDatasets } = useGetGroupDatasetsQuery(groupName!);
    const { data: groupProjects, isFetching: isFetchingGroupProjects } = useGetGroupProjectsQuery(groupName!);
    const { data: currentUser } = useGetCurrentUserQuery();

    DocTitle(`Group Details: ${groupName}`);

    const groupDetails = new Map<string, ReactNode>();
    groupDetails.set('Name', group?.group.name);
    groupDetails.set('Description', group?.group.description);

    return (
        <ContentLayout header={<Header variant='h1'>{groupName}</Header>}>
            <SpaceBetween direction='vertical' size='xxl'>
                <DetailsContainer
                    columns={1}
                    header='Group details'
                    actions={GroupDetailActions()}
                    info={groupDetails}
                    loading={isFetchingGroup}
                />

                <Tabs variant='container' tabs={[{
                    id: 'members',
                    label: 'Group members',
                    content: (
                        <Table
                            tableName='User'
                            tableType={currentUser && hasPermission(Permission.ADMIN, currentUser.permissions) ? 'single' : undefined}
                            actions={GroupDetailUserActions}
                            itemNameProperty='user'
                            trackBy='user'
                            allItems={groupUsers || []}
                            columnDefinitions={groupUserColumns}
                            visibleColumns={visibleGroupUserColumns}
                            loadingItems={isFetchingGroupUsers}
                            loadingText='Loading Group users'
                            variant='borderless'
                        />
                    )
                }, {
                    id: 'datasets',
                    label: 'Group datasets',
                    content: (
                        <Table
                            tableName='Dataset'
                            actions={GroupDetailDatasetActions}
                            itemNameProperty='name'
                            trackBy='location'
                            allItems={groupDatasets || []}
                            columnDefinitions={defaultColumnsWithUrlOverride}
                            visibleColumns={visibleColumns}
                            loadingItems={isFetchingGroupDatasets}
                            loadingText='Loading Group datasets'
                            variant='borderless'
                        />
                    )
                }, {
                    id: 'projects',
                    label: 'Group projects',
                    content: (
                        <Table
                            tableName='Project'
                            actions={GroupDetailProjectActions}
                            itemNameProperty='project'
                            trackBy='project'
                            allItems={groupProjects || []}
                            columnDefinitions={projectGroupColumns}
                            visibleColumns={projectGroupColumns.map((item) => item.id).filter((item): item is string => Boolean(item))}
                            loadingItems={isFetchingGroupProjects}
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