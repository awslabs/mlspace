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
import { currentGroupUsers, getGroup, getGroupUsers } from '../group.reducer';
import { Header, SpaceBetween } from '@cloudscape-design/components';
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

export function GroupDetail () {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const {groupName} = useParams();
    const [group, setGroup] = useState<IGroup>();
    const groupUsers: IGroupUser[] = useAppSelector(currentGroupUsers);
    const loadingGroupUsers = useAppSelector((state) => state.group.loading);
    const currentUser = useAppSelector(selectCurrentUser);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const actions = (e: any) => GroupDetailUserActions({...e});
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
                <Table
                    tableName='Group user'
                    tableType={hasPermission(Permission.ADMIN, currentUser.permissions) ? 'single' : undefined}
                    actions={actions}
                    itemNameProperty='user'
                    trackBy='user'
                    allItems={groupUsers}
                    columnDefinitions={groupUserColumns}
                    visibleColumns={visibleGroupUserColumns}
                    loadingItems={loadingGroupUsers || !initialLoaded}
                    loadingText='Loading Group users'
                />
            </SpaceBetween>
        </ContentLayout>
    );
}

export default GroupDetail;