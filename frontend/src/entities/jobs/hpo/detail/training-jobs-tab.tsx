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

import React from 'react';
import {
    Badge,
    Box,
    Container,
    Header,
    Link,
    SpaceBetween,
    Table,
} from '@cloudscape-design/components';
import { formatDisplayNumber, formatDisplayText } from '../../../../shared/util/form-utils';
import { formatDate, formatDateDiff } from '../../../../shared/util/date-utils';
import { useParams } from 'react-router-dom';
import { prettyStatus } from '../../../../shared/util/table-utils';

export type TrainingJobTabProps = {
    job?: any;
    children?: any;
};

export function TrainingJobsTab (props: TrainingJobTabProps) {
    const { job, children } = props;
    const { projectName } = useParams();

    return (
        <SpaceBetween direction='vertical' size='l'>
            <Container
                header={
                    <Header description='This training job is the best training job for only this hyperparameter tuning job.'>
                        Training job status counter
                    </Header>
                }
            >
                <SpaceBetween direction='horizontal' size='l'>
                    <SpaceBetween direction='horizontal' size='xxs'>
                        <Box variant='awsui-key-label'>Completed</Box>
                        <Badge color='green'>
                            {formatDisplayNumber(job?.TrainingJobStatusCounters.Completed)}
                        </Badge>
                    </SpaceBetween>

                    <SpaceBetween direction='horizontal' size='xxs'>
                        <Box variant='awsui-key-label'>In Progress</Box>
                        <Badge>
                            {formatDisplayNumber(job?.TrainingJobStatusCounters.InProgress)}
                        </Badge>
                    </SpaceBetween>

                    <SpaceBetween direction='horizontal' size='xxs'>
                        <Box variant='awsui-key-label'>Stopped</Box>
                        <Badge>{formatDisplayNumber(job?.TrainingJobStatusCounters.Stopped)}</Badge>
                    </SpaceBetween>

                    <SpaceBetween direction='horizontal' size='xxs'>
                        <Box variant='awsui-key-label'>Failed</Box>
                        <div>
                            <Badge color='red'>
                                {formatDisplayNumber(
                                    job?.TrainingJobStatusCounters.RetryableError +
                                        job?.TrainingJobStatusCounters.NonRetryableError
                                )}
                            </Badge>{' '}
                            (Retryable:{' '}
                            {formatDisplayNumber(job?.TrainingJobStatusCounters.RetryableError)},
                            Non-retryable:{' '}
                            {formatDisplayNumber(job?.TrainingJobStatusCounters.NonRetryableError)})
                        </div>
                    </SpaceBetween>
                </SpaceBetween>
            </Container>

            <Table
                ariaLabels={{
                    tableLabel: 'Training job definitions table',
                }}
                header={<Header>Training jobs</Header>}
                items={children as any[]}
                columnDefinitions={[
                    {
                        header: 'Name',
                        cell (item) {
                            return (
                                <Link
                                    href={`#/project/${projectName}/jobs/training/detail/${item.TrainingJobName}`}
                                >
                                    {item.TrainingJobName}
                                </Link>
                            );
                        },
                    },
                    {
                        header: 'Status',
                        cell (item) {
                            return prettyStatus(item.TrainingJobStatus, item.FailureReason);
                        },
                    },
                    {
                        header: 'Objective metric value',
                        cell (item) {
                            return formatDisplayText(
                                item.FinalHyperParameterTuningJobObjectiveMetric?.Value
                            );
                        },
                    },
                    {
                        header: 'Creation time',
                        cell (item) {
                            return formatDate(item.CreationTime);
                        },
                    },
                    {
                        header: 'Training duration',
                        cell (item) {
                            return formatDateDiff(item.TrainingStartTime, item.TrainingEndTime);
                        },
                    },
                ]}
            />
        </SpaceBetween>
    );
}

export default {
    TrainingJobsTab,
};
