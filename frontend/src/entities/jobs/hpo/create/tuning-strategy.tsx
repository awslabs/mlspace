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
import { Container, FormField, Header, Select } from '@cloudscape-design/components';
import { HyperParameterTuningJobConfigStrategy, IHPOJob } from '../hpo-job.model';
import { FormProps } from '../../form-props';
import { enumToOptions } from '../../../../shared/util/enum-utils';

export type TuningStrategyProps = FormProps<IHPOJob>;

export function TuningStrategy (props: TuningStrategyProps) {
    const { item, setFields } = props;

    return (
        <Container header={<Header>Tuning strategy</Header>}>
            <FormField
                label='Tuning strategy'
                description='The strategy that hyperparameter tuning uses to search over hyperparameter ranges that you specify.'
            >
                <Select
                    selectedOption={{ value: item.HyperParameterTuningJobConfig.Strategy }}
                    options={enumToOptions(HyperParameterTuningJobConfigStrategy)}
                    onChange={(event) => {
                        setFields({
                            'HyperParameterTuningJobConfig.Strategy':
                                event.detail.selectedOption.value,
                        });
                    }}
                />
            </FormField>
        </Container>
    );
}
