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
    Alert,
    Box,
    ColumnLayout,
    Container,
    Header,
    Link,
    SpaceBetween,
    Table,
} from '@cloudscape-design/components';
import Condition from '../../../../modules/condition';
import { formatDisplayText } from '../../../../shared/util/form-utils';
import { useParams } from 'react-router-dom';

export type BestTrainingJobProps = {
    hpoTrainingJob?: any;
    bestTrainingJob?: any;
};

export function BestTrainingJob (props: BestTrainingJobProps) {
    const { hpoTrainingJob, bestTrainingJob } = props;
    const { projectName } = useParams();

    const hyperParameters = Object.entries(bestTrainingJob?.HyperParameters || {}).map((value) => {
        const hyperParameter = {
            Name: value[0],
            Value: String(value[1]),
            Type: 'FreeText',
        };

        if (
            bestTrainingJob.HyperParameterRanges.IntegerParameterRanges.findIndex(
                (parameter: any) => parameter === hyperParameter.Name
            ) !== -1
        ) {
            hyperParameter.Type = 'Integer';
        } else if (
            bestTrainingJob.HyperParameterRanges.ContinuousParameterRanges.findIndex(
                (parameter: any) => parameter === hyperParameter.Name
            ) !== -1
        ) {
            hyperParameter.Type = 'Continuous';
        } else if (
            bestTrainingJob.HyperParameterRanges.CategoricalParameterRanges.findIndex(
                (parameter: any) => parameter === hyperParameter.Name
            ) !== -1
        ) {
            hyperParameter.Type = 'Categorical';
        }

        return hyperParameter;
    });

    return (
        <SpaceBetween direction='vertical' size='s'>
            <Container
                header={
                    <Header description='This training job is the best training job for only this hyperparameter tuning job.'>
                        Best training job summary
                    </Header>
                }
            >
                <Condition condition={hpoTrainingJob?.BestTrainingJob === undefined}>
                    <Alert>
                        Best training job summary data is available when you have completed training
                        jobs that are emitting metrics.
                    </Alert>
                </Condition>

                <Condition condition={hpoTrainingJob?.BestTrainingJob !== undefined}>
                    <ColumnLayout columns={4}>
                        <div>
                            <Box color='text-status-inactive'>Name</Box>
                            <Link
                                href={`#/project/${projectName}/jobs/training/detail/${hpoTrainingJob?.BestTrainingJob?.TrainingJobName}`}
                            >
                                {formatDisplayText(
                                    hpoTrainingJob?.BestTrainingJob?.TrainingJobName
                                )}
                            </Link>
                        </div>

                        <div>
                            <Box color='text-status-inactive'>Status</Box>
                            {formatDisplayText(hpoTrainingJob?.BestTrainingJob?.TrainingJobStatus)}
                        </div>

                        <div>
                            <Box color='text-status-inactive'>Objective metric</Box>
                            {formatDisplayText(
                                hpoTrainingJob?.BestTrainingJob
                                    ?.FinalHyperParameterTuningJobObjectiveMetric.MetricName
                            )}
                        </div>

                        <div>
                            <Box color='text-status-inactive'>Value</Box>
                            {formatDisplayText(
                                hpoTrainingJob?.BestTrainingJob
                                    ?.FinalHyperParameterTuningJobObjectiveMetric.Value
                            )}
                        </div>
                    </ColumnLayout>
                </Condition>
            </Container>

            <Condition condition={hyperParameters.length > 0}>
                <Container header={<Header>Best training job hyperparameters</Header>}>
                    <Table
                        variant='embedded'
                        items={hyperParameters}
                        trackBy='Name'
                        columnDefinitions={[
                            {
                                header: 'Name',
                                cell (item) {
                                    return item.Name;
                                },
                            },
                            {
                                header: 'Type',
                                cell (item) {
                                    return item.Type;
                                },
                            },
                            {
                                header: 'Value',
                                cell (item) {
                                    return item.Value;
                                },
                            },
                        ]}
                    />
                </Container>
            </Condition>
        </SpaceBetween>
    );
}