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
import { groupColumns, visibleColumns } from './group.columns';
import Table from '../../modules/table';
import { DocTitle } from '../../shared/doc';
import { GroupActions } from './group.actions';
import { useGetCurrentUserQuery } from '../user/user.reducer';
import { hasPermission } from '../../shared/util/permission-utils';
import { Permission } from '../../shared/model/user.model';
import { useLocation } from 'react-router-dom';
import { useGetAllGroupsQuery } from './group.reducer';
import { AdminBasePath } from '../../shared/layout/base-path-context';
import BasePathContext from '../../shared/layout/base-path-context';

export function Group () {
    const basePath = useContext(BasePathContext);
    const { data: groups, isFetching: isFetchingGroups } = useGetAllGroupsQuery({adminGetAll: basePath === AdminBasePath});
    const {pathname} = useLocation();
    const { data: currentUser } = useGetCurrentUserQuery();

    DocTitle('Groups');

    return (
        <Table
            tableName='Group'
            trackBy='name'
            actions={GroupActions}
            allItems={groups || []}
            tableType={currentUser && hasPermission(Permission.ADMIN, currentUser.permissions) ? 'single' : undefined}
            tableDescription={pathname.includes('admin') ? `All ${window.env.APPLICATION_NAME} groups` : 'The groups that you are a member of'}
            columnDefinitions={groupColumns}
            visibleColumns={visibleColumns}
            loadingItems={isFetchingGroups}
            loadingText='Loading groups'
        />
    );
}

export default Group;