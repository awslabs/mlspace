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
import { ITrainingJobDefinition } from '../hpo-job.model';
import {
    Box,
    Checkbox,
    Container,
    FormField,
    Grid,
    Header,
    Input,
    Select,
    SpaceBetween,
} from '@cloudscape-design/components';
import { enumToOptions } from '../../../../shared/util/enum-utils';
import { TimeUnit } from '../../../../shared/util/date-utils';

export type ManageSpotTrainingProps = FormProps<ITrainingJobDefinition>;

export function ManageSpotTraining (props: ManageSpotTrainingProps) {
    const { item, setFields, formErrors } = props;

    const [state, setState] = React.useState({
        stoppingValue: 48,
        stoppingUnit: TimeUnit.HOURS,
    });

    return (
        <Container header={<Header>Manage spot training</Header>}>
            <SpaceBetween direction='vertical' size='m'>
                <SpaceBetween direction='horizontal' size='s'>
                    <Checkbox
                        checked={item?.EnableManagedSpotTraining || false}
                        onChange={(event) =>
                            setFields({ EnableManagedSpotTraining: event.detail.checked })
                        }
                    >
                        <Box>Enable managed spot training - optional</Box>
                    </Checkbox>
                </SpaceBetween>
                <Grid gridDefinition={[{ colspan: 5 }, { colspan: 3 }]}>
                    <FormField label='Maximum runtime' errorText={formErrors?.stoppingValue}>
                        <Input
                            value={`${state.stoppingValue}`}
                            onChange={(event) =>
                                setState({ ...state, stoppingValue: Number(event.detail.value) })
                            }
                            disabled={!item?.EnableManagedSpotTraining}
                        />
                    </FormField>
                    <FormField label='Time' errorText={formErrors?.stoppingUnit}>
                        <Select
                            selectedOption={{ value: state.stoppingUnit }}
                            options={enumToOptions(TimeUnit)}
                            onChange={(event) =>
                                setState({
                                    ...state,
                                    stoppingUnit:
                                        TimeUnit[
                                            event.detail.selectedOption.value?.toUpperCase() as keyof typeof TimeUnit
                                        ],
                                })
                            }
                            disabled={!item?.EnableManagedSpotTraining}
                        />
                    </FormField>
                </Grid>
            </SpaceBetween>
        </Container>
    );
}