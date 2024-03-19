/*
 * Your use of this service is governed by the terms of the AWS Customer Agreement
 * (https://aws.amazon.com/agreement/) or other agreement with AWS governing your use of
 * AWS services. Each license to use the service, including any related source code component,
 * is valid for use associated with the related specific task-order contract as defined by
 * 10 U.S.C. 3401 and 41 U.S.C. 4101.
 *
 * Copyright 2023 Amazon.com, Inc. or its affiliates. All Rights Reserved. This is AWS Content
 * subject to the terms of the AWS Customer Agreement.
 */

import {
    AttributeEditor,
    FormField,
    Input,
    RadioGroup,
    Select,
    SpaceBetween,
    Table,
} from '@cloudscape-design/components';
import {
    CategoricalParameterRange,
    ContinuousParameterRange,
    HyperparameterScalingType,
    IntegerParameterRange,
    ITrainingJobDefinition,
    TrainingInputMode,
} from '../../hpo-job.model';
import { FormProps } from '../../../form-props';
import { ModifyMethod } from '../../../../../shared/validation/modify-method';
import { HyperparameterType, ML_ALGORITHMS, Algorithm } from '../../../algorithms';
import { enumToOptions } from '../../../../../shared/util/enum-utils';
import { useAppDispatch, useAppSelector } from '../../../../../config/store';
import { listBuiltinTrainingImages, selectBuiltinTrainingImages } from '../../../training/training-job.reducer';
import React, { Dispatch, SetStateAction, useEffect } from 'react';
import { LoadingStatus } from '../../../../../shared/loading-status';
import Condition from '../../../../../modules/condition';
import _ from 'lodash';

const algorithmNameRegex = new RegExp('/(.*):');

const algorithmOptions = ML_ALGORITHMS.filter(
    (algorithm) => algorithm.active && algorithm.tunable
).map((algorithm) => {
    return { value: algorithm.displayName };
});

export enum AlgorithmSource {
    BUILT_IN = 'built-in',
    CUSTOM = 'custom',
}

export type AlgorithmOptionsProps = {
    isHPO?: boolean;
    algorithmSource: AlgorithmSource;
    setAlgorithmSource: Dispatch<SetStateAction<AlgorithmSource>>;
} & FormProps<ITrainingJobDefinition>;

/**
 * Identifies the algorithm name from a training image ARN
 *
 * @param trainingImage Expects a training image ARN (e.g. 811284229777.dkr.ecr.us-east-1.amazonaws.com/blazingtext:1)
 */
export function getImageName (trainingImage: string | null): string | null {
    if (trainingImage) {
        const match = trainingImage.match(algorithmNameRegex);
        if (match && match.length > 1) {
            return match[1];
        }
    }
    
    return null;
}

export function AlgorithmOptions (props: AlgorithmOptionsProps) {
    const { item, setFields, touchFields, formErrors, isHPO, algorithmSource, setAlgorithmSource } =
        props;
    const trainingImages = useAppSelector(selectBuiltinTrainingImages);
    const dispatch = useAppDispatch();

    const applyAlgorithm = (algorithm : Algorithm) => {
        const hyperParameters = {} as any;
        const fieldsToSet = {};

        // Sets the default HyperParameter values for the algorithm
        const defaultStaticHyperParameters = {};
        const defaultHyperParameterRanges = {
            IntegerParameterRanges: [] as IntegerParameterRange[],
            CategoricalParameterRanges: [] as CategoricalParameterRange[],
            ContinuousParameterRanges: [] as ContinuousParameterRange[],
        };

        // HPO configuration of different hyper parameter types
        if (isHPO){
            algorithm.defaultHyperParameters.forEach((defaultParameter) => {
                const hyperParameter = _.cloneDeep(defaultParameter);

                switch (hyperParameter.type) {
                    case HyperparameterType.STATIC:
                        defaultStaticHyperParameters[hyperParameter.key] =
                            hyperParameter.value?.[0];
                        break;
                    case HyperparameterType.INTEGER:
                        defaultHyperParameterRanges.IntegerParameterRanges.push({
                            Name: hyperParameter.key,
                            MinValue: '',
                            MaxValue: '',
                            ScalingType:
                                hyperParameter.scalingType as HyperparameterScalingType,
                        });
                        break;
                    case HyperparameterType.CONTINUOUS:
                        defaultHyperParameterRanges.ContinuousParameterRanges.push({
                            Name: hyperParameter.key,
                            MinValue: '',
                            MaxValue: '',
                            ScalingType:
                                hyperParameter.scalingType as HyperparameterScalingType,
                        });
                        break;
                    case HyperparameterType.CATEGORICAL:
                        defaultHyperParameterRanges.CategoricalParameterRanges.push({
                            Name: hyperParameter.key,
                            Values: hyperParameter.value,
                        });
                        break;
                }
            });

            fieldsToSet['TuningObjective.MetricName'] = null;
            fieldsToSet['TuningObjective.Type'] = null;
            fieldsToSet['StaticHyperParameters'] = defaultStaticHyperParameters;
            fieldsToSet['HyperParameterRanges'] = defaultHyperParameterRanges;
        } else {
            // Set training job hyper parameters
            algorithm.defaultHyperParameters.forEach((defaultParameter) => {
                hyperParameters[defaultParameter.key] = defaultParameter.value?.[0];
            });

            fieldsToSet['HyperParameters'] = hyperParameters;
        }

        // Sets MetricDefinitions to the default for the algorithm
        fieldsToSet['AlgorithmSpecification.MetricDefinitions'] =
            algorithm.metadata.metricDefinitions.map((metric) => {
                return {
                    Name: metric.metricName,
                    Regex: metric.metricRegex,
                };
            });

        // Set image and name for display
        fieldsToSet['AlgorithmSpecification.TrainingImage'] =
            trainingImages.values[algorithm.name];
        fieldsToSet['AlgorithmSpecification.AlgorithmName'] = algorithm.displayName;

        setFields(fieldsToSet);
        touchFields(['HyperParameters'], ModifyMethod.Unset);
    };

    // on mount load images
    useEffect(() => {
        if (trainingImages.status === LoadingStatus.INITIAL) {
            dispatch(listBuiltinTrainingImages());
        }
    }, [dispatch, trainingImages.status]);

    // On initial render, checks if there is a pre-loaded training image to set the form accordingly
    useEffect(() => {
        if (item.AlgorithmSpecification.TrainingImage) {
            const imageName = getImageName(item.AlgorithmSpecification.TrainingImage);
            const algorithm = ML_ALGORITHMS.find((algorithm) => (algorithm.name === imageName && algorithm.active));

            // Check if the container is an active built-in algorithm
            if (algorithm) {
                setAlgorithmSource(AlgorithmSource.BUILT_IN);
                setFields({'AlgorithmSpecification.AlgorithmName' : algorithm.displayName});
            } else {
                // Otherwise this uses a custom ECR container
                setAlgorithmSource(AlgorithmSource.CUSTOM);

                // The training jobs page uses an AttributeEditor that requires this attribute to be an array
                if (!isHPO) {
                    // Convert hyperparameters into an array for display
                    const hyperParameterArray = [];
                    if (Object.keys(item.HyperParameters).length > 0) {
                        Object.keys(item.HyperParameters).forEach((key) => {
                            hyperParameterArray.push({
                                key: key,
                                value: item.HyperParameters[key],
                            });
                        });
                    }

                    setFields({ HyperParameters: hyperParameterArray });
                }
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SpaceBetween direction='vertical' size='l'>
            <FormField
                label='Algorithm Source'
                description='Use an Amazon SageMaker built-in algorithm, your own algorithm, or a third-party algorithm from AWS Marketplace.'
            >
                <RadioGroup
                    onChange={({ detail }) => {
                        setAlgorithmSource(
                            detail.value === AlgorithmSource.BUILT_IN
                                ? AlgorithmSource.BUILT_IN
                                : AlgorithmSource.CUSTOM
                        );
                        const fieldsToSet = {
                            'AlgorithmSpecification.TrainingImage': '',
                            'AlgorithmSpecification.MetricDefinitions': [],
                            'AlgorithmSpecification.AlgorithmName': '',
                        };
                        if (isHPO) {
                            fieldsToSet['StaticHyperParameters'] = [];
                            fieldsToSet['HyperParameterRanges'] = {
                                IntegerParameterRanges: [],
                                CategoricalParameterRanges: [],
                                ContinuousParameterRanges: [],
                            };
                        } else {
                            fieldsToSet['HyperParameters'] = [];
                        }
                        setFields(fieldsToSet);
                    }}
                    value={algorithmSource}
                    items={[
                        {
                            value: AlgorithmSource.BUILT_IN,
                            label: 'Amazon SageMaker built-in algorithm',
                        },
                        {
                            value: AlgorithmSource.CUSTOM,
                            label: 'Your own algorithm container in ECR',
                        },
                    ]}
                />
            </FormField>
            <Condition condition={algorithmSource === AlgorithmSource.BUILT_IN}>
                <FormField
                    label='Choose an algorithm'
                    description='Use an Amazon SageMaker built-in algorithm.'
                    errorText={formErrors.AlgorithmSpecification?.AlgorithmName}
                >
                    <Select
                        placeholder='Select an algorithm…'
                        selectedOption={
                            item.AlgorithmSpecification?.AlgorithmName
                                ? {
                                    value: item.AlgorithmSpecification?.AlgorithmName,
                                }
                                : null
                        }
                        options={algorithmOptions}
                        onChange={(event) => {
                            const algorithm = ML_ALGORITHMS.find(
                                (algorithm) =>
                                    algorithm.displayName === event.detail.selectedOption.value
                            );
                            if (algorithm) {
                                applyAlgorithm(algorithm);
                            }
                        }}
                        onBlur={() => touchFields(['AlgorithmSpecification.AlgorithmName'])}
                    />
                </FormField>
            </Condition>
            <Condition condition={algorithmSource === 'custom'}>
                <FormField
                    label='Container'
                    description='The registry path where the training image is stored in Amazon ECR'
                    errorText={formErrors.AlgorithmSpecification?.TrainingImage}
                >
                    <Input
                        value={item.AlgorithmSpecification?.TrainingImage || ''}
                        onChange={(event) =>
                            setFields({
                                'AlgorithmSpecification.TrainingImage': event.detail.value,
                            })
                        }
                        onBlur={() => touchFields(['AlgorithmSpecification.TrainingImage'])}
                    />
                </FormField>
            </Condition>
            <FormField
                label='Input mode'
                description='You can provide your training data as a file or pipe.'
            >
                <Select
                    selectedOption={
                        item.AlgorithmSpecification.TrainingInputMode
                            ? {
                                value: item.AlgorithmSpecification.TrainingInputMode,
                            }
                            : null
                    }
                    options={enumToOptions(TrainingInputMode)}
                    onChange={(event) =>
                        setFields({
                            'AlgorithmSpecification.TrainingInputMode':
                                event.detail.selectedOption.value,
                        })
                    }
                    onBlur={() => touchFields(['AlgorithmSpecification.TrainingInputMode'])}
                />
            </FormField>
            <FormField
                label='Metrics'
                description={
                    algorithmSource === AlgorithmSource.CUSTOM
                        ? 'Define the metrics you want to emit to CloudWatch metrics.'
                        : 'The algorithm you selected will publish the following metrics to CloudWatch metrics.'
                }
            >
                <Condition condition={algorithmSource === AlgorithmSource.CUSTOM}>
                    <AttributeEditor
                        onAddButtonClick={() =>
                            setFields({
                                'AlgorithmSpecification.MetricDefinitions': (
                                    item.AlgorithmSpecification?.MetricDefinitions || []
                                ).concat({
                                    Name: '',
                                    Regex: '',
                                }),
                            })
                        }
                        onRemoveButtonClick={({ detail: { itemIndex } }) => {
                            touchFields(
                                [`AlgorithmSpecification.MetricDefinitions[${itemIndex}]`],
                                ModifyMethod.Unset
                            );
                            const toRemove = {} as any;
                            toRemove[`AlgorithmSpecification.MetricDefinitions[${itemIndex}]`] =
                                true;
                            setFields(toRemove, ModifyMethod.Unset);
                        }}
                        items={item.AlgorithmSpecification?.MetricDefinitions}
                        addButtonText='Add metric'
                        definition={[
                            {
                                label: 'Metric name',
                                control: (item: any, itemIndex) => (
                                    <FormField
                                        errorText={
                                            formErrors.AlgorithmSpecification?.MetricDefinitions?.[
                                                itemIndex
                                            ]?.Name
                                        }
                                    >
                                        <Input
                                            autoFocus
                                            value={item.Name}
                                            onChange={({ detail }) => {
                                                const toChange = {} as any;
                                                toChange[
                                                    `AlgorithmSpecification.MetricDefinitions[${itemIndex}]`
                                                ] = {
                                                    Name: detail.value,
                                                };
                                                setFields(toChange, ModifyMethod.Merge);
                                            }}
                                            onBlur={() =>
                                                touchFields([
                                                    `AlgorithmSpecification.MetricDefinitions?[${itemIndex}].Name`,
                                                ])
                                            }
                                        />
                                    </FormField>
                                ),
                            },
                            {
                                label: 'Regex',
                                control: (item: any, itemIndex) => (
                                    <FormField
                                        errorText={
                                            formErrors.AlgorithmSpecification?.MetricDefinitions?.[
                                                itemIndex
                                            ]?.Regex
                                        }
                                    >
                                        <Input
                                            value={item.Regex}
                                            onChange={({ detail }) => {
                                                const toChange = {} as any;
                                                toChange[
                                                    `AlgorithmSpecification.MetricDefinitions[${itemIndex}]`
                                                ] = {
                                                    Regex: detail.value,
                                                };
                                                setFields(toChange, ModifyMethod.Merge);
                                            }}
                                            onBlur={() =>
                                                touchFields([
                                                    `AlgorithmSpecification.MetricDefinitions[${itemIndex}].Regex`,
                                                ])
                                            }
                                        />
                                    </FormField>
                                ),
                            },
                        ]}
                        removeButtonText='Remove'
                        empty='No metrics defined.'
                    />
                </Condition>
                <Condition condition={algorithmSource === AlgorithmSource.BUILT_IN}>
                    <Table
                        ariaLabels={{
                            tableLabel: 'Algorithm metrics table',
                        }}
                        variant='embedded'
                        trackBy='Name'
                        columnDefinitions={[
                            {
                                header: 'Metric name',
                                cell: (metric) => {
                                    return metric.Name;
                                },
                            },
                            {
                                header: 'Regex',
                                cell: (metric) => {
                                    return metric.Regex;
                                },
                            },
                        ]}
                        empty='No algorithm selected'
                        items={item.AlgorithmSpecification?.MetricDefinitions || []}
                    />
                </Condition>
            </FormField>
        </SpaceBetween>
    );
}

export default {
    AlgorithmOptions,
};
