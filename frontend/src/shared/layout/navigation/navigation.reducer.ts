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

import { BreadcrumbGroupProps, SideNavigationProps } from '@cloudscape-design/components';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {IEnabledServices} from '../../model/app.configuration.model';

const initialState = {
    breadcrumbs: [] as BreadcrumbGroupProps.Item[],
    activeHref: '#/',
    navItems: [] as SideNavigationProps.Item[],
    adminItems: undefined as SideNavigationProps.Item | undefined,
    enabledServices: {} as IEnabledServices,
};

// slice
const navigationSlice = createSlice({
    name: 'navigation',
    initialState,
    reducers: {
        setBreadcrumbs (state, action: PayloadAction<BreadcrumbGroupProps.Item[]>) {
            state.breadcrumbs = action.payload;
        },
        setActiveHref (state, action: PayloadAction<string>) {
            state.activeHref = action.payload;
        },
        setEnabledServices (state, action: PayloadAction<IEnabledServices>) {
            state.enabledServices = action.payload;
        },
        setAdminItems (state, action: PayloadAction<boolean>) {
            if (action.payload) {
                state.adminItems = {
                    type: 'section',
                    text: 'Administration',
                    defaultExpanded: true,
                    items: [
                        { type: 'link', text: 'Users', href: '#/admin/users' },
                        { type: 'link', text: 'Groups', href: '#/admin/groups' },
                        { type: 'link', text: 'Configuration', href: '#/admin/configuration' },
                        { type: 'link', text: 'Reports', href: '#/admin/reports' },
                    ],
                };
            } else {
                state.adminItems = undefined;
            }
        },
        setItemsForProjectName (state, action: PayloadAction<string | undefined>) {
            const projectName = action.payload;
            if (projectName) {
                const translateItems: any = state.enabledServices.batchTranslate || state.enabledServices.realtimeTranslate
                    ? [
                        {
                            type: 'section',
                            text: 'Translation',
                            defaultExpanded: false,
                            items: [
                            ],
                        },
                    ]
                    : [];

                if (state.enabledServices.batchTranslate) {
                    translateItems[0].items.push({
                        type: 'link',
                        text: 'Batch translate',
                        href: `#/project/${projectName}/batch-translate`,
                    });
                }

                if (state.enabledServices.realtimeTranslate) {
                    translateItems[0].items.push({
                        type: 'link',
                        text: 'Real-time translation',
                        href: '#/personal/translate/realtime',
                    });
                }

                const groundTruthItems: any = state.enabledServices.labelingJob
                    ? [
                        {
                            type: 'section',
                            text: 'Ground Truth',
                            defaultExpanded: false,
                            items: [
                                {
                                    type: 'link',
                                    text: 'Labeling jobs',
                                    href: `#/project/${projectName}/jobs/labeling`,
                                },
                            ],
                        },
                    ]
                    : [];

                state.navItems = [
                    {
                        type: 'link-group',
                        text: projectName,
                        href: `#/project/${projectName}`,
                        items: [
                            {
                                type: 'link',
                                text: 'Notebook instances',
                                href: `#/project/${projectName}/notebook`,
                            },
                            {
                                type: 'link',
                                text: 'Datasets',
                                href: `#/project/${projectName}/dataset`,
                            },
                            ...state.enabledServices.emrCluster ? [{
                                type: 'link',
                                text: 'EMR clusters',
                                href: `#/project/${projectName}/emr`,
                            }] : [],
                            {
                                type: 'section',
                                text: 'Inference',
                                defaultExpanded: false,
                                items: [
                                    {
                                        type: 'link',
                                        text: 'Endpoints',
                                        href: `#/project/${projectName}/endpoint`,
                                    },
                                    {
                                        type: 'link',
                                        text: 'Endpoint configurations',
                                        href: `#/project/${projectName}/endpoint-config`,
                                    },
                                    {
                                        type: 'link',
                                        text: 'Models',
                                        href: `#/project/${projectName}/model`,
                                    },
                                    {
                                        type: 'link',
                                        text: 'Batch transform',
                                        href: `#/project/${projectName}/jobs/transform`,
                                    },
                                ],
                            },
                            {
                                type: 'section',
                                text: 'Training',
                                defaultExpanded: false,
                                items: [
                                    {
                                        type: 'link',
                                        text: 'Training',
                                        href: `#/project/${projectName}/jobs/training`,
                                    },
                                    {
                                        type: 'link',
                                        text: 'Hyperparameter Optimization (HPO)',
                                        href: `#/project/${projectName}/jobs/hpo`,
                                    },
                                ],
                            },
                            ...translateItems,
                            ...groundTruthItems,
                            { type: 'divider' },
                        ],
                    },
                ];
            } else {
                state.navItems = [];
            }
        },
    },
});

// Reducer
export const { setBreadcrumbs, setActiveHref, setItemsForProjectName, setAdminItems, setEnabledServices } =
    navigationSlice.actions;
export default navigationSlice.reducer;
