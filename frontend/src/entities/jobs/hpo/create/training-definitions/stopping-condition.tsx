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
import { FormProps } from '../../../form-props';
import { ITrainingJobDefinition } from '../../hpo-job.model';
import {
    Container,
    FormField,
    Grid,
    Header,
    Input,
    Select,
    SpaceBetween,
} from '@cloudscape-design/components';
import { enumToOptions } from '../../../../../shared/util/enum-utils';
import { getDuration, TimeUnit, durationToSeconds } from '../../../../../shared/util/date-utils';

export type StoppingConditionProps = FormProps<ITrainingJobDefinition>;

export function StoppingCondition (props: StoppingConditionProps) {
    const { item, setFields } = props;

    const duration = getDuration(item.StoppingCondition.MaxRuntimeInSeconds!);

    return (
        <Container header={<Header>Stopping condition</Header>}>
            <SpaceBetween direction='vertical' size='m'>
                <Grid gridDefinition={[{ colspan: 5 }, { colspan: 3 }]}>
                    <FormField label='Maximum duration per training job'>
                        <Input
                            value={String(duration.value)}
                            inputMode='numeric'
                            type='number'
                            onChange={(event) =>
                                setFields({
                                    'StoppingCondition.MaxRuntimeInSeconds': durationToSeconds(
                                        Number(event.detail.value) > 0
                                            ? Number(event.detail.value)
                                            : 1,
                                        duration.unit
                                    ),
                                })
                            }
                        />
                    </FormField>
                    <FormField label='Time'>
                        <Select
                            selectedOption={{ value: duration.unit }}
                            options={enumToOptions(TimeUnit)}
                            onChange={(event) => {
                                setFields({
                                    'StoppingCondition.MaxRuntimeInSeconds': durationToSeconds(
                                        duration.value,
                                        TimeUnit[
                                            event.detail.selectedOption.value?.toUpperCase() as keyof typeof TimeUnit
                                        ]
                                    ),
                                });
                            }}
                        />
                    </FormField>
                </Grid>
            </SpaceBetween>
        </Container>
    );
}