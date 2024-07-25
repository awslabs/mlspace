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
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { currentGroupDatasets, currentGroupUsers, getGroup, getGroupDatasets, getGroupUsers } from '../group.reducer';
import { Header, SpaceBetween, Tabs } from '@cloudscape-design/components';
import DetailsContainer from '../../../modules/details-container';
import { IGroup } from '../../../shared/model/group.model';
import ContentLayout from '../../../shared/layout/content-layout';
import GroupDetailActions from './group-detail.actions';
import Table from '../../../modules/table';
import { groupUserColumns, visibleGroupUserColumns } from '../../user/user.columns';
import { IGroupUser } from '../../../shared/model/groupUser.model';
import { GroupDetailUserActions } from './group-detail-user.actions';
import { DocTitle } from '../../../shared/doc';
import { selectCurrentUser } from '../../user/user.reducer';
import { hasPermission } from '../../../shared/util/permission-utils';
import { Permission } from '../../../shared/model/user.model';
import { IDataset } from '../../../shared/model';
import { defaultColumnsWithUrlOverride, visibleColumns } from '../../dataset/dataset.columns';
import { GroupDetailDatasetActions } from './group-detail-dataset.actions';

export function GroupDetail () {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const {groupName} = useParams();
    const [group, setGroup] = useState<IGroup>();
    const groupUsers: IGroupUser[] = useAppSelector(currentGroupUsers);
    const groupDatasets: IDataset[] = useAppSelector(currentGroupDatasets);
    const loadingGroupData = useAppSelector((state) => state.group.loading);
    const loadingDatasetData = useAppSelector((state) => state.group.datasetsLoading);
    const currentUser = useAppSelector(selectCurrentUser);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const groupUserActions = (e: any) => GroupDetailUserActions({...e});
    const groupDatasetUserActions = () => GroupDetailDatasetActions();
    DocTitle(`Group Details: ${groupName}`);

    const groupDetails = new Map<string, ReactNode>();
    groupDetails.set('Name', group?.name);
    groupDetails.set('Description', group?.description);

    useEffect(() => {
        if (initialLoaded === false) {
            dispatch(getGroup(groupName!)).then((response) => {
                if (response.payload) {
                    setGroup(response.payload.data.group);
                    dispatch(getGroupUsers(groupName!));
                    dispatch(getGroupDatasets(groupName!));
                    setInitialLoaded(true);
                } else {
                    navigate('/404');
                }
            });
        }
    }, [groupName, initialLoaded, dispatch, navigate]);

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
                    label: 'Group members',
                    content: (
                        <Table
                            tableName='User'
                            tableType={hasPermission(Permission.ADMIN, currentUser.permissions) ? 'single' : undefined}
                            actions={groupUserActions}
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
                    label: 'Group datasets',
                    content: (
                        <Table
                            tableName='Dataset'
                            actions={groupDatasetUserActions}
                            itemNameProperty='name'
                            trackBy='location'
                            allItems={groupDatasets}
                            columnDefinitions={defaultColumnsWithUrlOverride}
                            visibleColumns={visibleColumns}
                            loadingItems={loadingDatasetData || !initialLoaded}
                            loadingText='Loading Group datasets'
                            variant='borderless'
                        />
                    )
                }]} />

            </SpaceBetween>
        </ContentLayout>
    );
}

export default GroupDetail;