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
import { FormProps } from '../../form-props';
import { ILabelingJobCreateForm } from './labeling-job-create';
import {
    Checkbox,
    Container,
    ExpandableSection,
    FormField,
    Grid,
    Header,
    Input,
    Select,
    SpaceBetween,
    TextContent,
} from '@cloudscape-design/components';
import { useAppSelector } from '../../../../config/store';
import { selectLabelingWorkTeams } from '../labeling-job.reducer';
import { ILabelingJobWorkteam } from '../labeling-job.model';
import Condition from '../../../../modules/condition';
import { TASK_TYPE_CONFIG } from './labeling-job-task-config';
import { timeInSeconds } from '../../../../shared/util/date-utils';
import { findOptionByValue } from '../../../../shared/util/select-utils';

export type LabelingJobWorkersProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobWorkers (props: LabelingJobWorkersProps) {
    const { item, formErrors, setFields, touchFields } = props;
    const teams = useAppSelector(selectLabelingWorkTeams);

    const teamsOptions = teams.map((team: ILabelingJobWorkteam) => {
        return {
            label: team.WorkteamName,
            value: team.WorkteamArn,
        };
    });

    const taskConfig = TASK_TYPE_CONFIG[item.taskCategory][item.taskSelection];

    return (
        <Container header={<Header>Workers</Header>}>
            <SpaceBetween direction='vertical' size='m'>
                <FormField
                    label='Labeling team'
                    description='Select a team to perform this labeling job.'
                    errorText={formErrors?.job?.HumanTaskConfig?.WorkteamArn}
                >
                    <Select
                        selectedOption={findOptionByValue(
                            teamsOptions,
                            item.job.HumanTaskConfig.WorkteamArn
                        )}
                        onChange={({ detail }) => {
                            setFields({
                                'job.HumanTaskConfig.WorkteamArn': detail.selectedOption.value,
                            });
                        }}
                        onBlur={() => {
                            touchFields(['job.HumanTaskConfig.WorkteamArn']);
                        }}
                        options={teamsOptions}
                        empty={
                            'Ask your administrator to create a Ground Truth Labeling workforce.'
                        }
                        placeholder='Select a private team'
                        data-cy='private-team-select'
                    />
                </FormField>

                <Header
                    variant='h3'
                    description='The maximum time a worker can work in a single task.'
                >
                    Task timeout
                </Header>
                <FormField errorText={formErrors?.job?.HumanTaskConfig?.TaskTimeLimitInSeconds}>
                    <Grid
                        gridDefinition={[
                            { colspan: { default: 12, xxs: 4 } },
                            { colspan: { default: 12, xxs: 4 } },
                            { colspan: { default: 12, xxs: 4 } },
                        ]}
                    >
                        <FormField label='Hours'>
                            <Input
                                type='number'
                                value={`${item.taskTimeout.hours}`}
                                onChange={({ detail }) => {
                                    if (Number(detail.value) >= 0 && Number(detail.value) < 24) {
                                        setFields({
                                            'taskTimeout.hours': Number(detail.value),
                                            'job.HumanTaskConfig.TaskTimeLimitInSeconds':
                                                timeInSeconds(
                                                    0,
                                                    Number(detail.value),
                                                    item.taskTimeout.minutes,
                                                    item.taskTimeout.seconds
                                                ),
                                        });
                                        touchFields(['job.HumanTaskConfig.TaskTimeLimitInSeconds']);
                                    }
                                }}
                                onBlur={() => {
                                    touchFields(['job.HumanTaskConfig.TaskTimeLimitInSeconds']);
                                }}
                            />
                        </FormField>
                        <FormField label='Minutes'>
                            <Input
                                type='number'
                                value={`${item.taskTimeout.minutes}`}
                                onChange={({ detail }) => {
                                    if (Number(detail.value) >= 0 && Number(detail.value) < 60) {
                                        setFields({
                                            'taskTimeout.minutes': Number(detail.value),
                                            'job.HumanTaskConfig.TaskTimeLimitInSeconds':
                                                timeInSeconds(
                                                    0,
                                                    item.taskTimeout.hours,
                                                    Number(detail.value),
                                                    item.taskTimeout.seconds
                                                ),
                                        });
                                        touchFields(['job.HumanTaskConfig.TaskTimeLimitInSeconds']);
                                    }
                                }}
                                onBlur={() => {
                                    touchFields(['job.HumanTaskConfig.TaskTimeLimitInSeconds']);
                                }}
                            />
                        </FormField>
                        <FormField label='Seconds'>
                            <Input
                                type='number'
                                value={`${item.taskTimeout.seconds}`}
                                onChange={({ detail }) => {
                                    if (Number(detail.value) >= 0 && Number(detail.value) < 60) {
                                        setFields({
                                            'taskTimeout.seconds': Number(detail.value),
                                            'job.HumanTaskConfig.TaskTimeLimitInSeconds':
                                                timeInSeconds(
                                                    0,
                                                    item.taskTimeout.hours,
                                                    item.taskTimeout.minutes,
                                                    Number(detail.value)
                                                ),
                                        });
                                        touchFields(['job.HumanTaskConfig.TaskTimeLimitInSeconds']);
                                    }
                                }}
                                onBlur={() => {
                                    touchFields(['job.HumanTaskConfig.TaskTimeLimitInSeconds']);
                                }}
                            />
                        </FormField>
                    </Grid>
                </FormField>
                <Header
                    variant='h3'
                    description='The amount of time that a task remains available to workers before expiring.'
                >
                    Task expiration time
                </Header>
                <FormField
                    errorText={formErrors?.job?.HumanTaskConfig?.TaskAvailabilityLifetimeInSeconds}
                >
                    <Grid
                        gridDefinition={[
                            { colspan: { default: 12, xxs: 3 } },
                            { colspan: { default: 12, xxs: 3 } },
                            { colspan: { default: 12, xxs: 3 } },
                            { colspan: { default: 12, xxs: 3 } },
                        ]}
                    >
                        <FormField label='Days'>
                            <Input
                                type='number'
                                value={`${item.taskExpiration.days}`}
                                onChange={({ detail }) => {
                                    if (Number(detail.value) >= 0) {
                                        setFields({
                                            'taskExpiration.days': Number(detail.value),
                                            'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds':
                                                timeInSeconds(
                                                    Number(detail.value),
                                                    item.taskExpiration.hours,
                                                    item.taskExpiration.minutes,
                                                    item.taskExpiration.seconds
                                                ),
                                        });
                                        touchFields([
                                            'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds',
                                        ]);
                                    }
                                }}
                                onBlur={() => {
                                    touchFields([
                                        'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds',
                                    ]);
                                }}
                            />
                        </FormField>

                        <FormField label='Hours'>
                            <Input
                                type='number'
                                value={`${item.taskExpiration.hours}`}
                                onChange={({ detail }) => {
                                    if (Number(detail.value) >= 0 && Number(detail.value) < 24) {
                                        setFields({
                                            'taskExpiration.hours': Number(detail.value),
                                            'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds':
                                                timeInSeconds(
                                                    item.taskExpiration.days,
                                                    Number(detail.value),
                                                    item.taskExpiration.minutes,
                                                    item.taskExpiration.seconds
                                                ),
                                        });
                                        touchFields([
                                            'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds',
                                        ]);
                                    }
                                }}
                                onBlur={() => {
                                    touchFields([
                                        'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds',
                                    ]);
                                }}
                            />
                        </FormField>

                        <FormField label='Minutes'>
                            <Input
                                type='number'
                                value={`${item.taskExpiration.minutes}`}
                                onChange={({ detail }) => {
                                    if (Number(detail.value) >= 0 && Number(detail.value) < 60) {
                                        setFields({
                                            'taskExpiration.minutes': Number(detail.value),
                                            'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds':
                                                timeInSeconds(
                                                    item.taskExpiration.days,
                                                    item.taskExpiration.hours,
                                                    Number(detail.value),
                                                    item.taskExpiration.seconds
                                                ),
                                        });
                                        touchFields([
                                            'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds',
                                        ]);
                                    }
                                }}
                                onBlur={() => {
                                    touchFields([
                                        'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds',
                                    ]);
                                }}
                            />
                        </FormField>
                        <FormField label='Seconds'>
                            <Input
                                type='number'
                                value={`${item.taskExpiration.seconds}`}
                                onChange={({ detail }) => {
                                    if (Number(detail.value) >= 0 && Number(detail.value) < 60) {
                                        setFields({
                                            'taskExpiration.seconds': Number(detail.value),
                                            'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds':
                                                timeInSeconds(
                                                    item.taskExpiration.days,
                                                    item.taskExpiration.hours,
                                                    item.taskExpiration.minutes,
                                                    Number(detail.value)
                                                ),
                                        });
                                        touchFields([
                                            'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds',
                                        ]);
                                    }
                                }}
                                onBlur={() => {
                                    touchFields([
                                        'job.HumanTaskConfig.TaskAvailabilityLifetimeInSeconds',
                                    ]);
                                }}
                            />
                        </FormField>
                    </Grid>
                </FormField>

                <Condition condition={taskConfig?.autoLabeling || false}>
                    <FormField constraintText='Amazon SageMaker will automatically label a portion of your dataset. It will train a model in your AWS account using Built-in Algorithm and your dataset. When you enable this, training jobs use new computing resources on your behalf.'>
                        <Checkbox
                            checked={item.enableAutomatedLabeling}
                            onChange={({ detail }) => {
                                setFields({ enableAutomatedLabeling: detail.checked });
                                if (detail.checked) {
                                    item.job['LabelingJobAlgorithmsConfig'] = {
                                        LabelingJobAlgorithmSpecificationArn: '',
                                        LabelingJobResourceConfig: {
                                            VpcConfig: {
                                                SecurityGroupIds: [],
                                                Subnets: [],
                                            },
                                        },
                                    };
                                } else {
                                    delete item.job['LabelingJobAlgorithmsConfig'];
                                }
                            }}
                        >
                            Enable automated data labeling
                        </Checkbox>
                    </FormField>
                </Condition>

                <ExpandableSection
                    headerText={
                        <span>
                            Additional configuration - <em>optional</em>
                        </span>
                    }
                >
                    <FormField
                        label='Number of workers per dataset object'
                        description='The number of distinct workers you want to perform the same task on a dataset object. This can help increase the accuracy of the data labels.'
                        errorText={
                            formErrors?.job?.HumanTaskConfig?.NumberOfHumanWorkersPerDataObject
                        }
                    >
                        <SpaceBetween direction='horizontal' size='xxs'>
                            <Input
                                type='number'
                                value={`${item.job?.HumanTaskConfig?.NumberOfHumanWorkersPerDataObject}`}
                                onChange={({ detail }) => {
                                    if (Number(detail.value) >= 1) {
                                        setFields({
                                            'job.HumanTaskConfig.NumberOfHumanWorkersPerDataObject':
                                                Number(detail.value),
                                        });
                                        touchFields([
                                            'job.HumanTaskConfig.NumberOfHumanWorkersPerDataObject',
                                        ]);
                                    }
                                }}
                                onBlur={() => {
                                    touchFields([
                                        'job.HumanTaskConfig.NumberOfHumanWorkersPerDataObject',
                                    ]);
                                }}
                            />
                            <TextContent>
                                <p style={{ lineHeight: '2em' }}>workers</p>
                            </TextContent>
                        </SpaceBetween>
                    </FormField>
                </ExpandableSection>
            </SpaceBetween>
        </Container>
    );
}

export default LabelingJobWorkers;
