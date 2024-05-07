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

import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import { useAppDispatch } from '../../config/store';
import {
    ExpandableSection,
    Header,
    SpaceBetween,
    Container,
    FormField,
    Multiselect,
    MultiselectProps,
    SelectProps,
    Button,
} from '@cloudscape-design/components';
import { defaultEnvConfig } from '../../shared/model/configuration.model';
import React, { useEffect, useState } from 'react';
import { getEnvironmentConfig } from './configuration.service';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { useParams } from 'react-router-dom';
import Condition from '../../modules/condition';
import axios from '../../shared/util/axios-utils';
import NotificationService from '../../shared/layout/notification/notification.service';

export function DeploymentConfiguration () {
    const [config, setEnvConfig] = useState(defaultEnvConfig);
    const [selectedResources, setSelectedResources] = useState([] as readonly SelectProps.Option[]);
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const [syncingMetadata, setSyncingMetadata] = useState(false);
    const notificationService = NotificationService(dispatch);

    const generateDescription = (service: string) => {
        return `Sync metadata for all ${service} associated with ${window.env.APPLICATION_NAME}`;
    };

    const resourceOptions: MultiselectProps.Option[] = [
        {
            label: 'Endpoints',
            value: 'Endpoints',
            description: generateDescription('SageMaker endpoints'),
        },
        {
            label: 'Endpoint Configurations',
            value: 'EndpointConfigs',
            description: generateDescription('SageMaker endpoint configurations'),
        },
        {
            label: 'EMR Clusters',
            value: 'EMRClusters',
            description: generateDescription('Elastic Map Reduce clusters'),
        },
        {
            label: 'HPO Jobs',
            value: 'HPOJobs',
            description: generateDescription('SageMaker hyper parameter tuning jobs'),
        },
        {
            label: 'Models',
            value: 'Models',
            description: generateDescription('SageMaker models'),
        },
        {
            label: 'Notebooks',
            value: 'Notebooks',
            description: generateDescription('SageMaker notebooks'),
        },
        {
            label: 'Training Jobs',
            value: 'TrainingJobs',
            description: generateDescription('SageMaker training jobs'),
        },
        {
            label: 'Transform Jobs',
            value: 'TransformJobs',
            description: generateDescription('SageMaker transform jobs'),
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

    }, [dispatch, projectName]);

    return (
        <Container
            header={
                <Header
                    variant='h2'
                    description={`The current configuration set up during deployment of ${window.env.APPLICATION_NAME}`}
                >
                    {window.env.APPLICATION_NAME} Deployment Configuration
                </Header>
            }
        >
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
    );
}

export default DeploymentConfiguration;
