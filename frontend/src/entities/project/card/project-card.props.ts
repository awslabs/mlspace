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

import { CollectionPreferencesProps } from '@cloudscape-design/components';

export const cardsPerRow = [{ cards: 1 }, { minWidth: 500, cards: 2 }];

export const visibleContentPreference: CollectionPreferencesProps.VisibleContentPreference = {
    title: 'Select visible content',
    options: [
        {
            label: 'Project content',
            options: [
                { id: 'description', label: 'Description' },
                { id: 'status', label: 'Status' },
            ],
        },
    ],
};

export const pageSizePreference = {
    title: 'Select page size',
    options: [
        { value: 6, label: '6 projects' },
        { value: 12, label: '12 projects' },
    ],
};

export type IProjectCardProps = {
    pageSize?: number;
    visibleContent?: readonly string[];
};

export const visibleContent: string[] = ['description', 'status'];
