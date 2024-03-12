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
    ExpandableSection,
    Header,
    ContentLayout,
    SpaceBetween,
    Container,
    FormField,
    Multiselect,
    MultiselectProps,
    SelectProps,
    Button,
} from '@cloudscape-design/components';
import { defaultEnvConfig, envConfig } from '../../shared/model/configuration.model';
import React, { useEffect, useState } from 'react';
import { getEnvironmentConfig } from './configuration.service';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { useParams } from 'react-router-dom';
import Condition from '../../modules/condition';
import axios from '../../shared/util/axios-utils';
import NotificationService from '../../shared/layout/notification/notification.service';

export function Configuration () {
    const [config, setEnvConfig] = useState(defaultEnvConfig as envConfig);
    const [selectedResources, setSelectedResources] = useState([] as readonly SelectProps.Option[]);
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const [syncingMetadata, setSyncingMetadata] = useState(false);
    const notificationService = NotificationService(dispatch);

    const resourceOptions: MultiselectProps.Option[] = [
        {
            label: 'Endpoints',
            value: 'Endpoints',
            description: `Sync metadata for all SageMaker endpoints associated with ${window.env.APPLICATION_NAME}`,
        },
        {
            label: 'Endpoint Configurations',
            value: 'EndpointConfigs',
            description:
                `Sync metadata for all SageMaker endpoint configurations associated with ${window.env.APPLICATION_NAME}`,
        },
        {
            label: 'HPO Jobs',
            value: 'HPOJobs',
            description:
                `Sync metadata for all SageMaker hyper parameter tuning jobs associated with ${window.env.APPLICATION_NAME}`,
        },
        {
            label: 'Models',
            value: 'Models',
            description: `Sync metadata for all SageMaker models associated with ${window.env.APPLICATION_NAME}`,
        },
        {
            label: 'Notebooks',
            value: 'Notebooks',
            description: `Sync metadata for all SageMaker notebooks associated with ${window.env.APPLICATION_NAME}`,
        },
        {
            label: 'Training Jobs',
            value: 'TrainingJobs',
            description: `Sync metadata for all SageMaker training jobs associated with ${window.env.APPLICATION_NAME}`,
        },
        {
            label: 'Transform Jobs',
            value: 'TransformJobs',
            description: `Sync metadata for all SageMaker transform jobs associated with ${window.env.APPLICATION_NAME}`,
        },
    ];

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Configuration', href: '#/admin/configuration' },
            ])
        );
        getEnvironmentConfig().then((result) => {
            // convert scripts from base64
            result.notebookLifecycleConfig!.OnCreate[0]['Content'] = atob(
                result.notebookLifecycleConfig!.OnCreate[0]['Content']
            );
            result.notebookLifecycleConfig!.OnStart[0]['Content'] = atob(
                result.notebookLifecycleConfig!.OnStart[0]['Content']
            );
            setEnvConfig(result);
        });

        scrollToPageHeader('h1', `${window.env.APPLICATION_NAME} Configuration`);
    }, [dispatch, projectName]);

    scrollToPageHeader();
    DocTitle('Configuration');

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description={`The current configuration set up during deployment of ${window.env.APPLICATION_NAME}`}
                >
                    {window.env.APPLICATION_NAME} Configuration
                </Header>
            }
        >
            <Container>
                <SpaceBetween direction='vertical' size='xl'>
                    <ExpandableSection headerText='Environment Variables' variant='default'>
                        {<pre>{JSON.stringify(config?.environmentVariables, null, 2) || ''}</pre>}
                    </ExpandableSection>
                    <ExpandableSection headerText='S3 Config File' variant='default'>
                        {<pre>{JSON.stringify(config?.s3ParamFile, null, 2) || ''}</pre>}
                    </ExpandableSection>
                    <ExpandableSection headerText='Notebook Lifecycle Config' variant='default'>
                        {
                            <pre>
                                {(JSON.stringify(config?.notebookLifecycleConfig, null, 2) || '')
                                    .split('\\n')
                                    .map(function (item, index) {
                                        return (
                                            <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
                                                {item}
                                                <br />
                                            </span>
                                        );
                                    }) || ''}
                            </pre>
                        }
                    </ExpandableSection>
                    <Condition condition={window.env.SHOW_MIGRATION_OPTIONS === true}>
                        <ExpandableSection headerText='Metadata Migration' variant='default'>
                            <SpaceBetween size='l'>
                                <FormField
                                    label='Resource Types'
                                    description='Select the resource you wish to manually sync metadata for'
                                >
                                    <Multiselect
                                        selectedOptions={selectedResources}
                                        onChange={({ detail }) =>
                                            setSelectedResources(detail.selectedOptions)
                                        }
                                        deselectAriaLabel={(e) => `Remove ${e.label}`}
                                        options={resourceOptions}
                                        filteringType='auto'
                                        placeholder='Choose options'
                                        selectedAriaLabel='Selected'
                                    />
                                </FormField>
                                <Button
                                    iconAlt='Sync metadata'
                                    variant='primary'
                                    onClick={async () => {
                                        if (selectedResources.length > 0) {
                                            setSyncingMetadata(true);
                                            try {
                                                const response = await axios.post(
                                                    '/admin/sync-metadata',
                                                    {
                                                        resourceTypes: selectedResources.map(
                                                            (option) => option.value
                                                        ),
                                                    }
                                                );
                                                notificationService.generateNotification(
                                                    response.data.message,
                                                    'success'
                                                );
                                            } catch (err) {
                                                notificationService.generateNotification(
                                                    `Failed to sync resource metadata: ${err}`,
                                                    'error'
                                                );
                                            } finally {
                                                setSyncingMetadata(false);
                                            }
                                        }
                                    }}
                                    disabled={syncingMetadata}
                                    loading={syncingMetadata}
                                >
                                    Sync metadata
                                </Button>
                            </SpaceBetween>
                        </ExpandableSection>
                    </Condition>
                </SpaceBetween>
            </Container>
        </ContentLayout>
    );
}

export default Configuration;
