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
import {
    Container,
    SpaceBetween,
    Header,
    Box,
    ColumnLayout,
    Button,
    Alert,
    StatusIndicator,
} from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import { describeBatchTransformJob, loadingTransformJobDetails } from '../transform.reducer';
import { stopTransformJob } from '../transform.service';
import { useAppSelector, useAppDispatch } from '../../../../config/store';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { ITransform } from '../../../../shared/model/transform.model';
import { formatDate } from '../../../../shared/util/date-utils';
import { formatDisplayText } from '../../../../shared/util/form-utils';
import { JobStatus } from '../../job.model';
import { prettyStatus } from '../../../../shared/util/table-utils';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../../src/shared/doc';
import DetailsContainer from '../../../../modules/details-container';
import { LogsComponent } from '../../../../shared/util/log-utils';
import { useBackgroundRefresh, useNotificationService } from '../../../../shared/util/hooks';
import ContentLayout from '../../../../shared/layout/content-layout';

function TransformDetail () {
    const { projectName, name } = useParams();
    const transform: ITransform = useAppSelector((state) => state.jobs.transform.job);
    const loadingTransformDetails = useAppSelector(loadingTransformJobDetails);
    const [submitStop, setSubmitStop] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const notificationService = useNotificationService(dispatch);
    const basePath = projectName ? `#/project/${projectName}` : '#/personal';

    scrollToPageHeader();
    useEffect(() => {
        DocTitle('Batch Transform Job Details: ', transform?.TransformJobName);
    }, [transform]);

    useEffect(() => {
        dispatch(describeBatchTransformJob(name)).then(() => setInitialLoaded(true)).catch(() => {
            navigate('/404');
        });
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Batch Transform', href: `${basePath}/jobs/transform` },
                { text: `${name}`, href: `${basePath}/jobs/transform/${name}` },
            ])
        );
    }, [dispatch, navigate, basePath, name, projectName]);

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(async () => {
        await dispatch(describeBatchTransformJob(name));
    }, [dispatch, transform.TransformJobStatus], (transform.TransformJobStatus !== JobStatus.Failed && transform.TransformJobStatus !== JobStatus.Completed));

    const jobSummary = new Map<string, ReactNode>();
    jobSummary.set('Job name', transform.TransformJobName!);
    jobSummary.set('Status', prettyStatus(isBackgroundRefreshing ? 'Loading' : transform.TransformJobStatus, transform.FailureReason));
    jobSummary.set('Approx. batch transform duration', transform.duration);
    jobSummary.set('ARN', transform.TransformJobArn!);
    jobSummary.set('Creation time', formatDate(transform.CreationTime!));

    const jobConfig = new Map<string, ReactNode>();
    jobConfig.set('Model name', transform.ModelName!);
    jobConfig.set('Max concurrent transforms', transform.MaxConcurrentTransforms!);
    jobConfig.set('Max invocation retries', transform.ModelClientConfig?.InvocationsMaxRetries);
    jobConfig.set('Instance type', transform.TransformResources.InstanceType);
    jobConfig.set('Max payload size (MB)', transform.MaxPayloadInMB);
    jobConfig.set(
        'Invocation timeout in seconds',
        transform.ModelClientConfig?.InvocationsTimeoutInSeconds
    );
    jobConfig.set('Instance count', transform.TransformResources.InstanceCount);
    jobConfig.set('Batch strategy', transform.BatchStrategy);

    const inputDataConfig = new Map<string, ReactNode>();
    inputDataConfig.set(
        'S3 data type',
        transform.TransformInput?.DataSource?.S3DataSource?.S3DataType
    );
    inputDataConfig.set('Compression type', transform.TransformInput?.CompressionType);
    inputDataConfig.set('S3 URI', transform.TransformInput?.DataSource?.S3DataSource?.S3Uri);
    inputDataConfig.set('Split type', transform.TransformInput?.SplitType);
    inputDataConfig.set('Content type', transform.TransformInput?.ContentType);

    const outputDataConfig = new Map<string, ReactNode>();
    outputDataConfig.set('S3 output path', transform.TransformOutput?.S3OutputPath);
    outputDataConfig.set('Accept', transform.TransformOutput?.Accept);
    outputDataConfig.set('Assemble with', transform.TransformOutput?.AssembleWith);
    outputDataConfig.set('Output data encryption key', transform.TransformOutput?.KmsKeyId);

    const dataProcessingConfig = new Map<string, ReactNode>();
    dataProcessingConfig.set('Input data filter', transform.DataProcessing?.InputFilter);
    dataProcessingConfig.set('Output data filter', transform.DataProcessing?.OutputFilter);
    dataProcessingConfig.set('Join source to output', transform.DataProcessing?.JoinSource);

    return (
        <ContentLayout
            headerVariant='high-contrast' 
            header={
                <Header
                    variant='h1'
                    actions={
                        <Button
                            loading={submitStop}
                            disabled={transform.TransformJobStatus !== JobStatus.InProgress}
                            onClick={() => {
                                setSubmitStop(true);
                                stopTransformJob(transform.TransformJobName).then((response) => {
                                    if (response.status === 200) {
                                        notificationService.generateNotification(
                                            'Successfully stopped job.',
                                            'success'
                                        );
                                    } else {
                                        notificationService.generateNotification(
                                            'Failed to stop job.',
                                            'error'
                                        );
                                    }
                                    setSubmitStop(false);
                                    dispatch(describeBatchTransformJob(name));
                                });
                            }}
                        >
                            Stop
                        </Button>
                    }
                >
                    {name}
                </Header>
            }
        >
            {loadingTransformDetails && !initialLoaded ? (
                <Container>
                    <StatusIndicator type='loading'>Loading details</StatusIndicator>
                </Container>
            ) : (
                <SpaceBetween direction='vertical' size='s'>
                    <DetailsContainer
                        alert={
                            transform.FailureReason ? (
                                <Alert visible={true} type='error' header='Failure reason'>
                                    {transform.FailureReason}
                                </Alert>
                            ) : undefined
                        }
                        columns={3}
                        header='Job summary'
                        info={jobSummary}
                    />
                    <DetailsContainer columns={3} header='Job configuration' info={jobConfig} />
                    <DetailsContainer
                        columns={3}
                        header='Input data configuration'
                        info={inputDataConfig}
                    />
                    <DetailsContainer
                        columns={3}
                        header='Output data configuration'
                        info={outputDataConfig}
                    />
                    <DetailsContainer
                        columns={2}
                        header='Data processing configuration'
                        info={outputDataConfig}
                    />
                    <Container header={<Header variant='h3'>Environment variables</Header>}>
                        <ColumnLayout variant='text-grid' columns={2}>
                            <SpaceBetween direction='vertical' size='s'>
                                <div>
                                    <Box color='text-status-inactive'>Key</Box>
                                    {transform.Environment &&
                                        Object.keys(transform.Environment).map((key: string) => (
                                            <div key={key}>{formatDisplayText(key)}</div>
                                        ))}
                                </div>
                            </SpaceBetween>
                            <SpaceBetween direction='vertical' size='s'>
                                <div>
                                    <Box color='text-status-inactive'>Value</Box>
                                    {transform.Environment &&
                                        Object.keys(transform.Environment).map((key: string) => (
                                            <div key={key}>
                                                {formatDisplayText(transform.Environment[key])}
                                            </div>
                                        ))}
                                </div>
                            </SpaceBetween>
                        </ColumnLayout>
                    </Container>
                    <LogsComponent
                        resourceType='job'
                        resourceName={name!}
                        jobType='TransformJobs'
                        resourceCreationTime={transform.CreationTime}
                    />
                </SpaceBetween>
            )}
        </ContentLayout>
    );
}

export default TransformDetail;
