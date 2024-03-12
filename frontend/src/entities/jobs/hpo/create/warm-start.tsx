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
    Checkbox,
    Container,
    FormField,
    Header,
    Link,
    RadioGroup,
    Table as CloudscapeTable,
    SpaceBetween,
} from '@cloudscape-design/components';
import Condition from '../../../../modules/condition';
import { IHPOJob, WarmStartType } from '../hpo-job.model';
import { FormProps } from '../../form-props';
import { ModifyMethod } from '../../../../shared/validation/modify-method';
import { useAppSelector } from '../../../../config/store';
import { ITrainingJob } from '../../training/training-job.model';
import { formatDate } from '../../../../shared/util/date-utils';
import Table from '../../../../modules/table';
import Modal from '../../../../modules/modal';
import { useParams } from 'react-router-dom';
import {
    listTrainingJobs,
    clearTrainingJobs,
    loadingTrainingJobs,
} from '../../training/training-job.reducer';

export type WarmStartProps = FormProps<IHPOJob>;

export function WarmStart (props: WarmStartProps) {
    const { projectName } = useParams();
    const { item, setFields, formErrors } = props;

    const [state, setState] = React.useState({
        trainingJobs: [] as ITrainingJob[],
        showModal: false,
        selectedTrainingJobs: [] as ITrainingJob[],
    });
    const loadingAvailableTrainingJobs = useAppSelector(loadingTrainingJobs);

    const parentNames =
        item.WarmStartConfig?.ParentHyperParameterTuningJobs?.map(
            (parent) => parent.HyperParameterTuningJobName
        ) || [];

    const trainingRequestProps = {
        projectName,
    };
    return (
        <Container
            header={
                <Header
                    description={
                        'Use the results from previous tuning jobs to improve the performance of this tuning job.'
                    }
                >
                    Warm Start - <i>Optional</i>
                </Header>
            }
        >
            <Modal
                title='Add training job'
                onDismiss={() => setState({ ...state, showModal: false })}
                visible={state.showModal}
                dismissText='Cancel'
                confirmText='Save'
                onConfirm={() => {
                    setFields({
                        'WarmStartConfig.ParentHyperParameterTuningJobs': [
                            ...(item.WarmStartConfig?.ParentHyperParameterTuningJobs || []),
                            {
                                HyperParameterTuningJobName: String(
                                    state.selectedTrainingJobs[0].TrainingJobName
                                ),
                            },
                        ],
                    });
                    setState({ ...state, showModal: false });
                }}
            >
                <Table
                    variant='embedded'
                    tableName='Training job'
                    trackBy='TrainingJobArn'
                    tableType='single'
                    itemNameProperty='TrainingJobName'
                    selectItemsCallback={(trainingJob: ITrainingJob[]) => {
                        setState({ ...state, selectedTrainingJobs: trainingJob });
                    }}
                    allItems={state.trainingJobs}
                    loadingItems={loadingAvailableTrainingJobs}
                    loadingText='Loading available training jobs'
                    columnDefinitions={[
                        {
                            header: 'Name',
                            cell (item) {
                                return item.TrainingJobName;
                            },
                        },
                        {
                            header: 'Status',
                            cell (item) {
                                return item.TrainingJobStatus;
                            },
                        },
                        {
                            header: 'Creation time',
                            cell (item) {
                                return formatDate(item.CreationTime);
                            },
                        },
                    ]}
                    serverFetch={listTrainingJobs}
                    serverRequestProps={trainingRequestProps}
                    storeClear={clearTrainingJobs}
                />
            </Modal>
            <SpaceBetween direction='vertical' size='m'>
                <SpaceBetween direction='horizontal' size='xs'>
                    <Checkbox
                        checked={item?.WarmStartConfig !== undefined}
                        onChange={(event) => {
                            if (event.detail.checked) {
                                setFields({
                                    'WarmStartConfig.WarmStartType':
                                        WarmStartType.IdenticalDataAndAlgorithm,
                                });
                            } else {
                                setFields({ WarmStartConfig: true }, ModifyMethod.Unset);
                            }
                        }}
                    >
                        Enable warm start
                    </Checkbox>
                </SpaceBetween>

                <Condition condition={item.WarmStartConfig !== undefined}>
                    <SpaceBetween direction='vertical' size='l'>
                        <FormField label='Warm start type'>
                            <RadioGroup
                                value={
                                    item.WarmStartConfig?.WarmStartType ||
                                    'IdenticalDataAndAlgorithm'
                                }
                                items={[
                                    {
                                        label: 'Identical data and algorithm',
                                        value: 'IdenticalDataAndAlgorithm',
                                        description:
                                            'Your input data and objective metric must be the same as your parent tuning jobs.',
                                    },
                                    {
                                        label: 'Transfer learning',
                                        value: 'TransferLearning',
                                        description:
                                            'You may add additional data to your parent tuning jobs. The objective metric must remain the same.',
                                    },
                                ]}
                                onChange={(event) =>
                                    setFields({
                                        'WarmStartConfig.WarmStartType': event.detail.value,
                                    })
                                }
                            />
                        </FormField>

                        <SpaceBetween direction='vertical' size='s'>
                            <FormField
                                label='Parent hyperparameter tuning job(s)'
                                description='To improve this tuning job, use up to five previous hyperparameter tuning jobs and their training job results.'
                                errorText={
                                    formErrors?.WarmStartConfig?.ParentHyperParameterTuningJobs
                                }
                            ></FormField>
                            <CloudscapeTable
                                variant='embedded'
                                empty='No parent training jobs selected.'
                                items={state.trainingJobs.filter(
                                    (trainingJob) =>
                                        parentNames.indexOf(trainingJob.TrainingJobName!) > -1
                                )}
                                columnDefinitions={[
                                    {
                                        header: 'Job name',
                                        cell (item) {
                                            return item.TrainingJobName;
                                        },
                                    },
                                    {
                                        header: 'Algorithm',
                                        cell (item) {
                                            return item.AlgorithmSpecification?.TrainingImage;
                                        },
                                    },
                                    {
                                        header: 'Objective',
                                        cell (item) {
                                            return item.HyperParameters?._tuning_objective_metric;
                                        },
                                    },
                                    {
                                        header: 'Actions',
                                        cell (cellItem) {
                                            return (
                                                <SpaceBetween direction='horizontal' size='s'>
                                                    <Link
                                                        onFollow={() => {
                                                            setFields({
                                                                'WarmStartConfig.ParentHyperParameterTuningJobs':
                                                                    item.WarmStartConfig?.ParentHyperParameterTuningJobs.filter(
                                                                        (parent) =>
                                                                            parent.HyperParameterTuningJobName !==
                                                                            cellItem.TrainingJobName
                                                                    ),
                                                            });
                                                        }}
                                                    >
                                                        Remove
                                                    </Link>
                                                </SpaceBetween>
                                            );
                                        },
                                    },
                                ]}
                            />
                            <Condition condition={parentNames.length < 5}>
                                <Link onFollow={() => setState({ ...state, showModal: true })}>
                                    Add hyperparameter tuning job
                                </Link>
                            </Condition>
                        </SpaceBetween>
                    </SpaceBetween>
                </Condition>
            </SpaceBetween>
        </Container>
    );
}
