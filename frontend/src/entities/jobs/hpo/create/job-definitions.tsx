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
    Link,
    SpaceBetween,
    Table,
} from '@cloudscape-design/components';
import { IHPOJob, ITrainingJobDefinition } from '../hpo-job.model';
import { FormProps } from '../../form-props';
import { useNavigate } from 'react-router-dom';
import { getImageName } from './training-definitions/algorithm-options';

export type JobDefinitionsProps = FormProps<IHPOJob> & {
    actions?: React.ReactNode;
};

export function JobDefinitions (props: JobDefinitionsProps) {
    const { item, setFields, formErrors } = props;
    const navigate = useNavigate();

    return (
        <Container
            header={
                <Grid gridDefinition={[{ colspan: 8 }, { colspan: 4 }]}>
                    <Header description='Choose one or more algorithms you want to use for hyperparameter tuning.'>
                        Training Job Definitions
                    </Header>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: 5 }}>
                        {props?.actions}
                    </div>
                </Grid>
            }
        >
            <Table
                ariaLabels={{
                    tableLabel: 'Training job definitions table',
                }}
                variant='embedded'
                columnDefinitions={[
                    {
                        header: 'Name',
                        cell: (jobDefinition: ITrainingJobDefinition) =>
                            jobDefinition?.DefinitionName,
                    },
                    {
                        header: 'Algorithm',
                        cell: (jobDefinition: ITrainingJobDefinition) => {
                            if (jobDefinition?.AlgorithmSpecification?.AlgorithmName) {
                                return jobDefinition.AlgorithmSpecification.AlgorithmName;
                            } else if (jobDefinition?.AlgorithmSpecification?.TrainingImage) {
                                return getImageName(jobDefinition.AlgorithmSpecification.TrainingImage);
                            } else {
                                return '-';
                            }

                        }

                    },
                    {
                        header: 'Instance type',
                        cell: (jobDefinition: ITrainingJobDefinition) =>
                            jobDefinition?.ResourceConfig?.InstanceType,
                    },
                    {
                        header: 'Instance count',
                        cell: (jobDefinition: ITrainingJobDefinition) =>
                            jobDefinition?.ResourceConfig?.InstanceCount,
                    },
                    {
                        header: 'Action',
                        cell: (jobDefinition: ITrainingJobDefinition) => (
                            <SpaceBetween direction='horizontal' size='s'>
                                <Link
                                    onFollow={() => {
                                        const index = item.TrainingJobDefinitions.findIndex(
                                            (definition) => definition === jobDefinition
                                        );
                                        navigate(`definition/${index}`);
                                    }}
                                >
                                    Edit
                                </Link>
                                <Link
                                    onFollow={() => {
                                        const newDefinition = JSON.parse(
                                            JSON.stringify(jobDefinition)
                                        );
                                        newDefinition.DefinitionName += '-copy';
                                        setFields({
                                            TrainingJobDefinitions: [
                                                ...item.TrainingJobDefinitions,
                                                newDefinition,
                                            ],
                                        });
                                    }}
                                >
                                    Clone
                                </Link>
                                <Link
                                    onFollow={() => {
                                        setFields({
                                            TrainingJobDefinitions:
                                                item.TrainingJobDefinitions.filter(
                                                    (e) => e !== jobDefinition
                                                ),
                                        });
                                        // todo figure out how to slice touched fields
                                    }}
                                >
                                    Remove
                                </Link>
                            </SpaceBetween>
                        ),
                    },
                ]}
                items={item.TrainingJobDefinitions}
            />

            <FormField errorText={formErrors?.TrainingJobDefinitions} />
        </Container>
    );
}
