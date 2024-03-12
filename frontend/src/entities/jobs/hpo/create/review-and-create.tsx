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
    Button,
    ColumnLayout,
    Container,
    FormField,
    Header,
    SpaceBetween,
} from '@cloudscape-design/components';
import { IHPOJob } from '../hpo-job.model';
import { JobDefinitions } from './job-definitions';
import { FormProps } from '../../form-props';

export type ReviewAndCreateProps = FormProps<IHPOJob> & {
    setStep(stepNumber: number): void;
};
export function ReviewAndCreate (props: ReviewAndCreateProps) {
    const { item, setFields, touchFields, formErrors, setStep } = props;

    return (
        <SpaceBetween direction='vertical' size='xxl'>
            <SpaceBetween direction='vertical' size='xxs'>
                <Container
                    header={
                        <ColumnLayout columns={2}>
                            <Header>Job settings</Header>
                            <div style={{ float: 'right' }}>
                                <Button onClick={() => setStep(0)}>Edit Job Settings</Button>
                            </div>
                        </ColumnLayout>
                    }
                >
                    <ColumnLayout columns={2}>
                        <SpaceBetween direction='vertical' size='xxs'>
                            <FormField label='Job name' />
                            {item.HyperParameterTuningJobName}
                        </SpaceBetween>
                        <SpaceBetween direction='vertical' size='xxs'>
                            <FormField label='Tuning strategy' />
                            {item.HyperParameterTuningJobConfig.Strategy}
                        </SpaceBetween>
                    </ColumnLayout>
                </Container>
            </SpaceBetween>

            <SpaceBetween direction='vertical' size='xxs'>
                <JobDefinitions
                    {...{ item, setFields, touchFields, formErrors }}
                    actions={
                        <Button
                            onClick={() => {
                                setStep(1);
                            }}
                        >
                            Edit Job Definitions
                        </Button>
                    }
                />
            </SpaceBetween>

            <SpaceBetween direction='vertical' size='xxs'>
                <Container
                    header={
                        <ColumnLayout columns={2}>
                            <Header>Resource Limits</Header>
                            <div style={{ float: 'right' }}>
                                <Button onClick={() => setStep(2)}>Edit Resource Limits</Button>
                            </div>
                        </ColumnLayout>
                    }
                >
                    <ColumnLayout columns={2}>
                        <SpaceBetween direction='vertical' size='xxs'>
                            <FormField label='Maximum number of parallel training jobs' />
                            {
                                item.HyperParameterTuningJobConfig.ResourceLimits
                                    .MaxParallelTrainingJobs
                            }
                        </SpaceBetween>
                        <SpaceBetween direction='vertical' size='xxs'>
                            <FormField label='Maximum number of training jobs' />
                            {
                                item.HyperParameterTuningJobConfig.ResourceLimits
                                    .MaxNumberOfTrainingJobs
                            }
                        </SpaceBetween>
                    </ColumnLayout>
                </Container>
            </SpaceBetween>
        </SpaceBetween>
    );
}
