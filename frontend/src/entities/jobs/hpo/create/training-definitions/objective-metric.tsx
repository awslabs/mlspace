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
    Container,
    FormField,
    Grid,
    Header,
    Select,
    SelectProps,
} from '@cloudscape-design/components';
import { ITrainingJobDefinition, ObjectiveMetricType } from '../../hpo-job.model';
import { FormProps } from '../../../form-props';
import { ML_ALGORITHMS } from '../../../algorithms';
import { AlgorithmSource } from './algorithm-options';

export type ObjectiveMetricProps = {
    algorithmSource: AlgorithmSource;
} & FormProps<ITrainingJobDefinition>;

export function ObjectiveMetric (props: ObjectiveMetricProps) {
    const { algorithmSource, item, setFields, touchFields, formErrors } = props;

    const algorithm = ML_ALGORITHMS.find(
        (algorithm) => algorithm.displayName === item.AlgorithmSpecification?.AlgorithmName
    );
    let metricOptions: SelectProps.Option[] | undefined = undefined;
    if (algorithmSource === AlgorithmSource.CUSTOM) {
        metricOptions = item.AlgorithmSpecification.MetricDefinitions.map((metric) => {
            return { value: metric.Name };
        });
    } else {
        metricOptions = algorithm?.metadata.objectiveMetrics?.map((metric) => {
            return { value: metric.metricName };
        });
    }

    function defaultTuning (name: string): ObjectiveMetricType | undefined {
        return algorithm?.metadata.objectiveMetrics?.find((metric) => metric.metricName === name)
            ?.metricType;
    }

    return (
        <Container
            header={
                <Header description='To find the best training job, set an objective metric and tuning type. See the hyperparameter tuning job detail page for a summary of the best training job.'>
                    ObjectiveMetric
                </Header>
            }
        >
            <Grid
                gridDefinition={[
                    { colspan: { default: 12, xxs: 6 } },
                    { colspan: { default: 12, xxs: 6 } },
                ]}
            >
                <FormField
                    label='Objective metric'
                    errorText={formErrors?.TuningObjective?.MetricName}
                >
                    <Select
                        placeholder='Select a metric...'
                        empty={
                            algorithmSource === AlgorithmSource.CUSTOM
                                ? 'Add metrics first.'
                                : 'Select an algorithm first.'
                        }
                        selectedOption={
                            item.TuningObjective?.MetricName
                                ? { value: item.TuningObjective?.MetricName }
                                : null
                        }
                        options={metricOptions}
                        onChange={(event) => {
                            touchFields(['TuningObjective.MetricName']);
                            const updates = {
                                'TuningObjective.MetricName': event.detail.selectedOption.value,
                            };

                            if (algorithmSource === AlgorithmSource.BUILT_IN) {
                                updates['TuningObjective.Type'] = defaultTuning(
                                    event.detail.selectedOption.value!
                                );
                            }
                            setFields(updates);
                            touchFields(['TuningObjective.MetricName']);
                        }}
                    />
                </FormField>

                <FormField label='Type' errorText={formErrors?.TuningObjective?.Type}>
                    <Select
                        placeholder='Select a type...'
                        empty='Select an algorithm first.'
                        selectedOption={
                            item.TuningObjective?.Type
                                ? { value: item.TuningObjective?.Type }
                                : null
                        }
                        options={[
                            { label: 'Maximize', value: 'Maximize' },
                            { label: 'Minimize', value: 'Minimize' },
                        ]}
                        onChange={(event) => {
                            setFields({
                                'TuningObjective.Type': event.detail.selectedOption.value,
                            });
                            touchFields(['TuningObjective.Type']);
                        }}
                    />
                </FormField>
            </Grid>
        </Container>
    );
}
