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
import {
    Container,
    FormField,
    Input,
    SpaceBetween,
    Select,
    Grid,
    Button,
    Form,
    ContentLayout,
    Header,
    AttributeEditor,
} from '@cloudscape-design/components';
import { ML_ALGORITHMS, Algorithm, Hyperparameter } from '../../algorithms';
import { useAppDispatch } from '../../../../config/store';
import Condition from '../../../../modules/condition';
import { z } from 'zod';
import _ from 'lodash';
import { HyperparameterField } from '../../hyperparameter-field';
import { createTrainingJob } from '../../create.functions';
import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    duplicateAttributeRefinement,
    issuesToErrors,
    prefixedSetFields,
    prefixedTouchFields,
    scrollToInvalid,
} from '../../../../shared/validation';
import { ModifyMethod } from '../../../../shared/validation/modify-method';
import { enumToOptions } from '../../../../shared/util/enum-utils';
import {
    DatasetExtension,
    InputDataConfig,
} from '../../hpo/hpo-job.model';
import {
    getDuration,
    TimeUnit,
    durationToSeconds,
    getDate,
    getPaddedNumberString,
} from '../../../../shared/util/date-utils';
import { createTrainingJob as createTrainingJobThunk } from '../training-job.reducer';
import NotificationService from '../../../../shared/layout/notification/notification.service';
import { DocTitle, scrollToPageHeader } from '../../../../../src/shared/doc';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import { InstanceTypeSelector } from '../../../../shared/metadata/instance-type-dropdown';
import {
    AlgorithmOptions,
    AlgorithmSource,
} from '../../hpo/create/training-definitions/algorithm-options';
import { AttributeEditorSchema } from '../../../../modules/environment-variables/environment-variables';
import { NetworkSettings } from '../../hpo/create/training-definitions/network-settings';
import { InputDataConfiguration } from '../../hpo/create/training-definitions/input-data-configuration';
import { OutputDataConfiguration } from '../../hpo/create/training-definitions/output-data-configuration';
import { tryCreateDataset } from '../../../dataset/dataset.service';
import { generateNameConstraintText } from '../../../../shared/util/form-utils';
import { useUsername } from '../../../../shared/util/auth-utils';
import '../../../../shared/validation/helpers/uri';
import { datasetFromS3Uri } from '../../../../shared/util/dataset-utils';

const ALGORITHMS: { [key: string]: Algorithm } = {};
ML_ALGORITHMS.filter((algorithm) => algorithm.defaultHyperParameters.length > 0).map(
    (algorithm) => (ALGORITHMS[algorithm.name] = algorithm)
);

export default function TrainingJobCreate () {
    const { projectName } = useParams();
    const userName = useUsername();
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const navigate = useNavigate();
    const location = useLocation();
    const [algorithmSource, setAlgorithmSource] = useState(AlgorithmSource.BUILT_IN);

    DocTitle('Create Training Job');

    // The useReducer init param function is only executed once and not on every render cycle
    const initializer = () => {
        return {
            validateAll: false,
            form: location.state?.trainingJob
                ? cloneTrainingJob(location.state.trainingJob)
                : createTrainingJob(),
            touched: {},
            formSubmitting: false,
        };
    };

    const cloneTrainingJob = (trainingJobDetails) => {
        // The deep clone prevents issues with developer mode double invoking, though is probably slightly less efficient
        const clonedJob = _.cloneDeep(trainingJobDetails);

        // Update name to be unique
        // In development this will trigger twice. Alternative is a deep copy of the object, but isn't as efficient
        const date = getDate();
        clonedJob.TrainingJobName =
            `${clonedJob.TrainingJobName}-copy-` +
            `${getPaddedNumberString(date.getMonth() + 1, 2)}-` +
            `${getPaddedNumberString(date.getDate(), 2)}`;

        return clonedJob;
    };

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Training Jobs', href: `#/project/${projectName}/jobs/training` },
                {
                    text: 'Create training job',
                    href: `#/project/${projectName}/jobs/training/create `,
                },
            ])
        );

        scrollToPageHeader('h1', 'Create training job');

        // This should not run on any location update, so location is omitted from the dependencies intentionally
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, projectName]);

    const [state, setState] = React.useReducer(
        (state: any, action: { type: string; payload?: any }) => {
            switch (action.type) {
                case 'touchFields': {
                    const touched = state.touched;
                    action.payload.fields.forEach((path: string) => {
                        switch (action.payload.method) {
                            case ModifyMethod.Unset:
                                _.unset(touched, path);
                                break;
                            case ModifyMethod.Set:
                            case ModifyMethod.Default:
                            default:
                                _.set(touched, path, true);
                        }
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
                            case ModifyMethod.Merge:
                                _.merge(_.get(newState, `form.${key}`), value);
                                break;
                            case ModifyMethod.Set:
                            case ModifyMethod.Default:
                            default:
                                _.set(newState, `form.${key}`, value);
                        }
                    });

                    return newState;
                }
                case 'updateState':
                    return { ..._.merge(state, action.payload) };
            }

            return state;
        },
        null,
        initializer
    );

    const touchFields = (fields: string[], method: ModifyMethod = ModifyMethod.Default) => {
        setState({ type: 'touchFields', payload: { fields, method } });
    };
    const setFields = (
        fields: { [key: string]: any },
        method: ModifyMethod = ModifyMethod.Default
    ) => {
        setState({ type: 'setFields', payload: { fields, method } });
    };

    const formSchema = z.object({
        TrainingJobName: z
            .string()
            .min(1, { message: 'Job name is required' })
            .max(63)
            .regex(/^[a-zA-Z0-9-]*$/, {
                message: 'Name can only contain alphanumeric characters and hyphens (-)',
            }),
        AlgorithmSpecification: z.object({
            TrainingImage: z.string().min(1, { message: 'Training image is required' }),
            AlgorithmName: z.string({ required_error: 'Algorithm is required' }),
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
            InstanceType: z.string(),
            InstanceCount: z.number().gt(0),
            VolumeSizeInGB: z.number().gte(0),
        }),
        StoppingCondition: z.object({
            MaxRuntimeInSeconds: z.number().gt(0),
        }),
        InputDataConfig: z.array(
            z.object({
                ChannelName: z
                    .string()
                    .min(1)
                    .max(32)
                    .regex(/^[a-zA-Z0-9-]*$/, {
                        message: 'Name can only contain alphanumeric characters and hyphens (-)',
                    })
                    .superRefine((value, ctx) => {
                        if (
                            state.form.InputDataConfig.filter(
                                (inputDataConfig: any) => inputDataConfig.ChannelName === value
                            ).length > 1
                        ) {
                            ctx.addIssue({
                                code: 'custom',
                                message: 'Duplicate name',
                            });
                        }
                    }),
                DataSource: z.object({
                    S3DataSource: z.object({
                        S3Uri: z.string().s3Uri()
                    }),
                }),
            })
        ),
        OutputDataConfig: z.object({
            S3OutputPath: z.string().datasetPrefix(),
        }),
    });

    let formErrors = {} as any;
    const parseResult = formSchema.safeParse(state.form);
    if (!parseResult.success) {
        formErrors = issuesToErrors(
            parseResult.error.issues,
            state.validateAll === true ? undefined : state.touched
        );
    }

    const hyperParameterSchema = z.object({
        HyperParameters:
            algorithmSource === AlgorithmSource.CUSTOM
                ? AttributeEditorSchema
                : z.any().superRefine((hyperParameters, ctx) => {
                    const algorithm = ML_ALGORITHMS.find(
                        (algorithm) =>
                            algorithm.displayName ===
                              state.form.AlgorithmSpecification.AlgorithmName
                    );
                    if (algorithm !== undefined) {
                        algorithm.defaultHyperParameters.forEach((hyperParameter) => {
                            const parseResult = hyperParameter.zValidator?.safeParse(
                                hyperParameters[hyperParameter.key]
                            );
                            if (!parseResult?.success) {
                                parseResult?.error.issues.forEach((issue) => {
                                    ctx.addIssue({
                                        ...issue,
                                        path: [hyperParameter.key],
                                    });
                                });
                            }
                        });
                    }
                }),
    });

    const hyperParameterParseResult = hyperParameterSchema.safeParse(state.form);
    if (!hyperParameterParseResult.success) {
        formErrors = _.merge(
            formErrors,
            issuesToErrors(
                hyperParameterParseResult.error.issues,
                state.validateAll === true ? undefined : state.touched
            )
        );
    }

    const duration = getDuration(state.form.StoppingCondition.MaxRuntimeInSeconds!);

    // get ALGORITHMS into a more usable form
    function handleSubmit () {
        setState({ type: 'updateState', payload: { formSubmitting: true, validateAll: true } });

        const parseResult = formSchema.safeParse(state.form);
        if (parseResult.success) {
            if (Object.values(formErrors).length > 0 || Object.values(state.touched).length === 0) {
                setState({ type: 'updateState', payload: { formSubmitting: false } });
                scrollToInvalid();
            } else {
                const payload = JSON.parse(JSON.stringify(state.form));
                payload.ProjectName = projectName;
                payload.UserName = userName;
                if (algorithmSource === AlgorithmSource.CUSTOM) {
                    // Convert hyperparameters from array into map
                    const hyperParameterMap = {};
                    (state.form.HyperParameters || []).forEach((param) => {
                        hyperParameterMap[param.key] = param.value;
                    });
                    payload.HyperParameters = hyperParameterMap;
                } else {
                    // Can't override metrics for built-in algorithms
                    delete payload.AlgorithmSpecification.MetricDefinitions;
                }

                delete payload.OutputDataConfig.Dataset;
                payload.InputDataConfig.forEach(
                    (inputDataConfig: InputDataConfig & DatasetExtension) =>
                        delete inputDataConfig.Dataset
                );
                delete payload.AlgorithmSpecification.AlgorithmName;

                dispatch(createTrainingJobThunk(payload)).then((result: any) => {
                    setState({ type: 'updateState', payload: { formSubmitting: false } });

                    if (result.type.endsWith('/fulfilled')) {
                        notificationService.generateNotification(
                            `Successfully created training job with name ${payload.TrainingJobName}`,
                            'success'
                        );
                        if (result.payload?.DeletedMetricsDefinitions) {
                            notificationService.generateNotification(
                                'This training job leverages a built-in Amazon SageMaker algorithm. Metric definitions for these algorithms cannot be customized. The cloned training job was created using the default metric definitions for this algorithm. You can view the values in the details page of this new training job.',
                                'info'
                            );
                        }

                        const dataset = datasetFromS3Uri(state.form.OutputDataConfig.S3OutputPath);
                        if (dataset) {
                            dataset.description = `Dataset created as part of the Training job: ${state.form.TrainingJobName}`;
                            tryCreateDataset(dataset);
                        }
                        
                        navigate(
                            `/project/${projectName}/jobs/training/detail/${state.form.TrainingJobName}`
                        );
                    } else {
                        notificationService.generateNotification(
                            `Failed to create training job because: ${result.payload}`,
                            'error'
                        );
                    }
                });
            }
        } else {
            setState({
                type: 'updateState',
                payload: { validateAll: true, formSubmitting: false  },
            });
            scrollToInvalid();
        }
    }

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description='When you create a training job, Amazon SageMaker sets up the distributed compute cluster, performs the training, and deletes the cluster when training has completed. The resulting model artifacts are stored in the location you specified when you created the training job.'
                >
                    Create training job
                </Header>
            }
        >
            <Form
                actions={
                    <SpaceBetween direction='horizontal' size='xl'>
                        <Button
                            formAction='none'
                            variant='link'
                            onClick={() => {
                                navigate(`/project/${projectName}/jobs/training`, {
                                    state: { prevPath: window.location.hash },
                                });
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={state.formSubmitting}
                            variant='primary'
                            onClick={() => {
                                handleSubmit();
                            }}
                        >
                            Create training job
                        </Button>
                    </SpaceBetween>
                }
            >
                <SpaceBetween direction='vertical' size='s'>
                    <Container header={<h2>Job Settings</h2>}>
                        <SpaceBetween direction='vertical' size='l'>
                            <FormField
                                label='Job Name'
                                constraintText={generateNameConstraintText()}
                                errorText={formErrors.TrainingJobName}
                            >
                                <Input
                                    value={state.form.TrainingJobName!}
                                    onChange={(event) =>
                                        setFields({ TrainingJobName: event.detail.value })
                                    }
                                    disabled={state.formSubmitting}
                                    onBlur={() => touchFields(['TrainingJobName'])}
                                />
                            </FormField>
                            <AlgorithmOptions
                                item={state.form}
                                formErrors={formErrors}
                                setFields={setFields}
                                touchFields={touchFields}
                                algorithmSource={algorithmSource}
                                setAlgorithmSource={setAlgorithmSource}
                            />
                            <Grid
                                gridDefinition={[
                                    { colspan: { default: 12, xxs: 4 } },
                                    { colspan: { default: 12, xxs: 4 } },
                                    { colspan: { default: 12, xxs: 4 } },
                                ]}
                            >
                                <FormField
                                    label='Instance type'
                                    errorText={formErrors.ResourceConfig?.InstanceType}
                                >
                                    <InstanceTypeSelector
                                        selectedOption={{
                                            value: state.form.ResourceConfig.InstanceType,
                                        }}
                                        instanceTypeCategory='TrainingInstanceType'
                                        onChange={(event) =>
                                            setFields({
                                                'ResourceConfig.InstanceType':
                                                    event.detail.selectedOption.value,
                                            })
                                        }
                                        onBlur={() => touchFields(['ResourceConfig.InstanceType'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Instance Count'
                                    errorText={formErrors.ResourceConfig?.InstanceCount}
                                >
                                    <Input
                                        value={`${state.form.ResourceConfig?.InstanceCount}`}
                                        inputMode='numeric'
                                        type='number'
                                        onChange={(event) =>
                                            setFields({
                                                'ResourceConfig.InstanceCount':
                                                    Number(event.detail.value) > 1
                                                        ? Number(event.detail.value)
                                                        : 1,
                                            })
                                        }
                                        onBlur={() => touchFields(['ResourceConfig.InstanceCount'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Additional storage volume per instance (GB)'
                                    errorText={formErrors.ResourceConfig?.VolumeSizeInGB}
                                >
                                    <Input
                                        value={`${state.form.ResourceConfig.VolumeSizeInGB}`}
                                        inputMode='numeric'
                                        type='number'
                                        onChange={(event) =>
                                            setFields({
                                                'ResourceConfig.VolumeSizeInGB':
                                                    Number(event.detail.value) > 0
                                                        ? Number(event.detail.value)
                                                        : 0,
                                            })
                                        }
                                        onBlur={() =>
                                            touchFields(['ResourceConfig.VolumeSizeInGB'])
                                        }
                                    />
                                </FormField>
                            </Grid>

                            <Grid
                                gridDefinition={[
                                    { colspan: { default: 12, xxs: 4 } },
                                    { colspan: { default: 12, xxs: 4 } },
                                ]}
                            >
                                <FormField
                                    label='Maximum duration per training job'
                                    errorText={formErrors.StoppingCondition?.MaxRuntimeInSeconds}
                                >
                                    <Input
                                        value={String(duration.value)}
                                        inputMode='numeric'
                                        type='number'
                                        onChange={(event) =>
                                            setFields({
                                                'StoppingCondition.MaxRuntimeInSeconds':
                                                    durationToSeconds(
                                                        Number(event.detail.value) > 0
                                                            ? Number(event.detail.value)
                                                            : 1,
                                                        duration.unit
                                                    ),
                                            })
                                        }
                                    />
                                </FormField>
                                <FormField label='Time'>
                                    <Select
                                        selectedOption={{ value: duration.unit }}
                                        options={enumToOptions(TimeUnit)}
                                        onChange={(event) => {
                                            setFields({
                                                'StoppingCondition.MaxRuntimeInSeconds':
                                                    durationToSeconds(
                                                        duration.value,
                                                        TimeUnit[
                                                            event.detail.selectedOption.value?.toUpperCase() as keyof typeof TimeUnit
                                                        ]
                                                    ),
                                            });
                                        }}
                                    />
                                </FormField>
                            </Grid>
                            <NetworkSettings
                                item={state.form}
                                setFields={setFields}
                                touchFields={touchFields}
                                formErrors={formErrors}
                            />
                        </SpaceBetween>
                    </Container>

                    <Container
                        header={
                            <Header
                                variant='h2'
                                description={`You can use hyperparameters to finely control training. ${
                                    algorithmSource === AlgorithmSource.BUILT_IN
                                        ? 'We\'ve set default hyperparameters for the algorithm you\'ve chosen.'
                                        : 'Choose Add hyperparameter to get started.'
                                }`}
                            >
                                Hyperparameters
                            </Header>
                        }
                    >
                        <SpaceBetween direction='vertical' size='m'>
                            <Condition condition={algorithmSource === AlgorithmSource.BUILT_IN}>
                                <Condition
                                    condition={
                                        ML_ALGORITHMS.find(
                                            (algorithm) =>
                                                algorithm.displayName ===
                                                state.form.AlgorithmSpecification.AlgorithmName
                                        ) === undefined
                                    }
                                >
                                    <p>Choose a SageMaker algorithm to get started.</p>
                                </Condition>
                                <Condition
                                    condition={
                                        ML_ALGORITHMS.find(
                                            (algorithm) =>
                                                algorithm.displayName ===
                                                state.form.AlgorithmSpecification.AlgorithmName
                                        ) !== undefined
                                    }
                                >
                                    {ML_ALGORITHMS.find(
                                        (algorithm) =>
                                            algorithm.displayName ===
                                            state.form.AlgorithmSpecification.AlgorithmName
                                    )?.defaultHyperParameters.map((parameter: Hyperparameter) => {
                                        return (
                                            <HyperparameterField
                                                key={parameter.key}
                                                item={parameter}
                                                value={state.form.HyperParameters[parameter.key]}
                                                setFields={prefixedSetFields(
                                                    'HyperParameters',
                                                    setFields
                                                )}
                                                touchFields={prefixedTouchFields(
                                                    'HyperParameters',
                                                    touchFields
                                                )}
                                                formErrors={formErrors.HyperParameters}
                                            />
                                        );
                                    })}
                                </Condition>
                            </Condition>
                            <Condition condition={algorithmSource === AlgorithmSource.CUSTOM}>
                                <AttributeEditor
                                    onAddButtonClick={() =>
                                        setFields({
                                            HyperParameters: (
                                                state.form.HyperParameters || []
                                            ).concat({
                                                key: '',
                                                value: '',
                                            }),
                                        })
                                    }
                                    onRemoveButtonClick={({ detail: { itemIndex } }) => {
                                        touchFields(
                                            [`HyperParameters[${itemIndex}]`],
                                            ModifyMethod.Unset
                                        );
                                        const toRemove = {} as any;
                                        toRemove[`HyperParameters[${itemIndex}]`] = true;
                                        setFields(toRemove, ModifyMethod.Unset);
                                    }}
                                    items={state.form.HyperParameters}
                                    addButtonText='Add hyperparameter'
                                    definition={[
                                        {
                                            label: 'Key',
                                            control: (item: any, itemIndex) => (
                                                <FormField
                                                    errorText={
                                                        formErrors.HyperParameters?.[itemIndex]?.key
                                                    }
                                                >
                                                    <Input
                                                        autoFocus
                                                        value={item.key}
                                                        onChange={({ detail }) => {
                                                            const toChange = {} as any;
                                                            toChange[
                                                                `HyperParameters[${itemIndex}]`
                                                            ] = {
                                                                key: detail.value,
                                                            };
                                                            setFields(toChange, ModifyMethod.Merge);
                                                        }}
                                                        onBlur={() =>
                                                            touchFields([
                                                                `HyperParameters[${itemIndex}].key`,
                                                            ])
                                                        }
                                                    />
                                                </FormField>
                                            ),
                                        },
                                        {
                                            label: 'Value',
                                            control: (item: any, itemIndex) => (
                                                <FormField
                                                    errorText={
                                                        formErrors.HyperParameters?.[itemIndex]
                                                            ?.value
                                                    }
                                                >
                                                    <Input
                                                        value={item.value}
                                                        onChange={({ detail }) => {
                                                            const toChange = {} as any;
                                                            toChange[
                                                                `HyperParameters[${itemIndex}]`
                                                            ] = {
                                                                value: detail.value,
                                                            };
                                                            setFields(toChange, ModifyMethod.Merge);
                                                        }}
                                                        onBlur={() =>
                                                            touchFields([
                                                                `HyperParameters[${itemIndex}].value`,
                                                            ])
                                                        }
                                                    />
                                                </FormField>
                                            ),
                                        },
                                    ]}
                                    removeButtonText='Remove'
                                />
                            </Condition>
                        </SpaceBetween>
                    </Container>

                    <InputDataConfiguration
                        {...{
                            item: state.form.InputDataConfig,
                            setFields,
                            touchFields,
                            formErrors,
                        }}
                    />

                    <OutputDataConfiguration
                        {...{
                            item: state.form.OutputDataConfig,
                            setFields,
                            touchFields,
                            formErrors,
                        }}
                    />
                </SpaceBetween>
            </Form>
        </ContentLayout>
    );
}
