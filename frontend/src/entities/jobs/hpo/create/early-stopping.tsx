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
import { IHPOJob, TrainingJobEarlyStoppingType } from '../hpo-job.model';
import { FormProps } from '../../form-props';
import { enumToOptions } from '../../../../shared/util/enum-utils';

export type EarlyStoppingProps = FormProps<IHPOJob>;

export function EarlyStopping (props: EarlyStoppingProps) {
    const { item, setFields } = props;

    return (
        <Container
            header={
                <Header description='Early stopping stops training jobs when they are unlikely to improve the current best objective metric of the hyperparameter tuning job.'>
                    Early Stopping
                </Header>
            }
        >
            <FormField label='Training job early stop'>
                <Select
                    selectedOption={{
                        value: item.HyperParameterTuningJobConfig.TrainingJobEarlyStoppingType,
                    }}
                    options={enumToOptions(TrainingJobEarlyStoppingType)}
                    onChange={(event) => {
                        setFields({
                            'HyperParameterTuningJobConfig.TrainingJobEarlyStoppingType':
                                event.detail.selectedOption.value,
                        });
                    }}
                />
            </FormField>
        </Container>
    );
}
