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

import { DocTitle, scrollToPageHeader } from '../../../src/shared/doc';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import { useAppDispatch } from '../../config/store';
import {
    Header,
    ContentLayout,
    SpaceBetween,
    Tabs
} from '@cloudscape-design/components';
import React, { useEffect } from 'react';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { useParams } from 'react-router-dom';
import DeploymentConfiguration from './deployment-configuration';
import DynamicConfiguration from './dynamic-configuration';
import { ConfigurationHistoryTable } from './configuration-history-table';

export function Configuration () {
    const dispatch = useAppDispatch();
    const { projectName } = useParams();

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Configuration', href: '#/admin/configuration' },
            ])
        );

        scrollToPageHeader('h1', `${window.env.APPLICATION_NAME} Configuration`);
    }, [dispatch, projectName]);

    scrollToPageHeader();
    DocTitle('Configuration');

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description={`The current configuration of ${window.env.APPLICATION_NAME}`}
                >
                    {window.env.APPLICATION_NAME} Configuration
                </Header>
            }
        >
            <SpaceBetween direction='vertical' size='xl'>
                <Tabs
                    tabs={[
                        {
                            label: 'Dynamic Configuration',
                            id: 'dynamic-config',
                            content: <DynamicConfiguration/>,
                            // disabled: true
                        },
                        {
                            label: 'Dynamic Configuration History',
                            id: 'config-hist',
                            content: <ConfigurationHistoryTable/>,
                            // disabled: true
                        },
                        {
                            label: 'Deployment Configuration',
                            id: 'deployment-config',
                            content: <DeploymentConfiguration/>
                        },
                    ]}
                />
            </SpaceBetween>
            
        </ContentLayout>
    );
}

export default Configuration;
