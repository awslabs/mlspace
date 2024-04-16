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

import React, { ReactNode, useEffect } from 'react';
import {
    ContentLayout,
    SpaceBetween,
    Header,
    Container,
    Alert,
    StatusIndicator,
    Button,
} from '@cloudscape-design/components';
import DetailsContainer from '../../../modules/details-container';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { useNavigate, useParams } from 'react-router-dom';
import Condition from '../../../modules/condition';
import { IEndpoint } from '../../../shared/model/endpoint.model';
import { getEndpoint } from '../endpoint.reducer';
import {
    DataCaptureSettings,
    EndpointConfigDetailsView,
} from '../../endpoint-config/common-components';
import { IEndpointConfig } from '../../../shared/model/endpoint-config.model';
import { formatDate, formatTerminationTimestamp } from '../../../shared/util/date-utils';
import { prettyStatus } from '../../../shared/util/table-utils';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { LogsComponent } from '../../../shared/util/log-utils';
import { IProject } from '../../../shared/model/project.model';
import { Permission } from '../../../shared/model/user.model';
import { hasPermission } from '../../../shared/util/permission-utils';
import { selectCurrentUser } from '../../user/user.reducer';
import { setResourceScheduleModal } from '../../../modules/modal/modal.reducer';
import { modifyResourceTerminationSchedule } from '../../../shared/util/resource-schedule.service';
import { useBackgroundRefresh } from '../../../shared/util/hooks';

function EndpointDetail () {
    const { projectName, name } = useParams();
    const project: IProject = useAppSelector((state) => state.project.project);
    const endpoint: IEndpoint = useAppSelector((state) => state.endpoint.entity);
    const endpointConfig: IEndpointConfig = useAppSelector(
        (state) => state.endpoint.endpointConfig
    );
    const endpointDetailsLoading = useAppSelector((state) => state.endpoint.loading);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const currentUser = useAppSelector(selectCurrentUser);
    const projectPermissions = useAppSelector((state) => state.project.permissions);

    scrollToPageHeader();
    DocTitle('Endpoint Details: ', endpoint.EndpointName);

    useEffect(() => {
        dispatch(getEndpoint(name!))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'Endpoints',
                    href: `#/project/${projectName}/endpoint`,
                },
                {
                    text: name!,
                    href: `#/project/${projectName}/endpoint/${name}`,
                },
            ])
        );
    }, [dispatch, navigate, name, projectName]);

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(() => {
        dispatch(getEndpoint(name!));
    }, [dispatch]);

    const endpointSettings = new Map<string, ReactNode>();
    endpointSettings.set('Name', endpoint.EndpointName!);
    endpointSettings.set('Status', prettyStatus(endpoint.EndpointStatus, endpoint.FailureReason));
    endpointSettings.set('Type', 'Real-time');
    endpointSettings.set('ARN', endpoint.EndpointArn!);
    endpointSettings.set('Creation time', formatDate(endpoint.CreationTime!));
    // When support is added for async inference this will need to be updated
    endpointSettings.set('Last updated', formatDate(endpoint.LastModifiedTime!));

    if (project.metadata?.terminationConfiguration?.defaultEndpointTTL) {
        endpointSettings.set(
            'Auto-termination time',
            <>
                {endpoint.TerminationTime
                    ? formatTerminationTimestamp(endpoint.TerminationTime)
                    : 'Disabled'}
                {(hasPermission(Permission.PROJECT_OWNER, projectPermissions) ||
                    hasPermission(Permission.ADMIN, currentUser.permissions) ||
                    (project.metadata?.terminationConfiguration?.allowNotebookOwnerOverride &&
                        endpoint.Owner === currentUser.username)) && (
                    <Button
                        iconName='edit'
                        variant='inline-icon'
                        onClick={() =>
                            dispatch(
                                setResourceScheduleModal({
                                    timezone: currentUser.preferences?.timezone,
                                    resourceType: 'SageMaker Endpoint',
                                    resourceName: endpoint.EndpointName!,
                                    resourceTerminationTime: endpoint.TerminationTime,
                                    onConfirm: (updatedTerminationTime?: Date) =>
                                        modifyResourceTerminationSchedule(
                                            'endpoint',
                                            endpoint.EndpointName!,
                                            updatedTerminationTime
                                        ),
                                    postConfirm: () =>
                                        dispatch(getEndpoint(endpoint.EndpointName!)),
                                })
                            )
                        }
                        ariaLabel='Edit resource auto-termination schedule'
                    />
                )}
            </>
        );
    }

    return (
        <Condition condition={endpoint !== undefined}>
            <ContentLayout header={<Header variant='h1'>{name}</Header>}>
                {endpointDetailsLoading && !isBackgroundRefreshing ? (
                    <Container>
                        <StatusIndicator type='loading'>Loading details</StatusIndicator>
                    </Container>
                ) : (
                    <SpaceBetween size='l'>
                        <DetailsContainer
                            alert={
                                endpoint.FailureReason ? (
                                    <Alert type='error' header='Failure reason'>
                                        {endpoint.FailureReason}
                                    </Alert>
                                ) : undefined
                            }
                            columns={3}
                            header='Endpoint settings'
                            info={endpointSettings}
                        />
                        <DataCaptureSettings
                            endpointCaptureConfig={endpoint.DataCaptureConfig || {}}
                        />
                        <Container
                            header={<Header variant='h2'>Endpoint configuration settings</Header>}
                        >
                            <EndpointConfigDetailsView
                                endpointConfig={endpointConfig}
                                variant='embedded'
                            />
                        </Container>
                        <LogsComponent
                            resourceType='Endpoints'
                            resourceName={name!}
                            resourceCreationTime={endpoint.CreationTime}
                        />
                    </SpaceBetween>
                )}
            </ContentLayout>
        </Condition>
    );
}

export default EndpointDetail;
