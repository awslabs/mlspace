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
    Box,
    ColumnLayout,
    Container,
    Header,
    SpaceBetween,
    Table,
} from '@cloudscape-design/components';
import {
    formatDisplayBoolean,
    formatDisplayNumber,
    formatDisplayText,
} from '../../../../shared/util/form-utils';
import { formatDuration } from '../../../../shared/util/date-utils';

export type TrainingJobDefinitionsProps = {
    // Used when the HPO job was launched with TrainingJobDefinition
    hpoTrainingJob?: any;
    // Used when the HPO job was launched with TrainingJobDefinitions
    trainingJobDefinitions: any[];
};

export function TrainingJobDefinitions (props: TrainingJobDefinitionsProps) {
    const { hpoTrainingJob, trainingJobDefinitions } = props;

    const [state, setState] = React.useState({
        selectedTrainingJobDefinition: trainingJobDefinitions[0],
    });

    return (
        <SpaceBetween direction='vertical' size='m'>
            <Table
                header={<Header>Training job definition</Header>}
                ariaLabels={{
                    tableLabel: 'Training job definitions table',
                }}
                trackBy='DefinitionName'
                items={trainingJobDefinitions}
                selectedItems={
                    state.selectedTrainingJobDefinition ? [state.selectedTrainingJobDefinition] : []
                }
                empty={'Loading training job definitions...'}
                selectionType='single'
                onSelectionChange={(event) => {
                    setState({
                        selectedTrainingJobDefinition:
                            event.detail.selectedItems.length > 0
                                ? event.detail.selectedItems[0]
                                : null,
                    });
                }}
                columnDefinitions={[
                    {
                        header: 'Name',
                        cell (item) {
                            return formatDisplayText(item.DefinitionName);
                        },
                    },
                    {
                        header: 'Objective metric',
                        cell (item) {
                            return formatDisplayText(
                                item.StaticHyperParameters?._tuning_objective_metric
                            );
                        },
                    },
                    {
                        header: 'Type',
                        cell (item) {
                            return formatDisplayText(
                                // Checks for TrainingJobDefinition vs TrainingJobDefinitions configuration
                                item.TuningObjective?.Type ||
                                    hpoTrainingJob?.HyperParameterTuningJobConfig
                                        ?.HyperParameterTuningJobObjective?.Type
                            );
                        },
                    },
                    {
                        header: 'Instance type',
                        cell (item) {
                            return formatDisplayText(item.ResourceConfig?.InstanceType);
                        },
                    },
                    {
                        header: 'Instance count',
                        cell (item) {
                            return formatDisplayNumber(item.ResourceConfig?.InstanceCount);
                        },
                    },
                ]}
            />

            <Container header={<Header>Training job configuration</Header>}>
                <ColumnLayout columns={3}>
                    <SpaceBetween direction='vertical' size='xxl'>
                        <div>
                            <Box color='text-status-inactive'>Algorithm / Training image</Box>
                            {formatDisplayText(
                                state.selectedTrainingJobDefinition?.AlgorithmSpecification
                                    ?.TrainingImage ||
                                    state.selectedTrainingJobDefinition?.AlgorithmSpecification
                                        ?.AlgorithmName
                            )}
                        </div>

                        <div>
                            <Box color='text-status-inactive'>Training input mode</Box>
                            {formatDisplayText(
                                state.selectedTrainingJobDefinition?.AlgorithmSpecification
                                    ?.TrainingInputMode
                            )}
                        </div>
                    </SpaceBetween>

                    <SpaceBetween direction='vertical' size='l'>
                        <div>
                            <Box color='text-status-inactive'>Tuning objective metric</Box>
                            {formatDisplayText(
                                state.selectedTrainingJobDefinition?.StaticHyperParameters
                                    ?._tuning_objective_metric
                            )}
                        </div>

                        <div>
                            <Box color='text-status-inactive'>Tuning objective type</Box>
                            {formatDisplayText(
                                // Checks for TrainingJobDefinition vs TrainingJobDefinitions configuration
                                state.selectedTrainingJobDefinition?.TuningObjective?.Type ||
                                    hpoTrainingJob?.HyperParameterTuningJobConfig
                                        ?.HyperParameterTuningJobObjective?.Type
                            )}
                        </div>
                    </SpaceBetween>

                    <SpaceBetween direction='vertical' size='xxl'>
                        <div>
                            <Box color='text-status-inactive'>Role ARN</Box>
                            {formatDisplayText(state.selectedTrainingJobDefinition?.RoleArn)}
                        </div>
                    </SpaceBetween>
                </ColumnLayout>
            </Container>

            <Container header={<Header>Network</Header>}>
                <div>
                    <Box color='text-status-inactive'>Enable network isolation</Box>
                    {formatDisplayBoolean(
                        state.selectedTrainingJobDefinition?.EnableNetworkIsolation
                    )}
                </div>
            </Container>

            <Container header={<Header>Input data configuration</Header>}>
                <SpaceBetween direction='vertical' size='l'>
                    {state.selectedTrainingJobDefinition?.InputDataConfig.map(
                        (inputDataConfig: any) => {
                            return (
                                <ColumnLayout
                                    key={`input-channel-${inputDataConfig.ChannelName}`}
                                    columns={4}
                                    variant='text-grid'
                                >
                                    <SpaceBetween direction='vertical' size='xxl'>
                                        <div>
                                            <Box color='text-status-inactive'>Channel name</Box>
                                            {formatDisplayText(inputDataConfig.ChannelName)}
                                        </div>
                                    </SpaceBetween>

                                    <SpaceBetween direction='vertical' size='xxl'>
                                        <div>
                                            <Box color='text-status-inactive'>Content type</Box>
                                            {formatDisplayText(inputDataConfig.ContentType)}
                                        </div>

                                        <div>
                                            <Box color='text-status-inactive'>S3 data type</Box>
                                            {formatDisplayText(
                                                inputDataConfig.DataSource.S3DataSource.S3DataType
                                            )}
                                        </div>
                                    </SpaceBetween>

                                    <SpaceBetween direction='vertical' size='xxl'>
                                        <div>
                                            <Box color='text-status-inactive'>Compression type</Box>
                                            {formatDisplayText(
                                                inputDataConfig.CompressionType,
                                                'None'
                                            )}
                                        </div>

                                        <div>
                                            <Box color='text-status-inactive'>
                                                S3 URI
                                            </Box>
                                            {formatDisplayText(
                                                inputDataConfig.DataSource.S3DataSource.S3Uri
                                            )}
                                        </div>
                                    </SpaceBetween>

                                    <SpaceBetween direction='vertical' size='xxl'>
                                        <div>
                                            <Box color='text-status-inactive'>
                                                S3 data distribution type
                                            </Box>
                                            {formatDisplayText(
                                                inputDataConfig.DataSource.S3DataSource
                                                    .S3DataDistributionType
                                            )}
                                        </div>
                                    </SpaceBetween>
                                </ColumnLayout>
                            );
                        }
                    )}
                </SpaceBetween>
            </Container>

            <Container header={<Header>Manage spot training</Header>}>
                <div>
                    <Box color='text-status-inactive'>S3 location</Box>
                    {formatDisplayBoolean(
                        state.selectedTrainingJobDefinition?.EnableManagedSpotTraining,
                        ['Enabled', 'Disabled']
                    )}
                </div>
            </Container>

            <Container header={<Header>Checkpoint configuration</Header>}>
                <div>
                    <Box color='text-status-inactive'>Manage spot training</Box>
                    {formatDisplayText(
                        state.selectedTrainingJobDefinition?.CheckpointConfig?.S3Uri
                    )}
                </div>
            </Container>

            <Container header={<Header>Output data configuration</Header>}>
                <div>
                    <Box color='text-status-inactive'>S3 output path</Box>
                    {formatDisplayText(
                        state.selectedTrainingJobDefinition?.OutputDataConfig.S3OutputPath
                    )}
                </div>
            </Container>

            <Container header={<Header>Resource configuration</Header>}>
                <ColumnLayout columns={2}>
                    <SpaceBetween direction='vertical' size='xxl'>
                        <div>
                            <Box color='text-status-inactive'>Instance type</Box>
                            {formatDisplayText(
                                state.selectedTrainingJobDefinition?.ResourceConfig.InstanceType
                            )}
                        </div>

                        <div>
                            <Box color='text-status-inactive'>Instance Count</Box>
                            {formatDisplayText(
                                state.selectedTrainingJobDefinition?.ResourceConfig.InstanceCount
                            )}
                        </div>
                    </SpaceBetween>

                    <SpaceBetween direction='vertical' size='xxl'>
                        <div>
                            <Box color='text-status-inactive'>Additional volume size (GIB)</Box>
                            {formatDisplayText(
                                state.selectedTrainingJobDefinition?.ResourceConfig.VolumeSizeInGB
                            )}
                        </div>
                    </SpaceBetween>
                </ColumnLayout>
            </Container>

            <Container header={<Header>Stopping condition</Header>}>
                <div>
                    <Box color='text-status-inactive'>Maximum duration per training job</Box>
                    {formatDuration(
                        state.selectedTrainingJobDefinition?.StoppingCondition.MaxRuntimeInSeconds
                    )}
                </div>
            </Container>
        </SpaceBetween>
    );
}
