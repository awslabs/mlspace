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

import { TableProps as CloudscapeTableProps } from '@cloudscape-design/components';
import React, { ReactNode, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DocTitle, scrollToPageHeader } from '../../../src/shared/doc';
import { useAppDispatch, useAppSelector } from '../../config/store';
import Table from '../../modules/table';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import { IUser } from '../../shared/model/user.model';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { CallbackFunction } from '../../types';
import { UserActions } from './user.actions';
import { userColumns, visibleColumns } from './user.columns';
import { getAllUsers } from './user.reducer';

export type UserTableProps = {
    header?: ReactNode;
    selectItemsCallback?: CallbackFunction;
    tableType?: CloudscapeTableProps.SelectionType;
    variant?: CloudscapeTableProps.Variant;
};

export function User (props: UserTableProps) {
    const systemUsers: IUser[] = useAppSelector((state) => state.user.allUsers);
    const loadingSystemUsers = useAppSelector((state) => state.user.loading);
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const actions = (e: any) => UserActions({ ...e });
    const isEmbedded = props.variant !== 'embedded';

    if (!isEmbedded) {
        DocTitle('Users');
    }

    useEffect(() => {
        if (!isEmbedded) {
            dispatch(setBreadcrumbs([getBase(projectName), { text: 'Users', href: '#/admin/users' }]));
            scrollToPageHeader('h1', 'Users');
        }
        dispatch(getAllUsers());

    }, [dispatch, projectName, isEmbedded]);

    return (
        <Table
            header={props.header}
            tableName='User'
            trackBy='username'
            tableType={props.tableType || 'single'}
            variant={props.variant}
            actions={props.variant !== 'embedded' ? actions : undefined}
            allItems={systemUsers}
            columnDefinitions={userColumns}
            visibleColumns={visibleColumns}
            selectItemsCallback={props.selectItemsCallback}
            loadingItems={loadingSystemUsers}
            loadingText='Loading users'
        />
    );
}

export default User;
