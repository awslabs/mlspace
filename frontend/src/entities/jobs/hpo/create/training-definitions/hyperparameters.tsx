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

import React, { useEffect, useState } from 'react';
import { FormProps } from '../../../form-props';
import { ModifyMethod } from '../../../../../shared/validation/modify-method';
import { ITrainingJobDefinition } from '../../hpo-job.model';
import {
    Box,
    Button,
    Container,
    FormField,
    Grid,
    Header,
    Input,
    Multiselect,
    Select,
    SelectProps,
    SpaceBetween,
    TokenGroup,
} from '@cloudscape-design/components';
import { Hyperparameter, HyperparameterType, ML_ALGORITHMS } from '../../../algorithms';
import { ConditionalWrapper } from '../../../../../modules/condition/condition';
import { AlgorithmSource } from './algorithm-options';

export type HyperparametersProps = {
    algorithmSource: AlgorithmSource;
} & FormProps<ITrainingJobDefinition>;
export function HyperParameters (props: HyperparametersProps) {
    const { algorithmSource, item, setFields, touchFields, formErrors } = props;
    const [hyperparameters, setHyperparameters] = useState([] as Hyperparameter[]);
    const [customParameterIndex, setCustomParameterIndex] = useState(0);

    const algorithm = ML_ALGORITHMS.find(
        (algorithm) => item.AlgorithmSpecification.AlgorithmName === algorithm.displayName
    );

    useEffect(() => {
        if (algorithmSource === AlgorithmSource.BUILT_IN) {
            setHyperparameters(
                algorithm?.defaultHyperParameters
                    ? (JSON.parse(
                        JSON.stringify(algorithm?.defaultHyperParameters)
                    ) as Hyperparameter[])
                    : []
            );
        } else if (algorithmSource === AlgorithmSource.CUSTOM) {
            const customHyperparameterBase = {
                value: [''],
                type: HyperparameterType.INTEGER,
                typeOptions: [
                    HyperparameterType.INTEGER,
                    HyperparameterType.STATIC,
                    HyperparameterType.CATEGORICAL,
                    HyperparameterType.CONTINUOUS,
                ],
                scalingType: 'Auto',
            };
            let customBaseParameters = Object.entries(item.StaticHyperParameters)
                .filter((hyperparameter) => hyperparameter !== null)
                .map(([key]) => {
                    return { key, ...customHyperparameterBase };
                });
            // Filtering out null as these are sparse arrays
            customBaseParameters = customBaseParameters.concat(
                Object.values(item.HyperParameterRanges!.IntegerParameterRanges)
                    .filter((hyperparameter) => hyperparameter !== null)
                    .map(({ Name }) => {
                        return { key: Name, ...customHyperparameterBase };
                    })
            );
            customBaseParameters = customBaseParameters.concat(
                Object.values(item.HyperParameterRanges!.ContinuousParameterRanges)
                    .filter((hyperparameter) => hyperparameter !== null)
                    .map(({ Name }) => {
                        return { key: Name, ...customHyperparameterBase };
                    })
            );
            customBaseParameters = customBaseParameters.concat(
                Object.values(item.HyperParameterRanges!.CategoricalParameterRanges)
                    .filter((hyperparameter) => hyperparameter !== null)
                    .map(({ Name }) => {
                        return { key: Name, ...customHyperparameterBase };
                    })
            );

            setCustomParameterIndex(customBaseParameters.length);
            setHyperparameters(customBaseParameters);
        }
        // We only care when the algorithmSource changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [algorithm, algorithmSource]);

    const description =
        algorithmSource === AlgorithmSource.BUILT_IN && !algorithm
            ? 'No algorithm selected.'
            : `To find the best training job, choose ranges of hyperparameters that hyperparameter tuning searches. To set a fixed value for a
hyperparameter, set the type to Static. ${
    algorithmSource === AlgorithmSource.BUILT_IN
        ? 'We\'ve set default hyperparameter ranges for the algorithm you\'ve chosen.'
        : ''
}`;

    // Update any parameters based on existing values - this can happen if we're editing or if we
    // advanced the wizard and then came back to the parameter definition step.
    const valueOrEmpty = (value) => {
        return value !== '' ? value : '';
    };
    Object.entries(item.StaticHyperParameters)
        .filter((hyperparameter) => hyperparameter !== null)
        .forEach((entry) => {
            const [key, value] = entry;
            const hyperparameter = hyperparameters?.find(
                (hyperparameter) => hyperparameter.key === key
            );
            if (hyperparameter !== undefined) {
                hyperparameter.value = [value];
                hyperparameter.type = HyperparameterType.STATIC;
            }
        });

    Object.values(item.HyperParameterRanges!.IntegerParameterRanges)
        .filter((hyperparameter) => hyperparameter !== null)
        .forEach((entry) => {
            const hyperparameter = hyperparameters?.find(
                (hyperparameter) => hyperparameter.key === entry.Name
            );
            if (hyperparameter !== undefined) {
                hyperparameter.value = [valueOrEmpty(entry.MinValue), valueOrEmpty(entry.MaxValue)];
                hyperparameter.type = HyperparameterType.INTEGER;
                hyperparameter.scalingType = entry.ScalingType;
            }
        });

    Object.values(item.HyperParameterRanges!.ContinuousParameterRanges)
        .filter((hyperparameter) => hyperparameter !== null)
        .forEach((entry) => {
            const hyperparameter = hyperparameters?.find(
                (hyperparameter) => hyperparameter.key === entry.Name
            );
            if (hyperparameter !== undefined) {
                hyperparameter.value = [valueOrEmpty(entry.MinValue), valueOrEmpty(entry.MaxValue)];
                hyperparameter.type = HyperparameterType.CONTINUOUS;
                hyperparameter.scalingType = entry.ScalingType;
            }
        });

    Object.values(item.HyperParameterRanges!.CategoricalParameterRanges)
        .filter((hyperparameter) => hyperparameter !== null)
        .forEach((entry) => {
            const hyperparameter = hyperparameters?.find(
                (hyperparameter) => hyperparameter.key === entry.Name
            );
            if (hyperparameter !== undefined) {
                hyperparameter.value = entry.Values;
                hyperparameter.type = HyperparameterType.CATEGORICAL;
            }
        });

    // Parameters are sparse arrays so we need to take that into account when getting the
    // index of the parameter to update
    const findParameterKey = (hyperparameter: Hyperparameter) => {
        switch (hyperparameter.type) {
            case HyperparameterType.STATIC:
                return hyperparameter.key;
            case HyperparameterType.INTEGER:
                return item.HyperParameterRanges!.IntegerParameterRanges.findIndex(
                    (x) => x && x.Name === hyperparameter.key
                );
            case HyperparameterType.CONTINUOUS:
                return item.HyperParameterRanges!.ContinuousParameterRanges.findIndex(
                    (x) => x && x.Name === hyperparameter.key
                );
            case HyperparameterType.CATEGORICAL:
                return item.HyperParameterRanges!.CategoricalParameterRanges.findIndex(
                    (x) => x && x.Name === hyperparameter.key
                );
        }
    };

    const removeParameter = (hyperparameter: Hyperparameter) => {
        const toRemove = {} as any;
        const parameterKey = findParameterKey(hyperparameter);

        switch (hyperparameter.type) {
            case HyperparameterType.STATIC:
                toRemove[`StaticHyperParameters.${parameterKey}`] = true;
                break;
            case HyperparameterType.INTEGER:
                toRemove[`HyperParameterRanges.IntegerParameterRanges[${parameterKey}]`] = true;
                break;
            case HyperparameterType.CONTINUOUS:
                toRemove[`HyperParameterRanges.ContinuousParameterRanges[${parameterKey}]`] = true;
                break;
            case HyperparameterType.CATEGORICAL:
                toRemove[`HyperParameterRanges.CategoricalParameterRanges[${parameterKey}]`] = true;
                break;
        }
        setFields(toRemove, ModifyMethod.Unset);
    };

    function changeType (hyperparameter: Hyperparameter, toType: HyperparameterType) {
        removeParameter(hyperparameter);
        const toAdd = {} as any;
        hyperparameter.type = toType;
        switch (toType) {
            case HyperparameterType.STATIC:
                hyperparameter.value = hyperparameter.value.slice(0, 1);
                toAdd[`StaticHyperParameters.${hyperparameter.key}`] =
                    hyperparameter.value?.[0];
                break;
            case HyperparameterType.INTEGER:
                hyperparameter.value = hyperparameter.value.slice(0, 1);
                toAdd['HyperParameterRanges.IntegerParameterRanges'] = [
                    ...item.HyperParameterRanges!.IntegerParameterRanges.filter(
                        (element) => element !== undefined
                    ),
                    {
                        Name: hyperparameter.key,
                        MinValue: '',
                        MaxValue: '',
                        ScalingType: hyperparameter.scalingType,
                    },
                ];
                break;
            case HyperparameterType.CONTINUOUS:
                hyperparameter.value = hyperparameter.value.slice(0, 1);
                toAdd['HyperParameterRanges.ContinuousParameterRanges'] = [
                    ...item.HyperParameterRanges!.ContinuousParameterRanges.filter(
                        (element) => element !== undefined
                    ),
                    {
                        Name: hyperparameter.key,
                        MinValue: '',
                        MaxValue: '',
                        ScalingType: hyperparameter.scalingType,
                    },
                ];
                break;
            case HyperparameterType.CATEGORICAL:
                hyperparameter.value = hyperparameter.value.slice(0, 1);
                toAdd['HyperParameterRanges.CategoricalParameterRanges'] = [
                    ...item.HyperParameterRanges!.CategoricalParameterRanges.filter(
                        (element) => element !== undefined
                    ),
                    {
                        Name: hyperparameter.key,
                        Values: [],
                    },
                ];
                break;
        }

        setFields(toAdd);
    }

    const renameParameter = (hyperparameter: Hyperparameter, newName: string) => {
        removeParameter(hyperparameter);
        hyperparameter.key = newName;
        switch (hyperparameter.type) {
            case HyperparameterType.STATIC:
                return setFields(buildParameterUpdateRequest(hyperparameter, hyperparameter.key));
            case HyperparameterType.INTEGER:
                return setFields(
                    buildParameterUpdateRequest(
                        hyperparameter,
                        (item.HyperParameterRanges?.IntegerParameterRanges || []).length
                    )
                );
            case HyperparameterType.CONTINUOUS:
                return setFields(
                    buildParameterUpdateRequest(
                        hyperparameter,
                        (item.HyperParameterRanges?.ContinuousParameterRanges || []).length
                    )
                );
            case HyperparameterType.CATEGORICAL:
                return setFields(
                    buildParameterUpdateRequest(
                        hyperparameter,
                        (item.HyperParameterRanges?.CategoricalParameterRanges || []).length
                    )
                );
        }
    };

    const buildParameterUpdateRequest = (
        hyperparameter: Hyperparameter,
        parameterKey: string | number
    ) => {
        const toAdd = {} as any;
        switch (hyperparameter.type) {
            case HyperparameterType.STATIC:
                toAdd[`StaticHyperParameters.${parameterKey}`] = hyperparameter.value?.[0];
                break;
            case HyperparameterType.INTEGER:
                toAdd[`HyperParameterRanges.IntegerParameterRanges[${parameterKey}]`] = {
                    Name: hyperparameter.key,
                    MinValue: hyperparameter.value?.[0],
                    MaxValue: hyperparameter.value?.[1],
                    ScalingType: hyperparameter.scalingType,
                };
                break;
            case HyperparameterType.CONTINUOUS:
                toAdd[`HyperParameterRanges.ContinuousParameterRanges[${parameterKey}]`] = {
                    Name: hyperparameter.key,
                    MinValue: hyperparameter.value?.[0],
                    MaxValue: hyperparameter.value?.[1],
                    ScalingType: hyperparameter.scalingType,
                };
                break;
            case HyperparameterType.CATEGORICAL:
                toAdd[`HyperParameterRanges.CategoricalParameterRanges[${parameterKey}]`] = {
                    Name: hyperparameter.key,
                    Values: hyperparameter.value,
                };
                break;
        }
        return toAdd;
    };

    const updateParameter = (hyperparameter: Hyperparameter) => {
        setFields(buildParameterUpdateRequest(hyperparameter, findParameterKey(hyperparameter)));
    };

    const customParameterWrapper = (condition: boolean, children: any, parameterIndex: number) => {
        if (condition) {
            return (
                <Grid
                    gridDefinition={[
                        { colspan: { default: 12, xs: 10 } },
                        { colspan: { default: 12, xs: 2 } },
                    ]}
                >
                    {children}
                    <Box padding={{ top: 'xl' }}>
                        <Button
                            onClick={() => {
                                // Remove from the parent model
                                removeParameter(hyperparameters[parameterIndex]);
                                // Remove from the local state
                                setHyperparameters(
                                    hyperparameters.filter((e, index) => index !== parameterIndex)
                                );
                            }}
                        >
                            Remove
                        </Button>
                    </Box>
                </Grid>
            );
        }
        return children;
    };

    return (
        <Container
            header={<Header description={description}>Hyperparameter configuration</Header>}
            footer={
                algorithmSource === AlgorithmSource.CUSTOM ? (
                    <Button
                        onClick={() => {
                            // Custom parameter index needs to be unique. we can't use length or anything similar
                            // or we'll end up overwriting parameters. This is only an issue for parameters
                            // added during this form interaction
                            setCustomParameterIndex(customParameterIndex + 1);
                            // Add a "base" parameter so the parameter appears in the UI
                            setHyperparameters(
                                (hyperparameters || []).concat({
                                    key: `custom-v-${customParameterIndex}`,
                                    value: [''],
                                    type: HyperparameterType.INTEGER,
                                    typeOptions: [
                                        HyperparameterType.INTEGER,
                                        HyperparameterType.STATIC,
                                        HyperparameterType.CATEGORICAL,
                                        HyperparameterType.CONTINUOUS,
                                    ],
                                    scalingType: 'Auto',
                                })
                            );
                            // Add to the actual parent model
                            const toAdd = {} as any;
                            toAdd[
                                `HyperParameterRanges.IntegerParameterRanges[${customParameterIndex}]`
                            ] = {
                                Name: `custom-v-${customParameterIndex}`,
                                MinValue: '',
                                MaxValue: '',
                                ScalingType: 'Auto',
                            };
                            setFields(toAdd);
                        }}
                    >
                        Add tuning variable
                    </Button>
                ) : undefined
            }
        >
            {hyperparameters?.map((hyperparameter, index) => {
                return (
                    <ConditionalWrapper
                        key={`hpo-field-${index}`}
                        condition={algorithmSource === AlgorithmSource.CUSTOM}
                        wrapper={customParameterWrapper}
                        data={index}
                    >
                        <HyperParameterField
                            item={hyperparameter}
                            touchFields={touchFields}
                            updateParameter={updateParameter}
                            renameParameter={renameParameter}
                            changeType={changeType}
                            formErrors={formErrors}
                            isCustom={algorithmSource === AlgorithmSource.CUSTOM}
                        />
                    </ConditionalWrapper>
                );
            })}
        </Container>
    );
}

export type HyperParameterFieldProps = Omit<FormProps<Hyperparameter>, 'setFields'> & {
    changeType(hyperparameter: Hyperparameter, toType: HyperparameterType): void;
    updateParameter(hyperparameter: Hyperparameter): void;
    renameParameter(hyperparameter: Hyperparameter, newName: string): void;
    isCustom: boolean;
};

export function HyperParameterField (props: HyperParameterFieldProps) {
    const { item, formErrors, changeType, updateParameter, renameParameter, isCustom } = props;

    const disabled = !isCustom && item.typeOptions.length === 1 ? true : false;
    const typeOptions = item.typeOptions.map((typeOption) => {
        return { value: typeOption };
    });

    const scalingTypeOptions: SelectProps.Option[] = [];
    if (item.type === HyperparameterType.INTEGER || item.type === HyperparameterType.CONTINUOUS) {
        scalingTypeOptions.push({ value: 'Auto' }, { value: 'Linear' }, { value: 'Logarithmic' });
        if (item.type === HyperparameterType.CONTINUOUS) {
            scalingTypeOptions.push({ value: 'ReverseLogarithmic' });
        }
    }
    let scalingType = <span>-</span>;
    if (scalingTypeOptions.length > 0) {
        scalingType = (
            <Select
                selectedOption={{ value: item.scalingType }}
                options={scalingTypeOptions}
                ariaLabel={`${item.key} Scaling type`}
                selectedAriaLabel='Selected'
                onChange={(event) => {
                    item.scalingType = event.detail.selectedOption.value;
                    updateParameter(item);
                }}
            />
        );
    }

    let valueLabel = '';
    switch (item.type) {
        case HyperparameterType.CATEGORICAL:
            valueLabel = 'Values';
            break;
        case HyperparameterType.CONTINUOUS:
        case HyperparameterType.INTEGER:
            valueLabel = 'Range';
            break;
        default:
            valueLabel = 'Value';
            break;
    }

    return (
        <Grid
            gridDefinition={[
                { colspan: { default: 12, xs: 3 } },
                { colspan: { default: 12, xs: 2 } },
                { colspan: { default: 12, xs: 2 } },
                { colspan: { default: 12, xs: 5 } },
            ]}
        >
            <FormField label='Name'>
                <Input
                    disabled={!isCustom}
                    onChange={(event) => {
                        // If the key is changing we need to "remove" the old parameter
                        renameParameter(item, event.detail.value);
                    }}
                    value={item.key}
                />
            </FormField>
            <FormField label='Type'>
                <Select
                    disabled={disabled}
                    selectedOption={{ value: item.type }}
                    options={typeOptions}
                    selectedAriaLabel='Selected'
                    onChange={(event) => {
                        changeType(
                            item,
                            HyperparameterType[
                                event.detail.selectedOption.value?.toUpperCase() as keyof typeof HyperparameterType
                            ]
                        );
                    }}
                />
            </FormField>
            <FormField label='Scaling Type'>{scalingType}</FormField>

            <FormField label={valueLabel} errorText={formErrors?.hyperparameters?.[item.key]}>
                <HyperParameterFieldValue key={`hpo-field-value-${item.key}`} {...props} />
            </FormField>
        </Grid>
    );
}

export type HyperParameterFieldValueProps = Omit<FormProps<Hyperparameter>, 'setFields'> & {
    updateParameter(hyperparameter: Hyperparameter): void;
    isCustom: boolean;
};
export function HyperParameterFieldValue (props: HyperParameterFieldValueProps) {
    const { isCustom, item, touchFields, updateParameter } = props;
    const [categoryValue, setCategoryValue] = useState('');
    let inputElem = <></>;
    if (item.type === HyperparameterType.STATIC) {
        if (item.options) {
            if (item.commaSeparatedList === true) {
                inputElem = (
                    <Multiselect
                        selectedOptions={item.value?.[0]?.split(',').map((value) => ({ value, label: value }))}
                        options={item.options?.map(String).filter((s) => s.trim().length > 0).map((value) => ({ value }))}
                        onChange={(event) => {
                            item.value = [event.detail.selectedOptions.map((option) => option.value).join(',')];
                            updateParameter(item);
                            touchFields([`hyperparameters.${item.key}`]);
                        }}
                        onBlur={() => touchFields([item.key])}
                        data-cy='hpo-value-multiselect'
                    />
                );
            } else {
                inputElem = (
                    <Select
                        selectedOption={{ value: item.value?.[0] }}
                        options={item.options?.map((option) => {
                            return { value: String(option) };
                        })}
                        selectedAriaLabel='Selected'
                        onChange={(event) => {
                            item.value = [event.detail.selectedOption.value!];
                            updateParameter(item);
                            touchFields([`hyperparameters.${item.key}`]);
                        }}
                    />
                );
            }
        } else {
            inputElem = (
                <Input
                    value={item.value?.[0]}
                    onChange={(event) => {
                        item.value = [event.detail.value];
                        updateParameter(item);
                    }}
                    onBlur={() => [touchFields([`hyperparameters.${item.key}`])]}
                />
            );
        }
    } else if (
        item.type === HyperparameterType.INTEGER ||
        item.type === HyperparameterType.CONTINUOUS
    ) {
        inputElem = (
            <SpaceBetween direction='horizontal' size='xxs'>
                <div style={{ width: '140px' }}>
                    <Input
                        value={item.value?.[0]}
                        ariaLabel={`${item.key} minimum`}
                        onChange={(event) => {
                            item.value = [event.detail.value, item.value?.[1]];
                            updateParameter(item);
                        }}
                        onBlur={() => [touchFields([`hyperparameters.${item.key}`])]}
                    />
                </div>
                <span>-</span>
                <div style={{ width: '140px' }}>
                    <Input
                        value={item.value?.[1]}
                        ariaLabel={`${item.key} maximum`}
                        onChange={(event) => {
                            item.value = [item.value?.[0], event.detail.value];
                            updateParameter(item);
                        }}
                        onBlur={() => [touchFields([`hyperparameters.${item.key}`])]}
                    />
                </div>
            </SpaceBetween>
        );
    } else if (item.type === HyperparameterType.CATEGORICAL) {
        if (isCustom) {
            inputElem = (
                <>
                    <Input
                        ariaLabel={`${item.key} category value`}
                        onKeyDown={(e) => {
                            if (e.detail.keyCode === 13) {
                                item.value.push(categoryValue);
                                touchFields([`hyperparameters.${item.key}`]);
                                setCategoryValue('');
                            }
                        }}
                        onChange={(e) => {
                            setCategoryValue(e.detail.value);
                        }}
                        value={categoryValue}
                    ></Input>
                    <TokenGroup
                        onDismiss={({ detail: { itemIndex } }) => {
                            delete item.value[itemIndex];
                            updateParameter(item);
                            touchFields([`hyperparameters.${item.key}`]);
                        }}
                        items={item.value.map((option) => {
                            return {
                                label: String(option),
                                dismissLabel: `Remove ${String(option)}`,
                                value: option,
                            };
                        })}
                    />
                </>
            );
        } else {
            inputElem = (
                <Multiselect
                    selectedOptions={
                        item.value.map((option) => {
                            return { value: String(option), label: String(option) };
                        }) || null
                    }
                    options={item.options?.map((option) => {
                        return { value: String(option), label: String(option) };
                    })}
                    selectedAriaLabel='Selected'
                    deselectAriaLabel={(e) => `Remove ${e.label}`}
                    onChange={(event) => {
                        item.value = event.detail.selectedOptions.map((option) => option.value!);
                        updateParameter(item);
                        touchFields([`hyperparameters.${item.key}`]);
                    }}
                    data-cy='hpo-categorical-multiselect'
                />
            );
        }
    }

    return inputElem;
}
