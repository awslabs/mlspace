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
import { IProject } from '../../shared/model/project.model';

const projectColumns: TableProps.ColumnDefinition<IProject>[] = [
    { id: 'name', header: 'Name', sortingField: 'name', cell: (item) => item.name },
    {
        id: 'description',
        header: 'Description',
        sortingField: 'description',
        cell: (item) => item.description,
    },
    { id: 'suspended', header: 'Status', sortingField: 'suspended', cell: (item) => item.suspended ? 'Suspended' : 'Active' },
];

const visibleColumns: string[] = ['name', 'description', 'suspended'];

const visibleContentPreference = {
    title: 'Select visible project content',
    options: [
        {
            label: 'Project properties',
            options: [
                { id: 'name', label: 'Name' },
                { id: 'description', label: 'Description' },
                { id: 'suspended', label: 'Status' },
            ],
        },
    ],
};

export {
    projectColumns,
    visibleColumns,
    visibleContentPreference
};

