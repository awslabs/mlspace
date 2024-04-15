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
    Button,
    ColumnLayout,
    Container,
    ContentLayout,
    Grid,
    Header,
    SpaceBetween,
    StatusIndicator,
    Tabs,
} from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams} from 'react-router-dom';
import { formatDate, formatDateDiff } from '../../../../shared/util/date-utils';
import { useAppDispatch, useAppSelector } from '../../../../config/store';
import Condition from '../../../../modules/condition';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { formatDisplayText } from '../../../../shared/util/form-utils';
import { JobStatus } from '../../job.model';
import { describeHPOJobChildren, loadingHPOJob, stopHPOJob } from '../hpo-job.reducer';
import { describeHPOJob } from '../hpo-job.reducer';
import { TrainingJobsTab } from './training-jobs-tab';
import { TuningJobConfiguration } from './tuning-job-configuration';
import { TrainingJobDefinitions } from './training-job-definitions';
import { BestTrainingJob } from './best-training-job';
import { describeTrainingJob } from '../../training/training-job.reducer';
import { prettyStatus } from '../../../../shared/util/table-utils';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../../src/shared/doc';
import NotificationService from '../../../../shared/layout/notification/notification.service';
import { useBackgroundRefresh } from '../../../../shared/util/hooks';

export function HPOJobDetail () {
    const { projectName, jobName } = useParams();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const HPOJobDetailsLoading = useAppSelector(loadingHPOJob);
    const notificationService = NotificationService(dispatch);

    scrollToPageHeader();
    DocTitle('HPO Job Details: ', jobName);

    const [state, setState] = useState({
        activeTabId: '2',
        trainingJobs: [] as any[],
        hpoTrainingJob: null as any,
        bestTrainingJob: null as any,
        job: null as any,
    });

    const loadAll = useCallback(async () => {
        const hpoTrainingJob = await dispatch(describeHPOJob(jobName!))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
        const trainingJobs = await dispatch(describeHPOJobChildren(jobName!)).then(
            (response) => response.payload
        );
        if (hpoTrainingJob.BestTrainingJob !== undefined) {
            const bestTrainingJob = await dispatch(
                describeTrainingJob(hpoTrainingJob.BestTrainingJob.TrainingJobName)
            ).then((response) => response.payload);
            setState((s) => ({
                ...s,
                hpoTrainingJob,
                trainingJobs,
                bestTrainingJob,
            }));
        } else {
            setState((s) => ({ ...s, hpoTrainingJob, trainingJobs }));
        }
    }, [dispatch, jobName, navigate]);

    useEffect(() => {
        loadAll();
    }, [dispatch, navigate, jobName, loadAll]);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'HPO Jobs',
                    href: `#/project/${projectName}/jobs/hpo`,
                },
                {
                    text: jobName!,
                    href: '',
                },
            ])
        );
    }, [dispatch, jobName, projectName]);

    const trainingJobDefinitions: any = [];
    if (state.hpoTrainingJob?.TrainingJobDefinitions !== undefined) {
        trainingJobDefinitions.push(...state.hpoTrainingJob.TrainingJobDefinitions);
    } else if (state.hpoTrainingJob?.TrainingJobDefinition !== undefined) {
        trainingJobDefinitions.push(state.hpoTrainingJob.TrainingJobDefinition);
    }

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(() => {
        loadAll();
    }, [dispatch], (state.hpoTrainingJob?.HyperParameterTuningJobStatus !== JobStatus.Failed && state.hpoTrainingJob?.HyperParameterTuningJobStatus !== JobStatus.Completed));

    return (
        <ContentLayout header={<Header variant='h1'>{jobName}</Header>}>
            {HPOJobDetailsLoading && !isBackgroundRefreshing ? (
                <Container>
                    <StatusIndicator type='loading'>Loading details</StatusIndicator>
                </Container>
            ) : (
                <SpaceBetween direction='vertical' size='s'>
                    <Container
                        header={
                            <div>
                                <Grid gridDefinition={[{ colspan: { default: 12, s: 5 } }, { colspan: { default: 12, s: 7 } }]}>
                                    <Header>Hyperparameter tuning job summary</Header>
                                    <div style={{ float: 'right', display: '' }}>
                                        <SpaceBetween direction='horizontal' size='m'>
                                            <Button
                                                variant='normal'
                                                onClick={() => {
                                                    navigate(`/project/${projectName}/jobs/hpo`);
                                                }}
                                            >
                                                Back to HPO jobs
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    navigate(
                                                        `/project/${projectName}/jobs/hpo/create`,
                                                        {
                                                            state: state,
                                                        }
                                                    );
                                                }}
                                            >
                                                Clone HPO job
                                            </Button>

                                            <Button
                                                variant='primary'
                                                disabled={
                                                    state.hpoTrainingJob
                                                        ?.HyperParameterTuningJobStatus !==
                                                    JobStatus.InProgress
                                                }
                                                onClick={() => {
                                                    setState({
                                                        ...state,
                                                        job: {
                                                            ...state.hpoTrainingJob,
                                                            HyperParameterTuningJobStatus:
                                                                JobStatus.Stopping,
                                                        },
                                                    });
                                                    dispatch(
                                                        stopHPOJob({
                                                            jobName: jobName!,
                                                            projectName: projectName!,
                                                        })
                                                    ).then((result: any) => {
                                                        if (result.type.endsWith('/fulfilled')) {
                                                            notificationService.generateNotification(
                                                                `Successfully stopped hyperparameter tuning job with name ${jobName!}`,
                                                                'success'
                                                            );
                                                        } else {
                                                            notificationService.generateNotification(
                                                                `Failed to stop hyperparameter tuning job: ${
                                                                    result.payload?.reason ||
                                                                    'Unknown error'
                                                                }`,
                                                                'error'
                                                            );
                                                        }
                                                        dispatch(describeHPOJob(jobName!)).then(
                                                            (job) =>
                                                                setState({
                                                                    ...state,
                                                                    job: job.payload,
                                                                })
                                                        );
                                                    });
                                                }}
                                            >
                                                Stop tuning job
                                            </Button>
                                        </SpaceBetween>
                                    </div>
                                </Grid>
                            </div>
                        }
                    >
                        <SpaceBetween direction='vertical' size='m'>
                            <Condition
                                condition={
                                    state.hpoTrainingJob?.HyperParameterTuningJobStatus ===
                                    JobStatus.Failed
                                }
                            >
                                <Alert header={'Failure reason'} type='error'>
                                    {state.hpoTrainingJob?.FailureReason}
                                </Alert>
                            </Condition>

                            <ColumnLayout columns={3}>
                                <SpaceBetween direction='vertical' size='xxl'>
                                    <div>
                                        <Box color='text-status-inactive'>Name</Box>
                                        {formatDisplayText(
                                            state.hpoTrainingJob?.HyperParameterTuningJobName
                                        )}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>ARN</Box>
                                        {formatDisplayText(
                                            state.hpoTrainingJob?.HyperParameterTuningJobArn
                                        )}
                                    </div>
                                </SpaceBetween>

                                <SpaceBetween direction='vertical' size='l'>
                                    <div>
                                        <Box color='text-status-inactive'>Status</Box>
                                        {prettyStatus(
                                            state.hpoTrainingJob?.HyperParameterTuningJobStatus,
                                            state.hpoTrainingJob?.FailureReason
                                        )}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>Creation time</Box>
                                        {formatDate(state.hpoTrainingJob?.CreationTime)}
                                    </div>

                                    <div>
                                        <Box color='text-status-inactive'>Last modified time</Box>
                                        {formatDate(state.hpoTrainingJob?.LastModifiedTime)}
                                    </div>
                                </SpaceBetween>

                                <SpaceBetween direction='vertical' size='l'>
                                    <div>
                                        <Box color='text-status-inactive'>
                                            Approx. total training duration
                                        </Box>
                                        {formatDateDiff(
                                            state.hpoTrainingJob?.CreationTime,
                                            state.hpoTrainingJob?.LastModifiedTime
                                        )}
                                    </div>
                                </SpaceBetween>
                            </ColumnLayout>
                        </SpaceBetween>
                    </Container>

                    <Tabs
                        tabs={[
                            {
                                label: 'Best training job',
                                id: '1',
                                content: <BestTrainingJob hpoTrainingJob={state.hpoTrainingJob} />,
                            },
                            {
                                label: 'Training jobs',
                                id: '2',
                                content: (
                                    <TrainingJobsTab job={state.hpoTrainingJob}>
                                        {state.trainingJobs}
                                    </TrainingJobsTab>
                                ),
                            },
                            {
                                label: 'Training job definitions',
                                id: '3',
                                content: (
                                    <TrainingJobDefinitions
                                        hpoTrainingJob={state.hpoTrainingJob}
                                        trainingJobDefinitions={trainingJobDefinitions}
                                    />
                                ),
                            },
                            {
                                label: 'Tuning job configuration',
                                id: '4',
                                content: <TuningJobConfiguration job={state.hpoTrainingJob} />,
                            },
                        ]}
                        onChange={(e) => setState({ ...state, activeTabId: e.detail.activeTabId })}
                        activeTabId={state.activeTabId}
                        i18nStrings={{
                            scrollLeftAriaLabel: 'Scroll left',
                            scrollRightAriaLabel: 'Scroll right',
                        }}
                    />
                </SpaceBetween>
            )}
        </ContentLayout>
    );
}
