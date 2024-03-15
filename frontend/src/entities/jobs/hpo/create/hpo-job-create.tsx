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

import React, { useEffect } from 'react';
import { Button, Wizard } from '@cloudscape-design/components';
import { Route, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../../../config/store';
import {
    DatasetExtension,
    IHPOJob,
    InputDataConfig,
    ITrainingJobDefinition,
    OutputDataConfig
} from '../hpo-job.model';
import { issuesToErrors, scrollToInvalid } from '../../../../shared/validation';
import { HPOJobSettings } from './hpo-job-settings';
import { JobDefinitions } from './job-definitions';
import ErrorBoundaryRoutes from '../../../../shared/error/error-boundary-routes';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { ModifyMethod } from '../../../../shared/validation/modify-method';
import { createHPOJob, createTrainingDefinition } from '../../create.functions';
import { ReviewAndCreate } from './review-and-create';
import z from 'zod';
import _ from 'lodash';
import { createHPOJobThunk, CreateHPOJobThunkPayload } from '../hpo-job.reducer';
import { ConfigureTuningJobResources } from './configure-tuning-job-resources';
import { EditTrainingJobDefinition } from './edit-training-job-definition';
import { useAuth } from 'react-oidc-context';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import NotificationService from '../../../../shared/layout/notification/notification.service';
import { DocTitle, scrollToPageHeader } from '../../../../../src/shared/doc';
import { getDate, getPaddedNumberString } from '../../../../shared/util/date-utils';
import { ML_ALGORITHMS } from '../../algorithms';
import { getImageName } from './training-definitions/algorithm-options';

export type HPOJobCreateState = {
    editingJobDefinition: any;
    validateAll: boolean;
    form: IHPOJob;
    touched: any;
    formSubmitting: boolean;
    activeStepIndex: number;
};

export function HPOJobCreate () {
    const navigate = useNavigate();
    const currentLocation = useLocation();
    const { projectName } = useParams();
    const auth = useAuth();
    const userName = auth.user!.profile.preferred_username;
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);

    DocTitle('Create HPO Jobs');

    // The useReducer init param function is only executed once and not on every render cycle
    const initializer = () => {
        return {
            editingJobDefinition: null,
            validateAll: false,
            form: currentLocation.state?.hpoTrainingJob
                ? cloneHpoJob(currentLocation.state.hpoTrainingJob)
                : createHPOJob(),
            touched: {},
            formSubmitting: false,
            activeStepIndex: 0,
        };
    };

    const cloneHpoJob = (hpoJobState) => {
        // The merge uses the default HPO job to fill any gaps
        const clonedJob = _.merge(createHPOJob(), _.cloneDeep(hpoJobState));

        // Convert a single training job definition into the HPO format
        if (clonedJob.TrainingJobDefinition && (!clonedJob.TrainingJobDefinitions || clonedJob.TrainingJobDefinitions.length === 0)) {
            // If there are parameter ranges, then they need to be moved to the trainingJobDefinition
            // Performing a merge in case there are also some ParameterRanges attached to the trainingJobDefinition already
            if (clonedJob.HyperParameterTuningJobConfig.ParameterRanges) {
                clonedJob.TrainingJobDefinition.HyperParameterRanges =
                    _.merge(clonedJob.HyperParameterTuningJobConfig.ParameterRanges,
                        (clonedJob.TrainingJobDefinitions.HyperParameterRanges || {})
                    );
                // ParameterRanges should be attached to the training job definitions when using TrainingJobDefinitions
                delete clonedJob.HyperParameterTuningJobConfig.ParameterRanges;
            }

            // Migrate TrainingJobDefinition to the TrainingJobDefinitions array
            // We prefer TrainingJobDefinitions for standardization of processing
            clonedJob.TrainingJobDefinitions = [clonedJob.TrainingJobDefinition] as ITrainingJobDefinition[];
            delete clonedJob.TrainingJobDefinition;
        }

        // Configure elements that should be set before the job-definitions page
        clonedJob.TrainingJobDefinitions.forEach((trainingJobDefinition, index) => {
            // If there isn't a TuningObjective, use the HPO job's tuning objective by default
            // This goes first so an empty TuningObjective isn't added with the default merge below
            if (!trainingJobDefinition.TuningObjective && clonedJob.HyperParameterTuningJobConfig?.HyperParameterTuningJobObjective){
                trainingJobDefinition.TuningObjective = _.cloneDeep(clonedJob.HyperParameterTuningJobConfig.HyperParameterTuningJobObjective);
                // Eliminate the tuning job objective since it shouldn't be used when using TrainingJobDefinitions
                delete clonedJob.HyperParameterTuningJobConfig.HyperParameterTuningJobObjective;
            }

            // Merge with a new/fresh training job definition to fill out empty fields with defaults
            trainingJobDefinition = _.merge(createTrainingDefinition(), _.cloneDeep(trainingJobDefinition));
            // Since we have created a new object, update the reference in the TrainingJobDefinitions
            clonedJob.TrainingJobDefinitions[index] = trainingJobDefinition;

            // Clear the default datasets as this isn't calibrated for cloning jobs until input-data-configuration.tsx and output-data-configuration.tsx
            // This is set during the merge to an incorrect dataset of { Type: 'global' }, which is undesirable
            // Datasets aren't needed unless the user wants to modify a trainingJobDefinition
            delete trainingJobDefinition.InputDataConfig[0].Dataset;
            delete trainingJobDefinition.OutputDataConfig.Dataset;

            // Assign a default name for the training job definition if there isn't one
            if (_.isEmpty(trainingJobDefinition.DefinitionName)){
                trainingJobDefinition.DefinitionName = `TrainingJobDefinition-${index + 1}`;
            }

            // Identifies the algorithm name for each training definition
            const algorithm = ML_ALGORITHMS.find(
                (algorithm) => {
                    // Doesn't matter if the algorithm is active since only the name will be used for display
                    return algorithm.name === getImageName(trainingJobDefinition.AlgorithmSpecification.TrainingImage);
                }
            );
            if (algorithm) {
                trainingJobDefinition.AlgorithmSpecification.AlgorithmName = algorithm.displayName;
            }

            // This is an artifact of cloning jobs and shouldn't exist on a new job. It will cause errors if not removed
            if (trainingJobDefinition.StaticHyperParameters?._tuning_objective_metric) {
                delete trainingJobDefinition.StaticHyperParameters._tuning_objective_metric;
            }
        });

        // Update HPO job name to be unique
        const date = getDate();
        clonedJob.HyperParameterTuningJobName =
            `${clonedJob.HyperParameterTuningJobName}-copy-` +
            `${getPaddedNumberString(date.getMonth() + 1, 2)}-` +
            `${getPaddedNumberString(date.getDate(), 2)}`;

        return clonedJob;
    };

    const [state, setState] = React.useReducer(
        (state: HPOJobCreateState, action: { type: string; payload?: any }): HPOJobCreateState => {
            switch (action.type) {
                case 'touchFields': {
                    const touched = state.touched;
                    action.payload.fields.forEach((path: string) => {
                        if (action.payload.method === ModifyMethod.Default) {
                            _.set(touched, path, true);
                        } else if (action.payload.method === ModifyMethod.Unset) {
                            _.unset(touched, path);
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
                        if (action.payload.method === ModifyMethod.Default) {
                            _.set(newState, `form.${key}`, value);
                        } else if (action.payload.method === ModifyMethod.Unset) {
                            _.unset(newState, `form.${key}`);
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

    useEffect(() => {
        if (window.location.toString().match(/\/create$/)) {
            dispatch(
                setBreadcrumbs([
                    getBase(projectName),
                    {
                        text: 'HPO Jobs',
                        href: `#/project/${projectName}/jobs/hpo`,
                    },
                    {
                        text: 'Create',
                        href: `#/project/${projectName}/jobs/hpo/create`,
                    },
                ])
            );
        }

        scrollToPageHeader('h1', 'Create hyperparameter tuning job');
    }, [dispatch, projectName]);

    const formSchema = z.object({
        HyperParameterTuningJobName: z
            .string()
            .min(1, { message: 'Tuning job name is required' })
            .max(32)
            .regex(/^[a-zA-Z0-9-]*$/, {
                message: 'Name can only contain alphanumeric characters and hyphens (-)',
            }),
        TrainingJobDefinitions: z
            .array(z.object({}))
            .min(1, { message: 'At least one training job definition must be defined.' }),
        HyperParameterTuningJobConfig: z.object({
            ResourceLimits: z.object({
                MaxParallelTrainingJobs: z.number().min(1),
                MaxNumberOfTrainingJobs: z.number().min(1),
            }),
        }),
        WarmStartConfig: z
            .object({
                ParentHyperParameterTuningJobs: z
                    .array(z.object({}), {
                        required_error: 'At least one parent training job is required.',
                    })
                    .min(1)
                    .max(5),
            })
            .optional(),
    });

    let formErrors = {} as any;
    const parseResult = formSchema.safeParse(state.form);
    if (!parseResult.success) {
        formErrors = issuesToErrors(
            parseResult.error.issues,
            state.validateAll === true ? undefined : state.touched
        );
    }

    const stepValidator = [
        ['HyperParameterTuningJobName', 'WarmStartConfig'],
        ['TrainingJobDefinitions'],
        ['HyperParameterTuningJobConfig'],
    ];
    function isStepValid (fields: string[], formErrors: any) {
        return fields.filter((field) => _.has(formErrors, field)).length === 0;
    }

    const handleSubmit = () => {
        setState({ type: 'updateState', payload: { formSubmitting: true } });
        const hpoJobDefinition: IHPOJob = _.cloneDeep(state.form);

        hpoJobDefinition.TrainingJobDefinitions.forEach((trainingJob) => {
            // If this is a built-in then strip the MetricDefinitions
            // Sagemaker automatically adds the default MetricDefinitions, so calling the API with them results in duplicates
            if (ML_ALGORITHMS.find((algorithm) =>
                algorithm.name === getImageName(trainingJob.AlgorithmSpecification.TrainingImage))) {
                delete trainingJob.AlgorithmSpecification.MetricDefinitions;
            }

            // Remove Datasets that are used for our forms, but aren't needed by API
            delete (trainingJob.OutputDataConfig as OutputDataConfig & DatasetExtension).Dataset;
            trainingJob.InputDataConfig.forEach(
                (inputDataConfig) =>
                    delete (inputDataConfig as InputDataConfig & DatasetExtension).Dataset
            );

            trainingJob.HyperParameterRanges = {
                CategoricalParameterRanges:
                    trainingJob.HyperParameterRanges?.CategoricalParameterRanges.filter(
                        (hyperparameter) => hyperparameter !== null
                    ) || [],
                IntegerParameterRanges:
                    trainingJob.HyperParameterRanges?.IntegerParameterRanges.filter(
                        (hyperparameter) => hyperparameter !== null
                    ).filter(
                        (hyperparameter) => String(hyperparameter.MinValue).trim() && String(hyperparameter.MaxValue).trim()
                    ) || [],
                ContinuousParameterRanges:
                    trainingJob.HyperParameterRanges?.ContinuousParameterRanges.filter(
                        (hyperparameter) => hyperparameter !== null
                    ).filter(
                        (hyperparameter) => String(hyperparameter.MinValue).trim() && String(hyperparameter.MaxValue).trim()
                    ) || [],
            };

            // This expects a value akin to AlgorithmSpecification.TrainingImage, but the application uses it like algorithm.displayName
            delete trainingJob.AlgorithmSpecification.AlgorithmName;

            if (trainingJob.EnableManagedSpotTraining !== true) {
                delete trainingJob.StoppingCondition.MaxWaitTimeInSeconds;
            }
        });

        const payload: CreateHPOJobThunkPayload = {
            ProjectName: projectName!,
            UserName: userName!,
            HPOJobDefinition: hpoJobDefinition,
        };

        dispatch(createHPOJobThunk(payload)).then((result: any) => {
            setState({ type: 'updateState', payload: { formSubmitting: false } });
            if (result.payload.error === true) {
                notificationService.generateNotification(
                    `Failed to create hyperparameter tuning job: ${result.payload.reason}`,
                    'error'
                );
            } else {
                notificationService.generateNotification(
                    `Successfully created hyperparameter tuning job with name ${state.form.HyperParameterTuningJobName}`,
                    'success'
                );

                navigate(
                    `/project/${projectName}/jobs/hpo/detail/${state.form.HyperParameterTuningJobName}`
                );
            }
        });
    };

    return (
        <ErrorBoundaryRoutes>
            <Route
                index
                element={
                    <Wizard
                        activeStepIndex={state.activeStepIndex}
                        onNavigate={(event) => {
                            switch (event.detail.reason) {
                                case 'step':
                                case 'previous':
                                    setState({
                                        type: 'updateState',
                                        payload: {
                                            activeStepIndex: event.detail.requestedStepIndex,
                                        },
                                    });
                                    break;
                                case 'next':
                                    {
                                        const parseResult = formSchema.safeParse(state.form);
                                        if (parseResult.success) {
                                            setState({
                                                type: 'updateState',
                                                payload: {
                                                    activeStepIndex:
                                                        event.detail.requestedStepIndex,
                                                    validateAll: false,
                                                },
                                            });
                                        } else {
                                            const formErrors = issuesToErrors(
                                                parseResult.error.issues
                                            );
                                            if (
                                                isStepValid(
                                                    stepValidator[state.activeStepIndex],
                                                    formErrors
                                                )
                                            ) {
                                                setState({
                                                    type: 'updateState',
                                                    payload: {
                                                        activeStepIndex:
                                                            event.detail.requestedStepIndex,
                                                        validateAll: false,
                                                    },
                                                });
                                            } else {
                                                setState({
                                                    type: 'updateState',
                                                    payload: { validateAll: true },
                                                });
                                            }

                                            scrollToInvalid();
                                        }
                                    }
                                    break;
                            }
                        }}
                        onCancel={() => {
                            navigate(`/project/${projectName}/jobs/hpo`, {
                                state: { prevPath: window.location.hash },
                            });
                        }}
                        onSubmit={() => {
                            const parseResult = formSchema.safeParse(state.form);
                            if (parseResult.success) {
                                handleSubmit();
                            } else {
                                setState({
                                    type: 'updateState',
                                    payload: { validateAll: true },
                                });
                                scrollToInvalid();
                            }
                        }}
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
                            submitButton: 'Submit',
                            navigationAriaLabel: 'Job creation steps',
                        }}
                        steps={[
                            {
                                title: 'Define job settings',
                                content: (
                                    <HPOJobSettings
                                        {...{
                                            item: state.form,
                                            setFields,
                                            touchFields,
                                            formErrors,
                                        }}
                                    />
                                ),
                            },
                            {
                                title: 'Create training job definition',
                                content: (
                                    <JobDefinitions
                                        {...{
                                            item: state.form,
                                            setFields,
                                            touchFields,
                                            formErrors,
                                        }}
                                        actions={
                                            <Button
                                                onClick={() => {
                                                    navigate('definition/new');
                                                }}
                                            >
                                                Add training job definition
                                            </Button>
                                        }
                                    />
                                ),
                            },
                            {
                                title: 'Configure tuning job resources',
                                content: (
                                    <ConfigureTuningJobResources
                                        {...{
                                            item: state.form,
                                            setFields,
                                            touchFields,
                                            formErrors,
                                        }}
                                    />
                                ),
                            },
                            {
                                title: 'Review and create',
                                content: (
                                    <ReviewAndCreate
                                        {...{
                                            item: state.form,
                                            setFields,
                                            touchFields,
                                            formErrors,
                                        }}
                                        setStep={(stepNumber: number) => {
                                            setState({
                                                type: 'updateState',
                                                payload: { activeStepIndex: stepNumber },
                                            });
                                        }}
                                    />
                                ),
                            },
                        ]}
                    />
                }
            />
            <Route
                path='definition/:action'
                element={
                    <EditTrainingJobDefinition {...{ item: state.form, setFields, touchFields }} />
                }
            />
        </ErrorBoundaryRoutes>
    );
}