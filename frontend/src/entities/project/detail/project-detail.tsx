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

import React, { ReactNode, useEffect, useState } from 'react';
import { ContentLayout, SpaceBetween, Header, Container, ColumnLayout, StatusIndicator, Grid, Box, Link, Icon, Button} from '@cloudscape-design/components';
import { IProject } from '../../../shared/model/project.model';
import { ResourceType } from '../../../shared/model/resource-metadata.model';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import ProjectHomeActions from './project-detail.actions';
import {
    setActiveHref,
    setBreadcrumbs,
    setItemsForProjectName,
} from '../../../shared/layout/navigation/navigation.reducer';
import { getProject } from '../project.reducer';
import { useNavigate, useParams } from 'react-router-dom';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import DetailsContainer from '../../../modules/details-container';
import {
    convertDailyStopTime,
    hoursToDays,
    timezoneDisplayString,
} from '../../../shared/util/date-utils';
import { selectCurrentUser } from '../../user/user.reducer';
import { Timezone } from '../../../shared/model/user.model';
import _ from 'lodash';
import { useBackgroundRefresh } from '../../../shared/util/hooks';
import { IAppConfiguration } from '../../../shared/model/app.configuration.model';
import { appConfig } from '../../configuration/configuration-reducer';

function ProjectDetail () {
    const { projectName } = useParams();
    const project: IProject = useAppSelector((state) => state.project.project);
    const loadingProjectDetails = useAppSelector((state) => state.project.loading);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const currentUser = useAppSelector(selectCurrentUser);
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    scrollToPageHeader('h1', projectName);
    DocTitle('Project Details: ', projectName);

    useEffect(() => {
        dispatch(getProject({projectName: projectName!, includeResourceCounts: true}))
            .unwrap()
            .then(() => setInitialLoaded(true))
            .catch(() => {
                navigate('/404');
            });
        dispatch(setItemsForProjectName(projectName));
        dispatch(setBreadcrumbs([getBase(projectName)]));
        dispatch(setActiveHref('/#'));
    }, [dispatch, navigate, projectName, project.name]);

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(async () => {
        await dispatch(getProject({projectName: projectName!, includeResourceCounts: true}));
    }, [dispatch]);

    const allowOverrideText = (
        suspensionVal?: number | string | undefined,
        allowOverride?: boolean
    ): string => {
        if (suspensionVal === undefined) {
            return 'N/A';
        }
        return allowOverride ? 'Yes' : 'No';
    };

    const projectDetails = new Map<string, ReactNode>();
    projectDetails.set('Name', project.name);
    projectDetails.set('Description', project.description);

    const resourceScheduleSummary = new Map<string, ReactNode>();
    resourceScheduleSummary.set(
        'Default Endpoint runtime (days)',
        hoursToDays(project.metadata?.terminationConfiguration?.defaultEndpointTTL)
    );
    resourceScheduleSummary.set(
        'Default EMR runtime (days)',
        hoursToDays(project.metadata?.terminationConfiguration?.defaultEMRClusterTTL)
    );
    resourceScheduleSummary.set(
        `Default daily Notebook suspension time (${timezoneDisplayString(
            currentUser.preferences?.timezone
        )})`,
        convertDailyStopTime(
            project.metadata?.terminationConfiguration?.defaultNotebookStopTime,
            Timezone.UTC,
            currentUser.preferences?.timezone
        )
    );
    resourceScheduleSummary.set(
        'Allow Endpoint termination override',
        allowOverrideText(
            project.metadata?.terminationConfiguration?.defaultEndpointTTL,
            project.metadata?.terminationConfiguration?.allowEndpointOwnerOverride
        )
    );
    resourceScheduleSummary.set(
        'Allow EMR Cluster termination override',
        allowOverrideText(
            project.metadata?.terminationConfiguration?.defaultEMRClusterTTL,
            project.metadata?.terminationConfiguration?.allowEMROwnerOverride
        )
    );
    resourceScheduleSummary.set(
        'Allow Notebook suspension override',
        allowOverrideText(
            project.metadata?.terminationConfiguration?.defaultNotebookStopTime,
            project.metadata?.terminationConfiguration?.allowNotebookOwnerOverride
        )
    );

    const projectResourceCounts = useAppSelector((state) => state.project.resourceCounts);

    function ProjectResourceCount ({iconName, variantStyle, resourceKey, resourceLabel}): ReactNode {
        return (<Box>
            <SpaceBetween direction='horizontal' size='s'>
                <Icon key='icon' name={iconName} variant={variantStyle} />
                <div key='text'>
                    {`${_.get(projectResourceCounts, resourceKey, 0)} ${resourceLabel}`}
                </div>
            </SpaceBetween>
        </Box>);
    }

    type ProjectResourceRowProperties = {
        label: string;
        path: string;
        children: any;
    };

    function ProjectResourceRow ({
        label,
        path,
        children,
    }: ProjectResourceRowProperties): ReactNode {
        const gridDefinition = [{ colspan: { default: 12, xs: 3 } }];
        for (let i = 0; i < React.Children.count(children); i++) {
            gridDefinition.push({ colspan: { default: 12, xs: 2 } });
        }
        return (
            <Grid gridDefinition={gridDefinition}>
                <Box fontWeight='bold'>
                    <Link href={`${window.location.href}/${path}`}>
                        {label}
                    </Link>
                </Box>
                {children}
            </Grid>
        );
    }

    return (
        <ContentLayout header={<Header variant='h1'>{projectName}</Header>}>
            <SpaceBetween direction='vertical' size='xxl'>
                <DetailsContainer
                    columns={1}
                    header='Project details'
                    actions={ProjectHomeActions()}
                    info={projectDetails}
                    loading={loadingProjectDetails && !initialLoaded}
                />
                <DetailsContainer
                    columns={3}
                    header='Default resource scheduling'
                    info={resourceScheduleSummary}
                    loading={loadingProjectDetails && !initialLoaded}
                />
                <Container>
                    <SpaceBetween size='l'>
                        <Header variant='h2' actions={
                            <Button
                                key='refreshButton'
                                variant='normal'
                                iconName='refresh'
                                loading={loadingProjectDetails || isBackgroundRefreshing}
                                onClick={() =>
                                    dispatch(getProject({projectName: projectName!, includeResourceCounts: true}))
                                }
                                ariaLabel={'Refresh table contents'}
                            />
                        }>Project resources</Header>
                        {loadingProjectDetails && !initialLoaded ? (
                            <StatusIndicator type='loading'>Loading project resources</StatusIndicator>
                        ) : (projectResourceCounts?.[ResourceType.NOTEBOOK] &&
                            <ColumnLayout borders='horizontal' columns={1}>

                                <ProjectResourceRow label='Notebook instances' path='notebook'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.NOTEBOOK}.Total`} resourceLabel='Total' />
                                    <ProjectResourceCount iconName='status-in-progress' variantStyle='success' resourceKey={`${ResourceType.NOTEBOOK}.Inservice`} resourceLabel='Running' />
                                    <ProjectResourceCount iconName='status-pending' variantStyle='subtle' resourceKey={`${ResourceType.NOTEBOOK}.Pending`} resourceLabel='Pending' />
                                    <ProjectResourceCount iconName='status-stopped' variantStyle='subtle' resourceKey={`${ResourceType.NOTEBOOK}.Stopped`} resourceLabel='Stopped' />
                                </ProjectResourceRow>

                                <ProjectResourceRow label='EMR clusters' path='emr'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.EMR_CLUSTER}.Total`} resourceLabel='Total' />
                                    <ProjectResourceCount iconName='status-in-progress' variantStyle='success' resourceKey={`${ResourceType.EMR_CLUSTER}.RUNNING`} resourceLabel='Running' />
                                    <ProjectResourceCount iconName='status-pending' variantStyle='subtle' resourceKey={`${ResourceType.EMR_CLUSTER}.STARTING`} resourceLabel='Starting' />
                                    <ProjectResourceCount iconName='status-positive' variantStyle='success' resourceKey={`${ResourceType.EMR_CLUSTER}.WAITING`} resourceLabel='Waiting' />
                                </ProjectResourceRow>

                                <ProjectResourceRow label='Endpoints' path='endpoint'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.ENDPOINT}.Total`} resourceLabel='Total' />
                                    <ProjectResourceCount iconName='status-in-progress' variantStyle='success' resourceKey={`${ResourceType.ENDPOINT}.In_Service`} resourceLabel='Running' />
                                </ProjectResourceRow>

                                <ProjectResourceRow label='Endpoint configurations' path='endpoint-config'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.ENDPOINT_CONFIG}.Total`} resourceLabel='Total' />
                                </ProjectResourceRow>

                                <ProjectResourceRow label='Models' path='model'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.MODEL}.Total`} resourceLabel='Total' />
                                </ProjectResourceRow>

                                {applicationConfig.configuration.EnabledServices.batchTranslate && <ProjectResourceRow label='Batch translate job' path='batch-translate'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.BATCH_TRANSLATE_JOB}.Total`} resourceLabel='Total' />
                                    <ProjectResourceCount iconName='status-in-progress' variantStyle='success' resourceKey={`${ResourceType.BATCH_TRANSLATE_JOB}.Inprogress`} resourceLabel='Running' />
                                    <ProjectResourceCount iconName='status-negative' variantStyle='error' resourceKey={`${ResourceType.BATCH_TRANSLATE_JOB}.Failed`} resourceLabel='Failed' />
                                    <ProjectResourceCount iconName='status-positive' variantStyle='success' resourceKey={`${ResourceType.BATCH_TRANSLATE_JOB}.Completed`} resourceLabel='Completed' />
                                </ProjectResourceRow>}

                                <ProjectResourceRow label='HPO job' path='jobs/hpo'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.HPO_JOB}.Total`} resourceLabel='Total' />
                                    <ProjectResourceCount iconName='status-in-progress' variantStyle='success' resourceKey={`${ResourceType.HPO_JOB}.Inprogress`} resourceLabel='Running' />
                                    <ProjectResourceCount iconName='status-negative' variantStyle='error' resourceKey={`${ResourceType.HPO_JOB}.Failed`} resourceLabel='Failed' />
                                    <ProjectResourceCount iconName='status-positive' variantStyle='success' resourceKey={`${ResourceType.HPO_JOB}.Completed`} resourceLabel='Completed' />
                                </ProjectResourceRow>

                                {applicationConfig.configuration.EnabledServices.labelingJob && <ProjectResourceRow label='Labeling job' path='jobs/labeling'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.LABELING_JOB}.Total`} resourceLabel='Total' />
                                    <ProjectResourceCount iconName='status-in-progress' variantStyle='success' resourceKey={`${ResourceType.LABELING_JOB}.Inprogress`} resourceLabel='Running' />
                                    <ProjectResourceCount iconName='status-negative' variantStyle='error' resourceKey={`${ResourceType.LABELING_JOB}.Failed`} resourceLabel='Failed' />
                                    <ProjectResourceCount iconName='status-positive' variantStyle='success' resourceKey={`${ResourceType.LABELING_JOB}.Completed`} resourceLabel='Completed' />
                                </ProjectResourceRow>}

                                <ProjectResourceRow label='Training job' path='jobs/training'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.TRAINING_JOB}.Total`} resourceLabel='Total' />
                                    <ProjectResourceCount iconName='status-in-progress' variantStyle='success' resourceKey={`${ResourceType.TRAINING_JOB}.Inprogress`} resourceLabel='Running' />
                                    <ProjectResourceCount iconName='status-negative' variantStyle='error' resourceKey={`${ResourceType.TRAINING_JOB}.Failed`} resourceLabel='Failed' />
                                    <ProjectResourceCount iconName='status-positive' variantStyle='success' resourceKey={`${ResourceType.TRAINING_JOB}.Completed`} resourceLabel='Completed' />
                                </ProjectResourceRow>

                                <ProjectResourceRow label='Transform job' path='jobs/transform'>
                                    <ProjectResourceCount iconName='add-plus' variantStyle='subtle' resourceKey={`${ResourceType.TRANSFORM_JOB}.Total`} resourceLabel='Total' />
                                    <ProjectResourceCount iconName='status-in-progress' variantStyle='success' resourceKey={`${ResourceType.TRANSFORM_JOB}.Inprogress`} resourceLabel='Running' />
                                    <ProjectResourceCount iconName='status-negative' variantStyle='error' resourceKey={`${ResourceType.TRANSFORM_JOB}.Failed`} resourceLabel='Failed' />
                                    <ProjectResourceCount iconName='status-positive' variantStyle='success' resourceKey={`${ResourceType.TRANSFORM_JOB}.Completed`} resourceLabel='Completed' />
                                </ProjectResourceRow>
                            </ColumnLayout>
                        )}
                    </SpaceBetween>
                </Container>
            </SpaceBetween>
        </ContentLayout>

    );
}

export default ProjectDetail;
