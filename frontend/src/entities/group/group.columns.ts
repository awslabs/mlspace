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
import { IGroup } from '../../shared/model/group.model';
import { linkify } from '../../shared/util/table-utils';
import { IProjectGroup } from '../../shared/model/projectGroup.model';
import { formatDisplayBoolean } from '../../shared/util/form-utils';
import { hasPermission } from '../../shared/util/permission-utils';
import { Permission } from '../../shared/model/user.model';

export const groupColumns: TableProps.ColumnDefinition<IGroup>[] = [{
    id: 'name',
    header: 'Name',
    sortingField: 'name',
    cell: (item) => {
        return linkify('group', item.name);
    },
},{
    id: 'description',
    header: 'Description',
    sortingField: 'description',
    cell: (item) => item.description,
},
{
    id: 'members',
    header: 'Members',
    sortingField: 'members',
    cell: (item) => item.numMembers || '-',
}];

const visibleColumns: string[] = ['name', 'description', 'members'];

const visibleContentPreference = {
    title: 'Select visible group content',
    options: [
        {
            label: 'Group properties',
            options: [
                {id: 'name', label: 'Name'},
                {id: 'description', label: 'Description'},
                {id: 'members', label: 'Members'}
            ],
        },
    ],
};

export const projectGroupColumns: TableProps.ColumnDefinition<IProjectGroup>[] = [{
    id: 'project',
    header: 'Project name',
    cell: (item) => {
        return linkify('project', item.project, undefined, undefined, true);
    },
}, {
    id: 'owner',
    header: 'Owner',
    cell: (item) => {
        return formatDisplayBoolean(hasPermission(Permission.PROJECT_OWNER, item.permissions), ['Yes', 'No']);
    },
}];

export {
    visibleColumns,
    visibleContentPreference
};