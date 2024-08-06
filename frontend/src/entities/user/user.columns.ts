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

import { TableProps } from '@cloudscape-design/components';
import { IProjectUser } from '../../shared/model/projectUser.model';
import { IUser, Permission } from '../../shared/model/user.model';
import { IGroupUser } from '../../shared/model/groupUser.model';

const groupUserColumns: TableProps.ColumnDefinition<IGroupUser>[] = [
    { id: 'name', header: 'Name', sortingField: 'name', cell: (item) => item.user },
];

const projectUserColumns: TableProps.ColumnDefinition<IProjectUser>[] = [
    { id: 'name', header: 'Name', sortingField: 'name', cell: (item) => item.user },
    {
        id: 'mo',
        header: 'Owner',
        sortingField: 'mo',
        cell: (item) => (item.permissions?.includes(Permission.PROJECT_OWNER) ? 'Yes' : 'No'),
    },
];
// These columns should be updated once the lambdas are updated. Displaying MO status doesn't make
// sense for a generic user table
const userColumns: TableProps.ColumnDefinition<IUser>[] = [
    { id: 'name', header: 'Username', sortingField: 'name', cell: (item) => item.username },
    {
        id: 'displayName',
        header: 'Display Name',
        sortingField: 'displayName',
        cell: (item) => item.displayName,
    },
    { id: 'email', header: 'E-Mail', sortingField: 'email', cell: (item) => item.email },
    {
        id: 'suspended',
        header: 'Status',
        sortingField: 'suspended',
        cell: (item) => (item.suspended ? 'Suspended' : 'Active'),
    },
    {
        id: 'admin',
        header: 'Admin',
        sortingField: 'admin',
        cell: (item) => (item.permissions?.includes(Permission.ADMIN) ? 'Yes' : 'No'),
    },
    {
        id: 'lastLogin',
        header: 'Last login',
        sortingField: 'lastLogin',
        cell: (item) => new Date(item.lastLogin! * 1000).toUTCString(),
    },
];

const visibleColumns: string[] = ['name', 'suspended', 'admin', 'lastLogin'];
const visibleGroupUserColumns: string[] = ['name'];
const visibleProjectUserColumns: string[] = ['name', 'mo'];

const visibleContentPreference = {
    title: 'Select visible user content',
    options: [
        {
            label: 'User properties',
            options: [
                { id: 'name', label: 'Name' },
                { id: 'mo', label: 'MO' },
            ],
        },
    ],
};

const addUserVisibleColumns: string[] = ['name', 'displayName', 'email'];

export {
    groupUserColumns,
    visibleGroupUserColumns,
    projectUserColumns,
    userColumns,
    visibleColumns,
    addUserVisibleColumns,
    visibleContentPreference,
    visibleProjectUserColumns,
};
