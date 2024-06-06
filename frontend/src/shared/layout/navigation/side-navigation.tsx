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
import {
    Select,
    SideNavigation as CloudScapeSideNavigation,
    SideNavigationProps,
    Header,
    FormField
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import {setActiveHref, setItemsForProjectName} from './navigation.reducer';
import { OptionDefinition } from '@cloudscape-design/components/internal/components/option/interfaces';
import { IProject } from '../../model/project.model';
import { useLocation, useNavigate } from 'react-router-dom';
import { colorTextBodyDefault } from '@cloudscape-design/design-tokens';
import Logo from '../logo/logo';
import { appConfig } from '../../../entities/configuration/configuration-reducer';

export default function SideNavigation () {
    const items: SideNavigationProps.Item[] = useAppSelector((state) => state.navigation.navItems);
    const admin: SideNavigationProps.Item = useAppSelector((state) => state.navigation.adminItems);
    const activeHref: string = useAppSelector((state) => state.navigation.activeHref);
    const location = useLocation();
    const projectList: IProject[] = useAppSelector((state) => state.project.projects);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const project: IProject = useAppSelector((state) => state.project.project);
    const applicationConfig = useAppSelector(appConfig);
    const defaultState: OptionDefinition = {
        label: 'Select a project',
        value: '',
        description: `Select an ${window.env.APPLICATION_NAME} project in order to access datasets, notebooks, and jobs`,
    };

    const [selectedOption, setSelectedOption] = React.useState(defaultState);

    useEffect(() => {
        project.name
            ? setSelectedOption({
                label: project.name,
                value: project.name,
                description: project.description,
            })
            : setSelectedOption(defaultState);

        // Disable exhaustive-deps rule to skip having to add defaultState to dependency list
        // since it will never be updated
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project]);

    // Updates active href for the side-navigation with a location change hook
    useEffect(() => {
        dispatch(setActiveHref(`#${location.pathname}`));
    }, [dispatch, location]);

    const personalNavItems: SideNavigationProps.Item[] = [
        { type: 'link', text: 'Projects', href: '#/' },
        { type: 'link', text: 'Notebook instances', href: '#/personal/notebook' },
        { type: 'link', text: 'Datasets', href: '#/personal/dataset' },
    ];
    if (applicationConfig.configuration.EnabledServices.realtimeTranslate) {
        personalNavItems.push({
            type: 'link',
            text: 'Real-time Translation',
            href: '#/personal/translate/realtime',
        });
    }
    const personalResources: SideNavigationProps.Item = {
        type: 'section',
        text: 'My Resources',
        defaultExpanded: true,
        items: personalNavItems,
    };

    const projectOptions: OptionDefinition[] = projectList.map((p) => {
        return { label: p.name, value: p.name, description: p.description };
    });
    const documentationLink: SideNavigationProps.Item[] = [
        {
            type: 'divider',
        },
        {
            type: 'link',
            text: 'Documentation',
            href: `${window.env.LAMBDA_ENDPOINT}docs/index.html`,
            external: true,
            externalIconAriaLabel: '(opens in a new tab)',
        },
    ];

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1',
            // eslint-disable-next-line spellcheck/spell-checker
            height: '100vh',
        }}>
            {
                // Cloudscape built-in nav header doesn't allow us to include the select dropdown and
                // also lacks some required customization to pass accessibility audits
            }
            <div
                style={{
                    paddingLeft: '28px',
                    paddingRight: '26px',
                    paddingTop: '12px',
                    paddingBottom: '4px',
                }}
            >
                <Header variant='h3'>
                    <a
                        id='navLink'
                        style={{ textDecoration: 'none', color: colorTextBodyDefault }}
                        href={`${process.env.PUBLIC_URL}/#`}
                    >
                        <Logo height={24} width={24} />
                        <span
                            style={{
                                float: 'right',
                                display: 'block',
                                marginLeft: '12px',
                                fontWeight: '400',
                            }}
                        >
                            {window.env.APPLICATION_NAME}
                        </span>
                    </a>
                </Header>
            </div>
            <hr style={{ opacity: 0.2 }} />
            <div style={{ paddingLeft: '28px', paddingRight: '26px', paddingTop: '12px' }}>
                <FormField label='Current Project'>
                    <Select
                        controlId='projectSelector'
                        selectedOption={selectedOption}
                        onChange={({ detail }) => {
                            setSelectedOption(detail.selectedOption);
                            dispatch(setItemsForProjectName(detail.selectedOption.value));
                            navigate(`/project/${detail.selectedOption.value}`);
                        }}
                        options={projectOptions}
                        filteringType='auto'
                        filteringAriaLabel='Filter projects'
                        filteringClearAriaLabel='Clear project selection'
                    />
                </FormField>
            </div>
            <CloudScapeSideNavigation
                activeHref={activeHref}
                items={
                    admin
                        ? [
                            {
                                type: 'divider',
                            },
                            ...items,
                            personalResources,
                            admin,
                            ...documentationLink,
                        ]
                        : [
                            {
                                type: 'divider',
                            },
                            ...items,
                            personalResources,
                            ...documentationLink,
                        ]
                }
            />
            {window.gitInfo && (
                <div
                    style={{
                        fontSize: '10px',
                        marginTop: 'auto',
                        alignSelf: 'flex-end',
                        marginRight: 'auto',
                        padding: '10px',
                    }}
                    title={window.gitInfo?.gitHash}>
                    {window.gitInfo?.revisionTag}
                </div>
            )}
        </div>
    );
}
