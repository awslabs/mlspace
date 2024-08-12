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
import { IGroupMembershipHistory } from '../../../shared/model/groupMembershipHistory.model';

export const groupHistoryColumns: TableProps.ColumnDefinition<IGroupMembershipHistory>[] = [{
    id: 'user',
    header: 'User',
    sortingField: 'user',
    cell: (item) => item.user,
},{
    id: 'group',
    header: 'Group',
    sortingField: 'group',
    cell: (item) => item.group,
},{
    id: 'action',
    header: 'Action',
    sortingField: 'action',
    cell: (item) => item.action,
},{
    id: 'actionedBy',
    header: 'Actioned By',
    sortingField: 'actionedBy',
    cell: (item) => item.actionedBy,
},{
    id: 'actionedAt',
    header: 'Actioned At',
    sortingField: 'actionedAt',
    cell: (item) => new Date(item.actionedAt * 1000).toLocaleString(),
}];

export const visibleGroupHistoryColumns: string[] = ['user', 'action', 'actionedBy', 'actionedAt'];