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

import { Wizard } from '@cloudscape-design/components';
import React, { useEffect } from 'react';
import { useAppDispatch } from '../../../../config/store';
import { Route, useNavigate, useParams } from 'react-router-dom';
import { DocTitle, scrollToPageHeader } from '../../../../shared/doc';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import ErrorBoundaryRoutes from '../../../../shared/error/error-boundary-routes';
import { ILabelingJobCreate, LabelingJobCategory } from '../labeling-job.model';
import { createDefaultLabelingJob } from '../../create.functions';
import LabelingJobSpecifyDetails from './labeling-job-specify-details';
import LabelingJobSelectWorkers from './labeling-job-select-workers';
import z from 'zod';
import {
    issuesToErrors,
    scrollToInvalid,
    useValidationReducer,
} from '../../../../shared/validation';
import { createLabelingJobThunk, listLabelingWorkTeams } from '../labeling-job.reducer';
import _ from 'lodash';
import { TASK_TYPE_CONFIG } from './labeling-job-task-config';
import { LabelingJobTypes } from '../labeling-job.common';
import '../../../../shared/validation/helpers/uri';
import { useNotificationService } from '../../../../shared/util/hooks';
import '../../../../wizard.css';

export type ILabelingJobLabel = {
    label: string;
    shortDisplayName?: string;
};

export type ILabelingJobCreateForm = {
    enableAutomatedLabeling: boolean;
    job: ILabelingJobCreate;
    specifyAttribute: false;
    taskCategory: LabelingJobCategory;
    taskExpiration: {
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
    };
    taskSelection: LabelingJobTypes;
    taskTimeout: {
        hours: number;
        minutes: number;
        seconds: number;
    };
    labels: ILabelingJobLabel[];
    shortInstruction: string;
    fullInstruction: string;
    description: string;
};

export type LabelingJobCreateState = {
    validateAll: boolean;
    form: ILabelingJobCreateForm;
    touched: any;
    formSubmitting: boolean;
    activeStepIndex: number;
};

export function LabelingJobCreate () {
    const { projectName = '' } = useParams();

    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const notificationService = useNotificationService(dispatch);

    scrollToPageHeader();
    DocTitle('Labeling Job Create');

    const formSchema = z.object({
        job: z.object({
            LabelingJobName: z
                .string()
                .min(1, { message: 'Labeling job name is required' })
                .max(63)
                .regex(/^[a-zA-Z0-9-]+$/, {
                    message: 'Name can only contain alphanumeric characters and hyphens (-)',
                })
                .regex(/^[a-zA-Z0-9-]+(?<!-metadata)$/, { message: 'Must not end with -metadata' })
                .regex(/^[a-zA-Z0-9-]+(?<!-ref)$/, { message: 'Must not end with -ref' })
                .regex(/^[a-zA-Z0-9]/)
                .regex(/[a-zA-Z0-9]$/),
            LabelAttributeName: z
                .string()
                .min(1)
                .max(59)
                .regex(/^[a-zA-Z0-9-]+(?<!-metadata)$/, { message: 'Must not end with -metadata' })
                .regex(/^[a-zA-Z0-9-]+(?<!-ref)$/, { message: 'Must not end with -ref' })
                .regex(/^[a-zA-Z0-9]/)
                .regex(/[a-zA-Z0-9]$/)
                .optional(),
            InputConfig: z.object({
                DataSource: z.object({
                    S3DataSource: z.object({
                        ManifestS3Uri: z.string().min(1, {
                            message: 'Must enter input manifest file.',
                        }).s3Resource(),
                    }),
                }),
            }),
            OutputConfig: z.object({
                S3OutputPath: z.string().min(1, {
                    message: 'Must enter output dataset.',
                }).datasetUri(),
            }),
            HumanTaskConfig: z.object({
                NumberOfHumanWorkersPerDataObject: z
                    .number({ coerce: true })
                    .min(1, { message: 'Enter an integer between 1 and 9' })
                    .max(9, { message: 'Enter an integer between 1 and 9' }),
                TaskTimeLimitInSeconds: z
                    .number({ coerce: true })
                    .min(30, {
                        message: 'Task timeout must be between 30 seconds and 8 hours (inclusive).',
                    })
                    .max(28800, {
                        message: 'Task timeout must be between 30 seconds and 8 hours (inclusive).',
                    }),
                TaskAvailabilityLifetimeInSeconds: z
                    .number({ coerce: true })
                    .min(60, {
                        message:
                            'Task expiration time must be between 1 minute and 30 days (inclusive).',
                    })
                    .max(2592000, {
                        message:
                            'Task expiration time must be between 1 minute and 30 days (inclusive).',
                    }),
                WorkteamArn: z.string().min(1, {
                    message: 'A labeling team must be selected.',
                })
            }),
        }),
        taskSelection: z.any(),
        labels: z
            .array(
                z.object({
                    label: z.string().min(1, { message: 'This field is required.' }),
                })
            )
            .min(2, { message: 'A minimum of two labels are required.' }),
        description: z.string().min(1, { message: 'Brief description of task field is required.' }),
    });

    const { state, setState, setFields, touchFields } = useValidationReducer(formSchema, {
        validateAll: false as boolean,
        touched: {},
        formSubmitting: false as boolean,
        form: {
            enableAutomatedLabeling: false,
            job: createDefaultLabelingJob(),
            specifyAttribute: false,
            taskCategory: LabelingJobCategory.Image,
            taskSelection: LabelingJobTypes.ImageMultiClass as LabelingJobTypes,
            taskTimeout: { hours: 0, minutes: 5, seconds: 0 },
            taskExpiration: { days: 10, hours: 0, minutes: 0, seconds: 0 },
            labels: [{ label: '' }, { label: '' }],
            shortInstruction:
                TASK_TYPE_CONFIG[LabelingJobCategory.Image][LabelingJobTypes.ImageMultiClass]
                    .shortInstruction,
            fullInstruction:
                TASK_TYPE_CONFIG[LabelingJobCategory.Image][LabelingJobTypes.ImageMultiClass]
                    .fullInstruction,
            description: '',
        },
        activeStepIndex: 0,
    } as LabelingJobCreateState);

    let formErrors = {} as any;
    const parseResult = formSchema.safeParse(state.form);
    if (!parseResult.success) {
        formErrors = issuesToErrors(
            parseResult.error.issues,
            state.validateAll === true ? undefined : state.touched
        );
    }

    const stepValidator = [
        [
            'job.LabelingJobName',
            'job.LabelAttributeName',
            'job.InputConfig.DataSource.S3DataSource.ManifestS3Uri',
            'job.OutputConfig.S3OutputPath',
        ],
        ['job.HumanTaskConfig'],
    ];
    function isStepValid (fields: string[], formErrors: any) {
        return fields.filter((field) => _.has(formErrors, field)).length === 0;
    }

    useEffect(() => {
        dispatch(listLabelingWorkTeams(projectName))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
    }, [dispatch, navigate, projectName]);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Labeling jobs', href: `#/project/${projectName}/jobs/labeling` },
                {
                    text: 'Create',
                    href: `#/project/${projectName}/jobs/labeling/create`,
                },
            ])
        );
    }, [dispatch, projectName]);

    const handleSubmit = () => {
        setState({ formSubmitting: true });
        const refType =
            [LabelingJobTypes.SemanticSegmentation].indexOf(state.form.taskSelection) > -1;
        const labelAttributeNameComponents = [
            state.form.job.LabelAttributeName || state.form.job.LabelingJobName,
        ];
        if (refType) {
            labelAttributeNameComponents.push('-ref');
        }
        dispatch(
            createLabelingJobThunk({
                ProjectName: `${projectName}`,
                TaskType: state.form.taskSelection,
                Labels: state.form.labels,
                ShortInstruction: state.form.shortInstruction,
                FullInstruction: state.form.fullInstruction,
                Description: state.form.description,
                JobDefinition: {
                    ...state.form.job,
                    LabelAttributeName: labelAttributeNameComponents.join(''),
                },
            })
        ).then((result: any) => {
            setState({ formSubmitting: false });
            if (!result.payload.error) {
                notificationService.generateNotification(
                    `Successfully created labeling job with name [${state.form.job.LabelingJobName}]`,
                    'success'
                );
                navigate(`/project/${projectName}/jobs/labeling/${state.form.job.LabelingJobName}`);
            } else {
                notificationService.generateNotification(
                    `Failed to create labeling job because: ${result.payload.reason}`,
                    'error'
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
                        onNavigate={({ detail }) => {
                            switch (detail.reason) {
                                case 'step':
                                case 'previous':
                                    setState({
                                        activeStepIndex: detail.requestedStepIndex,
                                    });
                                    break;
                                case 'next':
                                    {
                                        if (state.form.job.LabelAttributeName === '') {
                                            state.form.job.LabelAttributeName =
                                                state.form.job.LabelingJobName;
                                        }
                                        const parseResult = formSchema.safeParse(state.form);
                                        if (parseResult.success) {
                                            setState({
                                                activeStepIndex: detail.requestedStepIndex,
                                                validateAll: false,
                                            });
                                        } else {
                                            // If the form data isn't valid, check if the active step is
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
                                                    activeStepIndex: detail.requestedStepIndex,
                                                    validateAll: false,
                                                });
                                            } else {
                                                setState({ validateAll: true });
                                            }

                                            scrollToInvalid();
                                        }
                                    }
                                    break;
                            }

                            return false;
                        }}
                        steps={[
                            {
                                title: 'Specify job details',
                                content: (
                                    <LabelingJobSpecifyDetails
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
                                title: 'Select workers and configure tool',
                                content: (
                                    <LabelingJobSelectWorkers
                                        {...{
                                            item: state.form,
                                            setFields,
                                            touchFields,
                                            formErrors,
                                        }}
                                    />
                                ),
                            },
                        ]}
                        onCancel={() => {
                            navigate(`/project/${projectName}/jobs/labeling`, {
                                state: { prevPath: window.location.hash },
                            });
                        }}
                        onSubmit={() => {
                            const parseResult = formSchema.safeParse(state.form);
                            if (parseResult.success) {
                                handleSubmit();
                            } else {
                                setState({
                                    validateAll: true,
                                });
                                scrollToInvalid();
                            }
                        }}
                        submitButtonText='Create labeling job'
                        isLoadingNextStep={state.formSubmitting}
                    />
                }
            />
        </ErrorBoundaryRoutes>
    );
}

export default LabelingJobCreate;
