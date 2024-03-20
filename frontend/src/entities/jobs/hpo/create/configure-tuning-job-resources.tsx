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
    ColumnLayout,
    Container,
    FormField,
    Header,
    Input,
    SpaceBetween,
} from '@cloudscape-design/components';
import { IHPOJob } from '../hpo-job.model';
import { FormProps } from '../../form-props';

export type ConfigureTuningJobResourcesProps = FormProps<IHPOJob>;
export function ConfigureTuningJobResources (props: ConfigureTuningJobResourcesProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <Container
            header={
                <Header description='Specify resource limits for hyperparameter tuning and training jobs.'>
                    Resource limits
                </Header>
            }
        >
            <ColumnLayout columns={2}>
                <SpaceBetween direction='vertical' size='xxs'>
                    <FormField
                        label='Maximum parallel training jobs'
                        description='The maximum number of concurrent training jobs that the hyperparameter tuning job can run.'
                        errorText={
                            formErrors?.HyperParameterTuningJobConfig?.ResourceLimits
                                .MaxParallelTrainingJobs
                        }
                    >
                        <Input
                            value={`${item.HyperParameterTuningJobConfig?.ResourceLimits?.MaxParallelTrainingJobs}`}
                            type='number'
                            inputMode='numeric'
                            onChange={(event) => {
                                setFields({
                                    'HyperParameterTuningJobConfig.ResourceLimits.MaxParallelTrainingJobs':
                                        Number(event.detail.value) < 1
                                            ? 1
                                            : Number(event.detail.value),
                                });
                                touchFields([
                                    'HyperParameterTuningJobConfig.ResourceLimits.MaxParallelTrainingJobs',
                                ]);
                            }}
                        />
                    </FormField>
                    <FormField description='By default a hyperparameter tuning job can run a maximum of 10 parallel training jobs.' />
                </SpaceBetween>

                <SpaceBetween direction='vertical' size='xxs'>
                    <FormField
                        label='Maximum training jobs'
                        description='The maximum number of training jobs that the hyperparameter tuning job can run.'
                        errorText={
                            formErrors?.HyperParameterTuningJobConfig?.ResourceLimits
                                .MaxNumberOfTrainingJobs
                        }
                    >
                        <Input
                            value={`${item.HyperParameterTuningJobConfig?.ResourceLimits?.MaxNumberOfTrainingJobs}`}
                            type='number'
                            inputMode='numeric'
                            onChange={(event) => {
                                setFields({
                                    'HyperParameterTuningJobConfig.ResourceLimits.MaxNumberOfTrainingJobs':
                                        Number(event.detail.value) < 1
                                            ? 1
                                            : Number(event.detail.value),
                                });
                                touchFields([
                                    'HyperParameterTuningJobConfig.ResourceLimits.MaxNumberOfTrainingJobs',
                                ]);
                            }}
                        />
                    </FormField>
                    <FormField description='By default a hyperparameter tuning job can run a maximum of 500 training jobs.' />
                </SpaceBetween>
            </ColumnLayout>
        </Container>
    );
}