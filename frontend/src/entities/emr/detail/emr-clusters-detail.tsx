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

import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import React, { ReactNode, useEffect, useState } from 'react';
import { SpaceBetween, Header, Button } from '@cloudscape-design/components';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import DetailsContainer from '../../../modules/details-container';
import { formatDate, formatTerminationTimestamp } from '../../../shared/util/date-utils';
import { getEMRCluster, loadingCluster, selectedEMRCluster } from '../emr.reducer';
import { EMRCluster } from '../emr.model';
import { prettyStatus } from '../../../shared/util/table-utils';
import { IProject } from '../../../shared/model/project.model';
import { modifyResourceTerminationSchedule } from '../../../shared/util/resource-schedule.service';
import { setResourceScheduleModal } from '../../../modules/modal/modal.reducer';
import { hasPermission } from '../../../shared/util/permission-utils';
import { Permission } from '../../../shared/model/user.model';
import { selectCurrentUser } from '../../user/user.reducer';
import { useBackgroundRefresh } from '../../../shared/util/hooks';
import ContentLayout from '../../../shared/layout/content-layout';

function EMRDetail () {
    const { projectName, clusterId, clusterName } = useParams();
    const basePath = `/project/${projectName}`;
    const dispatch = useAppDispatch();
    const currentUser = useAppSelector(selectCurrentUser);
    const project: IProject = useAppSelector((state) => state.project.project);
    const projectPermissions = useAppSelector((state) => state.project.permissions);
    const cluster: EMRCluster = useAppSelector(selectedEMRCluster);
    const clusterLoading = useAppSelector(loadingCluster);

    const [initialLoaded, setInitialLoaded] = useState(false);

    scrollToPageHeader();
    DocTitle('EMR Details: ', clusterId);

    useEffect(() => {
        if (clusterId) {
            dispatch(getEMRCluster(clusterId)).then(() => setInitialLoaded(true));
            dispatch(
                setBreadcrumbs([
                    getBase(projectName),
                    { text: 'Elastic Map Reduce', href: `#${basePath}/emr` },
                    {
                        text: `${clusterName}`,
                        href: `#${basePath}/emr/${clusterId}/${clusterName}`,
                    },
                ])
            );
        }
    }, [dispatch, basePath, projectName, clusterId, clusterName]);

    // Refresh data in the background to keep state fresh. While waiting for the EMR cluster to be ready, refresh every 3 seconds
    const isBackgroundRefreshing = useBackgroundRefresh(async () => {
        await dispatch(getEMRCluster(clusterId!));
    }, [dispatch], true, clusterLoading ? 3 : window.env.BACKGROUND_REFRESH_INTERVAL);

    const clusterSummary = new Map<string, ReactNode>();
    clusterSummary.set('Cluster ID', cluster?.Id);
    clusterSummary.set('Master DNS name', cluster?.MasterPublicDnsName);
    clusterSummary.set('State', prettyStatus(isBackgroundRefreshing ? 'Loading' : cluster?.Status?.State));
    clusterSummary.set('Creation time', formatDate(cluster?.Status?.Timeline?.CreationDateTime));
    clusterSummary.set('Ready time', formatDate(cluster?.Status?.Timeline?.ReadyDateTime));
    clusterSummary.set('Release label', cluster?.ReleaseLabel);
    clusterSummary.set('Subnet', cluster?.Ec2InstanceAttributes?.Ec2SubnetId);

    if (project.metadata?.terminationConfiguration?.defaultEMRClusterTTL) {
        clusterSummary.set(
            'Auto termination time',
            <>
                {cluster.TerminationTime
                    ? formatTerminationTimestamp(cluster.TerminationTime)
                    : 'Disabled'}
                {(hasPermission(Permission.PROJECT_OWNER, projectPermissions) ||
                    hasPermission(Permission.ADMIN, currentUser.permissions) ||
                    (project.metadata?.terminationConfiguration?.allowEMROwnerOverride &&
                        cluster.Owner === currentUser.username)) && (
                    <Button
                        iconName='edit'
                        variant='inline-icon'
                        onClick={() =>
                            dispatch(
                                setResourceScheduleModal({
                                    timezone: currentUser.preferences?.timezone,
                                    resourceType: 'EMR Cluster',
                                    resourceName: cluster.Name!,
                                    resourceTerminationTime: cluster.TerminationTime,
                                    onConfirm: (updatedTerminationTime?: Date) =>
                                        modifyResourceTerminationSchedule(
                                            'emr',
                                            cluster.Id!,
                                            updatedTerminationTime
                                        ),
                                    postConfirm: () => dispatch(getEMRCluster(cluster.Id!)),
                                })
                            )
                        }
                        ariaLabel='Edit resource auto termination schedule'
                    />
                )}
            </>
        );
    }

    return (
        cluster && (
            <ContentLayout
                header={
                    <Header variant='h1'>
                        {' '}
                        Cluster: {cluster.Name} ({clusterId}){' '}
                    </Header>
                }
            >
                <SpaceBetween size='xxl'>
                    <DetailsContainer
                        loading={clusterLoading || !initialLoaded}
                        columns={4}
                        header='Summary'
                        info={clusterSummary}
                    />
                </SpaceBetween>
            </ContentLayout>
        )
    );
}

export default EMRDetail;
