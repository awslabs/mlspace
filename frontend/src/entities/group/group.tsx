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
import { DocTitle } from '../../shared/doc';
import { GroupActions } from '../group/group.actions';

export function Group () {
    const groups: IGroup[] = useAppSelector((state) => state.group.allGroups);
    const loadingGroups = useAppSelector((state) => state.group.loading);
    const dispatch = useAppDispatch();
    const actions = (e: any) => GroupActions({...e});
    DocTitle('Groups');

    useEffect(() => {
        dispatch(getAllGroups());
    }, [dispatch]);

    return (
        <Table
            tableName='Group'
            trackBy='name'
            actions={actions}
            allItems={groups}
            tableType='single'
            columnDefinitions={groupColumns}
            visibleColumns={visibleColumns}
            loadingItems={loadingGroups}
            loadingText='Loading groups'
        />
    );
}

export default Group;