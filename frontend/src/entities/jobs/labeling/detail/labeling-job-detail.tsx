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

import {
    Alert,
    Container,
    SpaceBetween,
    Header,
    Button,
    ContentLayout,
    StatusIndicator,
} from '@cloudscape-design/components';
import React, { useEffect, ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../config/store';
import {
    describeLabelingJob,
    loadingLabelingJobDetails,
    selectLabelingJob,
} from '../labeling-job.reducer';
import { useNavigate, useParams } from 'react-router-dom';
import { DocTitle, scrollToPageHeader } from '../../../../shared/doc';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import { LogsComponent } from '../../../../shared/util/log-utils';
import { ILabelingJob } from '../labeling-job.model';
import { prettyStatus } from '../../../../shared/util/table-utils';
import { formatDate } from '../../../../shared/util/date-utils';
import { getLabelingJobType, getTotalLabelingObjectCount } from '../labeling-job.common';
import DetailsContainer from '../../../../modules/details-container';
import { useBackgroundRefresh } from '../../../../shared/util/hooks';
import { JobStatus } from '../../job.model';

export function LabelingJobDetail () {
    const { projectName, jobName } = useParams();
    const labelingJob: ILabelingJob = useAppSelector(selectLabelingJob);
    const loadingJobDetails = useAppSelector(loadingLabelingJobDetails);

    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    scrollToPageHeader();
    DocTitle('Labeling Job Details: ', jobName);

    useEffect(() => {
        dispatch(describeLabelingJob(String(jobName)))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
    }, [dispatch, navigate, jobName]);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Labeling jobs', href: `#/project/${projectName}/jobs/labeling` },
                {
                    text: `${jobName}`,
                    href: `#/project/${projectName}/jobs/labeling/detail/${jobName}`,
                },
            ])
        );
    }, [dispatch, projectName, jobName]);

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(() => {
        dispatch(describeLabelingJob(String(jobName)));
    }, [dispatch, labelingJob.LabelingJobStatus], (labelingJob.LabelingJobStatus !== JobStatus.Failed && labelingJob.LabelingJobStatus !== JobStatus.Completed));

    const labelingJobSettings = new Map<string, ReactNode>();
    labelingJobSettings.set('Job name', labelingJob.LabelingJobName);
    labelingJobSettings.set(
        'Status',
        prettyStatus(labelingJob.LabelingJobStatus, labelingJob.FailureReason)
    );
    labelingJobSettings.set('Creation time', formatDate(labelingJob.CreationTime));
    labelingJobSettings.set(
        'Labeled / total dataset objects',
        `${labelingJob.LabelCounters?.TotalLabeled} / ${getTotalLabelingObjectCount(labelingJob)}`
    );
    labelingJobSettings.set(
        'Input dataset location',
        labelingJob.InputConfig?.DataSource.S3DataSource.ManifestS3Uri
    );
    labelingJobSettings.set('Last modified time', formatDate(labelingJob.LastModifiedTime));
    labelingJobSettings.set('ARN', labelingJob.LabelingJobArn);
    labelingJobSettings.set('Output dataset location', labelingJob.OutputConfig?.S3OutputPath);
    labelingJobSettings.set('Workteam ARN', labelingJob.HumanTaskConfig?.WorkteamArn);
    labelingJobSettings.set('Task type', getLabelingJobType(labelingJob));

    return (
        <ContentLayout header={<Header variant='h1'>{jobName}</Header>}>
            {loadingJobDetails && !isBackgroundRefreshing ? (
                <Container>
                    <StatusIndicator type='loading'>Loading details</StatusIndicator>
                </Container>
            ) : (
                <SpaceBetween direction='vertical' size='xxl'>
                    <DetailsContainer
                        alert={
                            labelingJob.FailureReason ? (
                                <Alert type='error' header='Failure reason'>
                                    {labelingJob.FailureReason}
                                </Alert>
                            ) : undefined
                        }
                        columns={3}
                        header='Labeling job details'
                        actions={
                            <SpaceBetween direction='horizontal' size='xs'>
                                <Button
                                    onClick={() =>
                                        navigate(`/project/${projectName}/jobs/labeling`)
                                    }
                                >
                                    Back to Labeling Jobs
                                </Button>
                            </SpaceBetween>
                        }
                        info={labelingJobSettings}
                    />

                    <LogsComponent
                        resourceType='job'
                        resourceName={jobName!}
                        jobType='LabelingJobs'
                        resourceCreationTime={labelingJob.CreationTime}
                    />
                </SpaceBetween>
            )}
        </ContentLayout>
    );
}

export default LabelingJobDetail;
