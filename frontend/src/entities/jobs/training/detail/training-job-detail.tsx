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
    Box,
    ColumnLayout,
    Container,
    SpaceBetween,
    Header,
    Button,
    ContentLayout,
    Table,
    StatusIndicator,
    Link,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../../config/store';
import Condition from '../../../../modules/condition';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { ITrainingJob } from '../training-job.model';
import { JobStatus } from '../../job.model';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import { prettyStatus } from '../../../../shared/util/table-utils';
import {
    describeTrainingJob,
    loadingTrainingJobDetails,
    selectTrainingJob,
} from '../training-job.reducer';
import { formatDate } from '../../../../shared/util/date-utils';
import { formatDisplayNumber, formatDisplayText } from '../../../../shared/util/form-utils';
import { InputDataConfig } from '../../hpo/hpo-job.model';
import { DocTitle, scrollToPageHeader } from '../../../../../src/shared/doc';
import { LogsComponent } from '../../../../shared/util/log-utils';
import { createModelFromTrainingJob } from '../training-job.actions';
import { useBackgroundRefresh } from '../../../../shared/util/hooks';

export function TrainingJobDetail () {
    const { projectName, trainingJobName } = useParams();
    const trainingJob: ITrainingJob = useAppSelector(selectTrainingJob);
    const loadingJobDetails = useAppSelector(loadingTrainingJobDetails);
    const [initialLoaded, setInitialLoaded] = useState(false);

    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    scrollToPageHeader();
    DocTitle('Training Job Details: ', trainingJobName);

    useEffect(() => {
        dispatch(describeTrainingJob(String(trainingJobName)))
            .unwrap()
            .then(() => setInitialLoaded(true))
            .catch(() => {
                navigate('/404');
            });
    }, [dispatch, navigate, trainingJobName]);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Training Jobs', href: `#/project/${projectName}/jobs/training` },
                {
                    text: `${trainingJobName}`,
                    href: `#/project/${projectName}/jobs/training/detail/${trainingJobName}`,
                },
            ])
        );
    }, [dispatch, projectName, trainingJobName]);

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(async () => {
        await dispatch(describeTrainingJob(String(trainingJobName)));
    }, [dispatch, trainingJob.TrainingJobStatus], (trainingJob.TrainingJobStatus !== JobStatus.Failed && trainingJob.TrainingJobStatus !== JobStatus.Completed));

    return (
        <ContentLayout header={<Header variant='h1'>{trainingJobName}</Header>}>
            {loadingJobDetails && !initialLoaded ? (
                <Container>
                    <StatusIndicator type='loading'>Loading details</StatusIndicator>
                </Container>
            ) : (
                <SpaceBetween direction='vertical' size='s'>
                    <Container
                        header={
                            <Header
                                actions={
                                    <SpaceBetween direction='horizontal' size='xs'>
                                        <Button
                                            onClick={() =>
                                                navigate(`/project/${projectName}/jobs/training`)
                                            }
                                        >
                                            Back to Training Jobs
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                navigate(
                                                    `/project/${projectName}/jobs/training/create`,
                                                    {
                                                        state: {
                                                            trainingJob: trainingJob,
                                                        },
                                                    }
                                                );
                                            }}
                                        >
                                            Clone training job
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                createModelFromTrainingJob(trainingJob, navigate, projectName);
                                            }}
                                            disabled={
                                                trainingJob.TrainingJobStatus !==
                                                JobStatus.Completed
                                            }
                                            variant='primary'
                                        >
                                            Create model
                                        </Button>
                                    </SpaceBetween>
                                }
                            >
                                Training job details
                            </Header>
                        }
                    >
                        <SpaceBetween direction='vertical' size='xxl'>
                            <Condition
                                condition={trainingJob.TrainingJobStatus === JobStatus.Failed}
                            >
                                <Alert header={'Failure reason'} type='error'>
                                    {trainingJob.FailureReason}
                                </Alert>
                            </Condition>

                            <ColumnLayout columns={2} variant={'text-grid'}>
                                <SpaceBetween direction='vertical' size='xxl'>
                                    <div>
                                        <Box color='text-status-inactive'>Job name</Box>
                                        {formatDisplayText(trainingJob.TrainingJobName)}
                                    </div>

                                    <div>
                                        <Box key={1} color='text-status-inactive'>
                                            Status
                                        </Box>
                                        {prettyStatus(isBackgroundRefreshing ? 'Loading' :
                                            trainingJob.TrainingJobStatus,
                                        trainingJob.FailureReason
                                        )}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>Creation time</Box>
                                        {formatDate(trainingJob.CreationTime)}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>Last modified time</Box>
                                        {formatDate(trainingJob.LastModifiedTime)}
                                    </div>
                                </SpaceBetween>

                                <div>
                                    <SpaceBetween direction='vertical' size='xxl'>
                                        <div>
                                            <Box color='text-status-inactive'>
                                                Training time (seconds)
                                            </Box>
                                            {formatDisplayNumber(trainingJob.TrainingTimeInSeconds)}
                                        </div>

                                        <div>
                                            <Box color='text-status-inactive'>
                                                Billable time (seconds)
                                            </Box>
                                            {formatDisplayNumber(trainingJob.BillableTimeInSeconds)}
                                        </div>
                                        <div>
                                            <Box color='text-status-inactive'>
                                                Associated project
                                            </Box>
                                            {formatDisplayText(projectName)}
                                        </div>
                                        <div>
                                            <Box color='text-status-inactive'>
                                                Tuning job source/parent
                                            </Box>
                                            <Link
                                                href={`#/project/${projectName}/jobs/hpo/detail/${trainingJob.TuningJobName}`}
                                            >
                                                {trainingJob.TuningJobName ? trainingJob.TuningJobName : '-'}
                                            </Link>

                                        </div>
                                    </SpaceBetween>
                                </div>
                            </ColumnLayout>
                        </SpaceBetween>
                    </Container>

                    <Container header={<Header>Algorithm</Header>}>
                        <ColumnLayout columns={2} variant={'text-grid'}>
                            <div>
                                <SpaceBetween direction='vertical' size='xxl'>
                                    <div>
                                        <Box color='text-status-inactive'>Training image</Box>
                                        {formatDisplayText(
                                            trainingJob.AlgorithmSpecification?.TrainingImage
                                        )}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>Input mode</Box>
                                        {formatDisplayText(
                                            trainingJob.AlgorithmSpecification?.TrainingInputMode
                                        )}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>Instance count</Box>
                                        {formatDisplayNumber(
                                            trainingJob.ResourceConfig?.InstanceCount
                                        )}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>Instance type</Box>
                                        {formatDisplayText(
                                            trainingJob.ResourceConfig?.InstanceType
                                        )}
                                    </div>
                                </SpaceBetween>
                            </div>

                            <div>
                                <SpaceBetween direction='vertical' size='xxl'>
                                    <div>
                                        <Box color='text-status-inactive'>
                                            Additional volume size (GB)
                                        </Box>
                                        {formatDisplayNumber(
                                            trainingJob.ResourceConfig?.VolumeSizeInGB
                                        )}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>
                                            Maximum runtime (seconds)
                                        </Box>
                                        {formatDisplayNumber(
                                            trainingJob.StoppingCondition?.MaxRuntimeInSeconds
                                        )}
                                    </div>
                                </SpaceBetween>
                            </div>
                        </ColumnLayout>
                    </Container>

                    <Condition condition={trainingJob !== undefined}>
                        <SpaceBetween direction='vertical' size='s'>
                            {trainingJob.InputDataConfig?.map(
                                (inputDataConfig: InputDataConfig, index) => {
                                    return (
                                        <Container
                                            key={index}
                                            header={
                                                <Header>
                                                    Input data configuration:{' '}
                                                    {formatDisplayText(inputDataConfig.ChannelName)}
                                                </Header>
                                            }
                                        >
                                            <ColumnLayout columns={2} variant={'text-grid'}>
                                                <div>
                                                    <SpaceBetween direction='vertical' size='xxl'>
                                                        <div>
                                                            <Box color='text-status-inactive'>
                                                                Content type
                                                            </Box>
                                                            {formatDisplayText(
                                                                inputDataConfig.ContentType
                                                            )}
                                                        </div>

                                                        <div>
                                                            <Box color='text-status-inactive'>
                                                                Compression type
                                                            </Box>
                                                            {formatDisplayText(
                                                                inputDataConfig.CompressionType
                                                            )}
                                                        </div>

                                                        <div>
                                                            <Box color='text-status-inactive'>
                                                                Record wrapper type
                                                            </Box>
                                                            {formatDisplayText(
                                                                inputDataConfig.RecordWrapperType
                                                            )}
                                                        </div>
                                                    </SpaceBetween>
                                                </div>

                                                <div>
                                                    <SpaceBetween direction='vertical' size='xxl'>
                                                        <div>
                                                            <Box color='text-status-inactive'>
                                                                Data source
                                                            </Box>
                                                            S3
                                                        </div>

                                                        <div>
                                                            <Box color='text-status-inactive'>
                                                                Source type
                                                            </Box>
                                                            {formatDisplayText(
                                                                inputDataConfig.DataSource
                                                                    .S3DataSource?.S3DataType
                                                            )}
                                                        </div>

                                                        <div>
                                                            <Box color='text-status-inactive'>
                                                                Data distribution type
                                                            </Box>
                                                            {formatDisplayText(
                                                                inputDataConfig.DataSource
                                                                    .S3DataSource
                                                                    ?.S3DataDistributionType
                                                            )}
                                                        </div>

                                                        <div>
                                                            <Box color='text-status-inactive'>
                                                                Source URI
                                                            </Box>
                                                            {formatDisplayText(
                                                                inputDataConfig.DataSource
                                                                    .S3DataSource?.S3Uri
                                                            )}
                                                        </div>
                                                    </SpaceBetween>
                                                </div>
                                            </ColumnLayout>
                                        </Container>
                                    );
                                }
                            )}
                        </SpaceBetween>
                    </Condition>

                    <Container header={<Header>Metrics</Header>}>
                        <Table
                            ariaLabels={{
                                tableLabel: 'Metrics table',
                            }}
                            variant='embedded'
                            items={
                                trainingJob.AlgorithmSpecification?.MetricDefinitions?.map(
                                    (value) => {
                                        const { Name, Regex } = value;

                                        return { Name, Regex };
                                    }
                                ) || []
                            }
                            columnDefinitions={[
                                {
                                    header: 'Key',
                                    cell (item) {
                                        return <Box color='text-status-inactive'>{item.Name}</Box>;
                                    },
                                },
                                {
                                    header: 'Value',
                                    cell (item) {
                                        return item.Regex;
                                    },
                                },
                            ]}
                        />
                    </Container>

                    <Container header={<Header>Output data configuration</Header>}>
                        <ColumnLayout columns={2} variant={'text-grid'}>
                            <div>
                                <SpaceBetween direction='vertical' size='xxl'>
                                    <div>
                                        <Box color='text-status-inactive'>S3 output path</Box>
                                        {trainingJob.OutputDataConfig?.S3OutputPath}
                                    </div>
                                </SpaceBetween>
                            </div>
                        </ColumnLayout>
                    </Container>

                    <Container header={<Header>Hyperparameters</Header>}>
                        <Table
                            ariaLabels={{
                                tableLabel: 'Hyperparameters table',
                            }}
                            variant='embedded'
                            items={Object.entries(trainingJob.HyperParameters || {}).map(
                                (entry) => {
                                    return {
                                        Key: entry[0],
                                        Value: entry[1],
                                    };
                                }
                            )}
                            columnDefinitions={[
                                {
                                    header: 'Key',
                                    cell (item) {
                                        return <Box color='text-status-inactive'>{item.Key}</Box>;
                                    },
                                },
                                {
                                    header: 'Value',
                                    cell (item) {
                                        return item.Value;
                                    },
                                },
                            ]}
                        />
                    </Container>

                    <Container header={<Header>Output</Header>}>
                        <ColumnLayout columns={2} variant={'text-grid'}>
                            <div>
                                <SpaceBetween direction='vertical' size='xxl'>
                                    <div>
                                        <Box color='text-status-inactive'>S3 Model Artifact</Box>
                                        {formatDisplayText(
                                            trainingJob.ModelArtifacts?.S3ModelArtifacts
                                        )}
                                    </div>
                                </SpaceBetween>
                            </div>
                        </ColumnLayout>
                    </Container>
                    <LogsComponent
                        resourceType='job'
                        resourceName={trainingJobName!}
                        jobType='TrainingJobs'
                        resourceCreationTime={trainingJob.CreationTime}
                    />
                </SpaceBetween>
            )}
        </ContentLayout>
    );
}

export default TrainingJobDetail;
