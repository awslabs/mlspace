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

import React, { useState } from 'react';
import { Container, Header, SpaceBetween, Wizard } from '@cloudscape-design/components';
import {
    DatasetExtension,
    InputDataConfig,
    ITrainingJobDefinition,
    OutputDataConfig,
} from '../../hpo-job.model';
import { FormProps } from '../../../form-props';
import { ModifyMethod } from '../../../../../shared/validation/modify-method';
import { TrainingJobDefinitionName } from './training-job-definition-name';
import { AlgorithmOptions, AlgorithmSource } from './algorithm-options';
import {
    duplicateAttributeRefinement,
    issuesToErrors,
    scrollToInvalid,
} from '../../../../../shared/validation';
import { ObjectiveMetric } from './objective-metric';
import { InputDataConfiguration } from './input-data-configuration';
import { OutputDataConfiguration } from './output-data-configuration';
import { ConfigureResources } from './configure-resources';
import { HyperParameters } from './hyperparameters';
import _ from 'lodash';
import z from 'zod';
import { ML_ALGORITHMS } from '../../../algorithms';

export type TrainingJobDefinitionProps = FormProps<ITrainingJobDefinition> & {
    onSubmit(): void;
    onCancel(): void;
};

const formSchema = z.object({
    DefinitionName: z
        .string()
        .min(1, { message: 'Training job definition name is required' })
        .max(32)
        .regex(/^[a-zA-Z0-9-]*$/, {
            message: 'Name can only contain alphanumeric characters and hyphens (-)',
        }),
    TuningObjective: z.object({
        MetricName: z.string({
            required_error: 'Objective metric is required',
            invalid_type_error: 'Objective metric is required',
        }),
        Type: z.string({
            required_error: 'Objective metric type is required',
            invalid_type_error: 'Objective metric type is required',
        }),
    }),
    AlgorithmSpecification: z.object({
        TrainingInputMode: z.string(),
        TrainingImage: z.string().min(1, { message: 'Training image is required' }),
        AlgorithmName: z.string().nullable(),
        MetricDefinitions: z
            .array(
                z.object({
                    Name: z.string().min(1, { message: 'Empty Name not permitted.' }),
                    Regex: z.string().min(1, { message: 'Empty Regex not permitted.' }),
                })
            )
            .superRefine(duplicateAttributeRefinement('Name'))
            .optional(),
    }),
    ResourceConfig: z.object({
        InstanceType: z.string({ required_error: 'You must select an instance type.' }),
        InstanceCount: z.number().min(1),
        VolumeSizeInGB: z.number().gte(0),
    }),
    InputDataConfig: z
        .array(
            z.object({
                ChannelName: z
                    .string()
                    .min(1)
                    .max(32)
                    .regex(/^[a-zA-Z0-9-]*$/, {
                        message: 'Name can only contain alphanumeric characters and hyphens (-)',
                    }),
                DataSource: z.object({
                    S3DataSource: z.object({
                        S3Uri: z.string().startsWith('s3://'),
                    }),
                }),
                Dataset: z.object({
                    Name: z.string({
                        required_error:
                            'S3 location is required',
                    }),
                }),
            })
        )
        .superRefine(duplicateAttributeRefinement('ChannelName')),
    OutputDataConfig: z.object({
        S3OutputPath: z.string().startsWith('s3://'),
        Dataset: z.object({
            Name: z.string({
                required_error: 'S3 location is required',
            }),
        }),
    }),
});

export function TrainingJobDefinition (props: TrainingJobDefinitionProps) {
    const { item, setFields, onSubmit, onCancel } = props;
    const [algorithmSource, setAlgorithmSource] = useState(
        props.item.AlgorithmSpecification.AlgorithmName
            ? AlgorithmSource.BUILT_IN
            : AlgorithmSource.CUSTOM
    );

    const [state, setState] = React.useReducer(
        (state: any, action: { type: string; payload: any }) => {
            switch (action.type) {
                case 'touchFields': {
                    const touched = state.touched;
                    action.payload.fields.forEach((path: string) => {
                        switch (action.payload.method) {
                            case ModifyMethod.Unset:
                                _.unset(touched, path);
                                break;
                            case ModifyMethod.Set:
                            default:
                                _.set(touched, path, true);
                        }
                    });

                    return {
                        ...state,
                        touched,
                    };
                }
                case 'untouchFields': {
                    const touched = state.touched;
                    action.payload.forEach((path: string) => {
                        _.unset(touched, path);
                    });

                    return {
                        ...state,
                        touched,
                    };
                }
                case 'setFields': {
                    const newState = { ...state };
                    Object.entries(action.payload.fields).forEach((entry) => {
                        const [key, value] = entry;
                        switch (action.payload.method) {
                            case ModifyMethod.Unset:
                                _.unset(newState, `form.${key}`);
                                break;
                            case ModifyMethod.Set:
                            default:
                                _.set(newState, `form.${key}`, value);
                        }
                    });

                    return newState;
                }
                case 'updateState':
                    return {
                        ..._.merge(state, action.payload),
                    };
            }

            return state;
        },
        {
            activeStepIndex: 0,
            validateAll: false,
            touched: {} as any,
        }
    );

    const touchFields = (fields: string[], method = ModifyMethod.Default) => {
        setState({ type: 'touchFields', payload: { fields, method } });
    };

    let formErrors = {} as any;
    const parseResult = formSchema.safeParse(item);
    if (!parseResult.success) {
        formErrors = issuesToErrors(
            parseResult.error.issues,
            state.validateAll === true ? undefined : state.touched
        );
    }

    const hpoFormSchema = z
        .object({
            AlgorithmSpecification: z.object({
                AlgorithmName: z.any().optional(),
            }),
            HyperParameterRanges: z.object({
                IntegerParameterRanges: z.any(),
                CategoricalParameterRanges: z.any(),
            }),
            StaticHyperParameters: z.any(),
        })
        .superRefine((item, ctx) => {
            if (item.AlgorithmSpecification.AlgorithmName !== undefined) {
                const algorithm = ML_ALGORITHMS.find(
                    (algorithm) =>
                        algorithm.displayName === item.AlgorithmSpecification.AlgorithmName
                );
                if (algorithm !== undefined) {
                    Object.entries(item.StaticHyperParameters).forEach((entry) => {
                        const [key, value] = entry;
                        const hyperParameter = algorithm.defaultHyperParameters.find(
                            (hyperParameter) => hyperParameter.key === key
                        );
                        if (hyperParameter !== undefined) {
                            const parseResult = hyperParameter.zValidator?.safeParse(value);
                            if (parseResult?.success === false) {
                                ctx.addIssue({
                                    code: 'custom',
                                    path: ['hyperparameters', key],
                                    message: parseResult?.error.issues
                                        .map((issue) => issue.message)
                                        .reduce((previous, current) => `${previous}; ${current}`),
                                });
                            }
                        }
                    });

                    Object.values(item.HyperParameterRanges.IntegerParameterRanges).forEach(
                        (parameterRange: any) => {
                            const hyperParameter = algorithm.defaultHyperParameters.find(
                                (hyperParameter) => hyperParameter.key === parameterRange.Name
                            );
                            if (hyperParameter !== undefined) {
                                [parameterRange.MinValue, parameterRange.MaxValue].forEach(
                                    (value, index) => {
                                        // Only evalue the validator if:
                                        // - The field is required
                                        // - OR the field has a value
                                        // - OR this is the max field and the min field has a value
                                        // This evaluation avoids the issue where a blank value is evaluated as a 0 on a forced safeParse even for optional fields
                                        if (!hyperParameter.zValidator?.isOptional || value || (index === 1 && parameterRange.MinValue) ) {
                                            const parseResult =
                                            hyperParameter.zValidator?.safeParse(value);
                                            if (parseResult?.success === false) {
                                                ctx.addIssue({
                                                    code: 'custom',
                                                    path: ['hyperparameters', parameterRange.Name],
                                                    message:
                                                        parseResult?.error.issues
                                                            .map((issue) => issue.message)
                                                            .reduce(
                                                                (previous, current) =>
                                                                    `${previous}; ${current}`
                                                            ) +
                                                        ` (${index === 0 ? 'min value' : 'max value'})`,
                                                });
                                            }
                                        }
                                    }
                                );

                                if (parameterRange.MinValue && parameterRange.MaxValue) {
                                    if (
                                        parseFloat(parameterRange.MinValue) >
                                        parseFloat(parameterRange.MaxValue)
                                    ) {
                                        ctx.addIssue({
                                            code: 'custom',
                                            path: ['hyperparameters', parameterRange.Name],
                                            message: `Minimum value of ${parameterRange.Name} must be less than maximum value`,
                                        });
                                    }
                                }
                            }
                        }
                    );
                }
            }
        });

    const hpoParseResult = hpoFormSchema.safeParse(item);
    if (!hpoParseResult.success) {
        formErrors = _.merge(
            formErrors,
            issuesToErrors(
                hpoParseResult.error.issues,
                state.validateAll === true ? undefined : state.touched
            )
        );
    }

    const stepValidator = [
        ['DefinitionName', 'TuningObjective.MetricName', 'TuningObjective.Type', 'hyperparameters'],
        ['InputDataConfig', 'OutputDataConfig'],
        ['ResourceConfig'],
    ];

    function isStepValid (fields: string[], formErrors: any) {
        return fields.filter((field) => _.has(formErrors, field)).length === 0;
    }

    return (
        <Wizard
            onSubmit={() => {
                const parseResult = formSchema.safeParse(item);
                if (parseResult.success) {
                    onSubmit();
                } else {
                    setState({ type: 'updateState', payload: { validateAll: true } });
                }
            }}
            onCancel={onCancel}
            activeStepIndex={state.activeStepIndex}
            i18nStrings={{
                stepNumberLabel (stepNumber: number) {
                    return `Step ${stepNumber}`;
                },
                collapsedStepsLabel (stepNumber: number, stepsCount: number) {
                    return `Step ${stepNumber} of ${stepsCount}`;
                },
                cancelButton: 'Cancel',
                previousButton: 'Previous',
                nextButton: 'Next',
                submitButton: 'Create training job definition',
                navigationAriaLabel: 'Job definition steps',
            }}
            onNavigate={(event) => {
                switch (event.detail.reason) {
                    case 'step':
                    case 'previous':
                        setState({
                            type: 'updateState',
                            payload: { activeStepIndex: event.detail.requestedStepIndex },
                        });
                        break;
                    case 'next':
                        {
                            const parseResult = formSchema.safeParse(item);
                            const hpoParseResult = hpoFormSchema.safeParse(item);

                            if (parseResult.success && hpoParseResult.success) {
                                setState({
                                    type: 'updateState',
                                    payload: {
                                        activeStepIndex: event.detail.requestedStepIndex,
                                        validateAll: false,
                                    },
                                });
                            } else {
                                let formErrors = {} as any;

                                if (!parseResult.success) {
                                    formErrors = _.merge(
                                        formErrors,
                                        issuesToErrors(parseResult.error.issues)
                                    );
                                }

                                if (!hpoParseResult.success) {
                                    formErrors = _.merge(
                                        formErrors,
                                        issuesToErrors(hpoParseResult.error.issues)
                                    );
                                }

                                if (isStepValid(stepValidator[state.activeStepIndex], formErrors)) {
                                    setState({
                                        type: 'updateState',
                                        payload: {
                                            activeStepIndex: event.detail.requestedStepIndex,
                                            validateAll: false,
                                        },
                                    });
                                } else {
                                    setState({
                                        type: 'updateState',
                                        payload: { validateAll: true },
                                    });
                                }
                            }
                        }
                        break;
                }

                scrollToInvalid();
            }}
            steps={[
                {
                    title: 'Configure algorithm and parameters',
                    content: (
                        <SpaceBetween direction='vertical' size='l'>
                            <TrainingJobDefinitionName
                                item={item}
                                setFields={setFields}
                                touchFields={touchFields}
                                formErrors={formErrors}
                            />
                            <Container
                                header={
                                    <Header description='Use an Amazon SageMaker built-in algorithm or your own algorithm container from ECR.'>
                                        Algorithm options
                                    </Header>
                                }
                            >
                                <AlgorithmOptions
                                    item={item}
                                    setFields={setFields}
                                    touchFields={touchFields}
                                    formErrors={formErrors}
                                    algorithmSource={algorithmSource}
                                    setAlgorithmSource={setAlgorithmSource}
                                    isHPO={true}
                                />
                            </Container>
                            <ObjectiveMetric
                                item={item}
                                setFields={setFields}
                                touchFields={touchFields}
                                formErrors={formErrors}
                                algorithmSource={algorithmSource}
                            />
                            <HyperParameters
                                item={item}
                                setFields={setFields}
                                touchFields={touchFields}
                                formErrors={formErrors}
                                algorithmSource={algorithmSource}
                            />
                        </SpaceBetween>
                    ),
                },
                {
                    title: 'Define data input and output',
                    content: (
                        <SpaceBetween direction='vertical' size='l'>
                            <InputDataConfiguration
                                item={
                                    item.InputDataConfig as (InputDataConfig & DatasetExtension)[]
                                }
                                setFields={setFields}
                                touchFields={touchFields}
                                formErrors={formErrors}
                            />
                            <OutputDataConfiguration
                                item={item.OutputDataConfig as OutputDataConfig & DatasetExtension}
                                setFields={setFields}
                                touchFields={touchFields}
                                formErrors={formErrors}
                            />
                        </SpaceBetween>
                    ),
                },
                {
                    title: 'Configure resources',
                    content: (
                        <ConfigureResources {...{ item, setFields, touchFields, formErrors }} />
                    ),
                },
            ]}
        />
    );
}