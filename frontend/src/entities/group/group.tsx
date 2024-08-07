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

import React, { useEffect } from 'react';
import { groupColumns, visibleColumns } from './group.columns';
import Table from '../../modules/table';
import { IGroup } from '../../shared/model/group.model';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { getAllGroups } from './group.reducer';
import { DocTitle, scrollToPageHeader } from '../../shared/doc';
import { GroupActions } from './group.actions';
import { selectCurrentUser } from '../user/user.reducer';
import { hasPermission } from '../../shared/util/permission-utils';
import { Permission } from '../../shared/model/user.model';
import { useLocation } from 'react-router-dom';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import { getBase } from '../../shared/util/breadcrumb-utils';

export function Group () {
    const groups: IGroup[] = useAppSelector((state) => state.group.allGroups);
    const loadingGroups = useAppSelector((state) => state.group.loading);
    const dispatch = useAppDispatch();
    const {pathname} = useLocation();
    const actions = (e: any) => GroupActions({...e});
    const currentUser = useAppSelector(selectCurrentUser);
    DocTitle('Groups');

    useEffect(() => {
        dispatch(getAllGroups(pathname.includes('admin')));
    }, [dispatch, pathname]);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(undefined),
                { text: 'Groups', href: window.location.href.includes('#/admin') ? '#/admin/groups' : '#/personal/group' },
            ])
        );

        scrollToPageHeader('h1', 'Groups');
    }, [dispatch]);

    return (
        <Table
            tableName='Group'
            trackBy='name'
            actions={actions}
            allItems={groups}
            tableType={hasPermission(Permission.ADMIN, currentUser.permissions) ? 'single' : undefined}
            tableDescription={pathname.includes('admin') ? `All ${window.env.APPLICATION_NAME} groups` : 'The groups that you are a member of'}
            columnDefinitions={groupColumns}
            visibleColumns={visibleColumns}
            loadingItems={loadingGroups}
            loadingText='Loading groups'
        />
    );
}

export default Group;