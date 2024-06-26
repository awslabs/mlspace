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
import { useNavigate, useParams } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import {
    Button,
    SpaceBetween,
    Header,
    FormField,
    Input,
    Container,
    Select,
    Grid,
    ExpandableSection,
    SelectProps,
} from '@cloudscape-design/components';
import { AssembleWith, BatchStrategy, CompressionType, ITransform, S3DataType, SplitType, defaultValue } from '../../../../shared/model/transform.model';
import { useAppDispatch, useAppSelector } from '../../../../config/store';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import NotificationService from '../../../../shared/layout/notification/notification.service';
import { createBatchTransformJob } from '../transform.reducer';
import { z } from 'zod';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import { scrollToInvalid, useValidationReducer } from '../../../../shared/validation';
import { DocTitle, scrollToPageHeader } from '../../../../../src/shared/doc';
import Modal from '../../../../modules/modal';
import Table from '../../../../modules/table';
import {
    getProjectModels,
    loadingModelsList,
    modelsList,
    clearModelsList,
} from '../../../model/model.reducer';
import {
    defaultColumns as modelColumns,
    visibleContentPreference,
} from '../../../model/model.columns';
import { ModelResourceMetadata } from '../../../../shared/model/resource-metadata.model';
import { InstanceTypeSelector } from '../../../../shared/metadata/instance-type-dropdown';
import { ModifyMethod } from '../../../../shared/validation/modify-method';
import {
    AttributeEditorSchema,
    EnvironmentVariables,
} from '../../../../modules/environment-variables/environment-variables';
import { tryCreateDataset } from '../../../dataset/dataset.service';
import DatasetResourceSelector from '../../../../modules/dataset/dataset-selector';
import { datasetFromS3Uri } from '../../../../shared/util/dataset-utils';
import { DatasetResourceSelectorSelectableItems } from '../../../../modules/dataset/dataset-selector.types';
import { ServiceTypes } from '../../../../shared/model/app.configuration.model';
import ContentLayout from '../../../../shared/layout/content-layout';
import { generateNameConstraintText } from '../../../../shared/util/form-utils';

export function TransformCreate () {
    const [s3DataTypes, setS3DataTypes] = useState([] as SelectProps.Option[]);
    const [splitTypes, setSplitTypes] = useState([] as SelectProps.Option[]);
    const [compressionTypes, setCompressionTypes] = useState([] as SelectProps.Option[]);
    const [contentTypes, setContentTypes] = useState([] as SelectProps.Option[]);
    const [assembleWithTypes, setAssembleWithTypes] = useState([] as SelectProps.Option[]);
    const [batchStrategies, setBatchStrategies] = useState([] as SelectProps.Option[]);
    const [joinSources, setJoinSources] = useState([] as SelectProps.Option[]);
    const [showSelectModelModal, setShowSelectModelModal] = useState(false);

    const modelList: ModelResourceMetadata[] = useAppSelector(modelsList);
    const loadingModels = useAppSelector(loadingModelsList);

    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const navigate = useNavigate();
    const basePath = projectName ? `/project/${projectName}` : '/personal';

    let selectedModel: ModelResourceMetadata;

    scrollToPageHeader();
    DocTitle('Create Batch Transform Job');

    const formSchema = z.object({
        BatchStrategy: z.string().optional(),
        DataProcessing: z
            .object({
                InputFilter: z.string().max(63).optional(),
                JoinSource: z.string().optional(),
                OutputFilter: z.string().max(63).optional(),
            })
            .optional(),
        Environment: AttributeEditorSchema,
        MaxConcurrentTransforms: z.number().gte(0).optional(),
        MaxPayloadInMB: z.number().gte(0).lte(100).optional(),
        ModelClientConfig: z
            .object({
                InvocationsMaxRetries: z.number().gte(0).lte(3).optional().or(z.literal('')),
                InvocationsTimeoutInSeconds: z
                    .number()
                    .gte(0)
                    .lte(3600)
                    .optional()
                    .or(z.literal('')),
            })
            .optional(),
        ModelName: z.string({ required_error: 'Model is required' }),
        TransformInput: z.object({
            CompressionType: z.string().optional(),
            ContentType: z.string().max(256).optional(),
            DataSource: z.object({
                S3DataSource: z.object({
                    S3DataType: z.string({ required_error: 'S3 data type is required' }),
                    S3Uri: z.string({ required_error: 'S3 location is required' }).s3Uri(),
                }),
            }),
            SplitType: z.string().optional(),
        }),
        TransformJobName: z
            .string()
            .min(3)
            .max(63)
            .regex(/^[a-zA-Z0-9-]*$/, {
                message: 'Name can only contain alphanumeric characters and hyphens (-)',
            }),
        TransformOutput: z.object({
            Accept: z.string().max(256).optional(),
            AssembleWith: z.string().optional(),
            S3OutputPath: z.string({ required_error: 'S3 output location is required' }).max(1024).datasetUri(),
        }),
        TransformResources: z.object({
            InstanceCount: z.number().gte(1).lte(100),
            InstanceType: z.string({ required_error: 'Instance type is required' }),
        }),
    });

    const { state, setState, errors, setFields, touchFields } = useValidationReducer(formSchema, {
        validateAll: false as boolean,
        form: defaultValue,
        touched: {},
        formSubmitting: false as boolean,
    });

    let selectableItemsTypes: DatasetResourceSelectorSelectableItems[] = ['prefixes', 'objects'];
    if (state.form.TransformInput.DataSource.S3DataSource.S3DataType === S3DataType.S3Prefix) {
        selectableItemsTypes = ['prefixes'];
    } else if (state.form.TransformInput.DataSource.S3DataSource.S3DataType === S3DataType.ManifestFile) {
        selectableItemsTypes = ['objects'];
    }

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Batch transform', href: `#${basePath}/jobs/transform` },
                { text: 'Create batch transform job', href: `#${basePath}/jobs/transform/create` },
            ])
        );
        setS3DataTypes([
            { value: S3DataType.S3Prefix, label: S3DataType.S3Prefix },
            { value: S3DataType.ManifestFile, label: S3DataType.ManifestFile },
        ]);
        setSplitTypes([
            { value: SplitType.None, label: SplitType.None },
            { value: SplitType.Line, label: SplitType.Line },
            { value: SplitType.RecordIO, label: SplitType.RecordIO },
            { value: SplitType.TFRecord, label: SplitType.TFRecord },
        ]);
        setCompressionTypes([
            { value: CompressionType.None, label: CompressionType.None },
            { value: CompressionType.Gzip, label: CompressionType.Gzip },
        ]);
        setContentTypes([
            { value: 'application/x-image', label: 'application/x-image' },
            { value: 'application/x-recordio-protobuf', label: 'application/x-recordio-protobuf' },
            { value: 'text/csv', label: 'text/csv' },
        ]);
        setAssembleWithTypes([
            { value: AssembleWith.None, label: AssembleWith.None },
            { value: AssembleWith.Line, label: AssembleWith.Line },
        ]);
        setBatchStrategies([
            { value: '', label: '' },
            { value: BatchStrategy.SingleRecord, label: BatchStrategy.SingleRecord },
            { value: BatchStrategy.MultiRecord, label: BatchStrategy.MultiRecord },
        ]);
        setJoinSources([
            { value: 'None', label: 'None - Use output job only' },
            { value: 'Input', label: 'Input - Merge input data with job output' },
        ]);

        scrollToPageHeader('h1', 'Create batch transform job');
    }, [dispatch, basePath, projectName]);

    function handleSubmit () {
        const parseResult = formSchema.safeParse(state.form);

        if (parseResult.success) {
            setState({ formSubmitting: true, validateAll: true });
            const transform: ITransform = { ...state.form };
            const updatedForm = (Object.keys(transform).includes('Environment')
                ? {
                    ...transform,
                    Environment: Object.fromEntries(
                        Object.entries(state.form.Environment || {}).filter((entry: any) => !!entry.key)
                    ),
                }
                : transform) as ITransform;
            createBatchTransformJob({ ...updatedForm, ProjectName: projectName })
                .then((response) => {
                    if (response.status === 200) {
                        const dataset = datasetFromS3Uri(state.form.TransformInput?.DataSource?.S3DataSource?.S3Uri);
                        if (dataset) {
                            dataset.description = `Dataset created as part of the Batch Transform job: ${state.form.TransformJobName}`;
                            tryCreateDataset(dataset);
                        }

                        notificationService.generateNotification(
                            'Successfully created batch transform job.',
                            'success'
                        );
                        setState({ formSubmitting: false });
                        // Path depends on TransformJobName on the transform_job lambda
                        navigate(
                            `${basePath}/jobs/transform/${projectName}-${state.form.TransformJobName}`
                        );
                    } else {
                        notificationService.generateNotification(
                            `Failed to create batch transform job: ${response.data}`,
                            'error'
                        );
                    }
                })
                .catch((error) => {
                    notificationService.generateNotification(
                        `Error occurred during batch transform job creation: ${error.response.data}`,
                        'error'
                    );
                })
                .finally(() => {
                    setState({ formSubmitting: false });
                });
        } else {
            setState({ validateAll: true, formSubmitting: false });
            scrollToInvalid();
        }
    }

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description='A transform job uses a model to transform data and stores the results at a specified location.'
                >
                    Create batch transform job
                </Header>
            }
        >
            <Form
                actions={
                    <SpaceBetween direction='horizontal' size='xl'>
                        <Button
                            formAction='none'
                            variant='link'
                            onClick={() =>
                                navigate(`${basePath}/jobs/transform`, {
                                    state: { prevPath: window.location.hash },
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            loading={state.formSubmitting}
                            variant='primary'
                            onClick={handleSubmit}
                            disabled={state.formSubmitting}
                        >
                            Create batch transform job
                        </Button>
                    </SpaceBetween>
                }
            >
                <SpaceBetween direction='vertical' size='xxl'>
                    <Container
                        header={
                            <Header variant='h3'>Batch transform job configuration settings</Header>
                        }
                    >
                        <SpaceBetween direction='vertical' size='l'>
                            <FormField
                                label='Job name'
                                constraintText={
                                    generateNameConstraintText()
                                }
                                errorText={errors.TransformJobName}
                            >
                                <Input
                                    value={state.form.TransformJobName!}
                                    onChange={(e) => {
                                        setFields({
                                            TransformJobName: e.detail.value,
                                        });
                                    }}
                                    onBlur={() => touchFields(['TransformJobName'])}
                                />
                            </FormField>
                            <FormField
                                label='Model name'
                                errorText={errors.ModelName}
                                secondaryControl={
                                    <Button
                                        iconName='search'
                                        onClick={() => setShowSelectModelModal(true)}
                                    >
                                        Find Model
                                    </Button>
                                }
                            >
                                <Input value={state.form.ModelName || ''} disabled />
                            </FormField>
                            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                                <FormField
                                    label='Instance type'
                                    errorText={errors.TransformResources?.InstanceType}
                                >
                                    <InstanceTypeSelector
                                        selectedOption={{
                                            value: state.form.TransformResources?.InstanceType,
                                        }}
                                        onChange={({ detail }) =>
                                            setFields({
                                                'TransformResources.InstanceType':
                                                    detail.selectedOption.value,
                                            })
                                        }
                                        service={ServiceTypes.TRANSFORM_JOB}
                                        onBlur={() =>
                                            touchFields(['TransformResources.InstanceType'])
                                        }
                                    />
                                </FormField>
                                <FormField
                                    label='Instance count'
                                    errorText={errors.TransformResources?.InstanceCount}
                                >
                                    <Input
                                        value={String(state.form?.TransformResources?.InstanceCount || 1)}
                                        inputMode='numeric'
                                        type='number'
                                        onChange={(e) => {
                                            setFields({
                                                'TransformResources.InstanceCount': Number(
                                                    e.detail.value
                                                ),
                                            });
                                        }}
                                        onBlur={() =>
                                            touchFields(['TransformResources.InstanceCount'])
                                        }
                                    />
                                </FormField>
                            </Grid>
                            <ExpandableSection headerText='Additional configuration'>
                                <SpaceBetween direction='vertical' size='l'>
                                    <Grid
                                        gridDefinition={[
                                            { colspan: { default: 12, xxs: 4 } },
                                            { colspan: { default: 12, xxs: 4 } },
                                        ]}
                                    >
                                        <FormField
                                            label={
                                                <span>
                                                    Max concurrent transforms <i>- optional</i>{' '}
                                                </span>
                                            }
                                            description='Maximum number of parallel requests that can be launched on a single instance.'
                                            errorText={errors.MaxConcurrentTransforms}
                                        >
                                            <Input
                                                value={
                                                    state.form.MaxConcurrentTransforms?.toString() ||
                                                    ''
                                                }
                                                inputMode='numeric'
                                                type='number'
                                                onChange={(e) => {
                                                    setFields({
                                                        MaxConcurrentTransforms: Number(
                                                            e.detail.value
                                                        ),
                                                    });
                                                }}
                                                onBlur={() =>
                                                    touchFields(['MaxConcurrentTransforms'])
                                                }
                                            />
                                        </FormField>
                                        <FormField
                                            label={
                                                <span>
                                                    Max payload size (MB) <i>- optional</i>{' '}
                                                </span>
                                            }
                                            description='Maximum size allowed for a mini-batch. Must be greater than a single record.'
                                            errorText={errors.MaxPayloadInMB}
                                        >
                                            <Input
                                                value={state.form.MaxPayloadInMB?.toString() || ''}
                                                inputMode='numeric'
                                                type='number'
                                                onChange={(e) => {
                                                    setFields({
                                                        MaxPayloadInMB: Number(e.detail.value),
                                                    });
                                                }}
                                                onBlur={() => touchFields(['MaxPayloadInMB'])}
                                            />
                                        </FormField>
                                    </Grid>
                                    <Grid gridDefinition={[{ colspan: { default: 12, xxs: 4 } }]}>
                                        <FormField
                                            label={
                                                <span>
                                                    Batch strategy <i>- optional</i>{' '}
                                                </span>
                                            }
                                            description='Maximum number of records per mini-batch.'
                                            errorText={errors.BatchStrategy}
                                        >
                                            <Select
                                                selectedOption={{
                                                    value: state.form.BatchStrategy,
                                                }}
                                                options={batchStrategies}
                                                onChange={(e) => {
                                                    setFields({
                                                        BatchStrategy:
                                                            e.detail.selectedOption.value,
                                                    });
                                                }}
                                                onBlur={() => touchFields(['BatchStrategy'])}
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
                                            label={
                                                <span>
                                                    Max invocation retries <i>- optional</i>{' '}
                                                </span>
                                            }
                                            description='The maximum number of retries when invocation requests are failing. Minimum value of 0. Maximum value of 3.'
                                            errorText={
                                                errors.ModelClientConfig?.InvocationsMaxRetries
                                            }
                                        >
                                            <Input
                                                value={
                                                    state.form.ModelClientConfig?.InvocationsMaxRetries?.toString() ||
                                                    ''
                                                }
                                                inputMode='numeric'
                                                type='number'
                                                onChange={(e) => {
                                                    if (e.detail.value) {
                                                        setFields({
                                                            'ModelClientConfig.InvocationsMaxRetries':
                                                                Number(e.detail.value),
                                                        });
                                                    } else {
                                                        setFields(
                                                            {
                                                                'ModelClientConfig.InvocationsMaxRetries':
                                                                    true,
                                                            },
                                                            ModifyMethod.Unset
                                                        );
                                                    }
                                                }}
                                                onBlur={() =>
                                                    touchFields([
                                                        'ModelClientConfig.InvocationsMaxRetries',
                                                    ])
                                                }
                                            />
                                        </FormField>
                                        <FormField
                                            label={
                                                <span>
                                                    Invocation timeout in seconds <i>- optional</i>{' '}
                                                </span>
                                            }
                                            description='The timeout value in seconds for an invocation request. Minimum value of 1. Maximum value of 3600.'
                                            errorText={
                                                errors.ModelClientConfig
                                                    ?.InvocationsTimeoutInSeconds
                                            }
                                        >
                                            <Input
                                                value={
                                                    state.form.ModelClientConfig?.InvocationsTimeoutInSeconds?.toString() ||
                                                    ''
                                                }
                                                inputMode='numeric'
                                                type='number'
                                                onChange={(e) => {
                                                    if (e.detail.value) {
                                                        setFields({
                                                            'ModelClientConfig.InvocationsTimeoutInSeconds':
                                                                Number(e.detail.value),
                                                        });
                                                    } else {
                                                        setFields(
                                                            {
                                                                'ModelClientConfig.InvocationsTimeoutInSeconds':
                                                                    true,
                                                            },
                                                            ModifyMethod.Unset
                                                        );
                                                    }
                                                }}
                                                onBlur={() =>
                                                    touchFields([
                                                        'ModelClientConfig.InvocationsTimeoutInSeconds',
                                                    ])
                                                }
                                            />
                                        </FormField>
                                    </Grid>
                                </SpaceBetween>
                            </ExpandableSection>
                        </SpaceBetween>
                    </Container>
                    <Container header={<Header variant='h3'>Input data configuration</Header>}>
                        <SpaceBetween direction='vertical' size='l'>
                            <Grid
                                gridDefinition={[
                                    { colspan: 3 },
                                    { colspan: 3 },
                                    { colspan: 3 },
                                    { colspan: 3 },
                                ]}
                            >
                                <FormField
                                    label='S3 data type'
                                    errorText={
                                        errors.TransformInput?.DataSource?.S3DataSource?.S3DataType
                                    }
                                >
                                    <Select
                                        selectedOption={{
                                            label:
                                                state.form.TransformInput?.DataSource?.S3DataSource
                                                    ?.S3DataType || '',
                                        }}
                                        options={s3DataTypes}
                                        onChange={({ detail }) => {
                                            setFields({
                                                'TransformInput.DataSource.S3DataSource.S3DataType':
                                                    detail.selectedOption.label,
                                            });
                                        }}
                                        onBlur={() =>
                                            touchFields([
                                                'TransformInput.DataSource.S3DataSource.S3DataType',
                                            ])
                                        }
                                    />
                                </FormField>
                                <FormField
                                    label='Split type'
                                    errorText={errors.TransformInput?.SplitType}
                                >
                                    <Select
                                        selectedOption={{
                                            label: state.form.TransformInput?.SplitType,
                                        }}
                                        options={splitTypes}
                                        onChange={({ detail }) => {
                                            setFields({
                                                'TransformInput.SplitType':
                                                    detail.selectedOption.label!,
                                            });
                                        }}
                                        onBlur={() => touchFields(['TransformInput.SplitType'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Compression'
                                    errorText={errors.TransformInput?.CompressionType}
                                >
                                    <Select
                                        selectedOption={{
                                            label: state.form.TransformInput?.CompressionType,
                                        }}
                                        options={compressionTypes}
                                        onChange={({ detail }) => {
                                            setFields({
                                                'TransformInput.CompressionType':
                                                    detail.selectedOption.label,
                                            });
                                        }}
                                        onBlur={() =>
                                            touchFields(['TransformInput.CompressionType'])
                                        }
                                    />
                                </FormField>
                                <FormField
                                    label={
                                        <span>
                                            Content type <i>- optional</i>{' '}
                                        </span>
                                    }
                                    errorText={errors.TransformInput?.ContentType}
                                >
                                    <Select
                                        selectedOption={{
                                            label: state.form.TransformInput?.ContentType,
                                        }}
                                        options={contentTypes}
                                        onChange={({ detail }) => {
                                            setFields({
                                                'TransformInput.ContentType':
                                                    detail.selectedOption.label,
                                            });
                                        }}
                                        onBlur={() => touchFields(['TransformInput.ContentType'])}
                                    />
                                </FormField>
                            </Grid>
                            <DatasetResourceSelector
                                fieldLabel={'S3 Location'}
                                selectableItemsTypes={selectableItemsTypes}
                                onChange={({detail}) => {
                                    setFields({
                                        'TransformInput.DataSource.S3DataSource.S3Uri': detail.resource,
                                    });
                                }}
                                inputOnBlur={() => {
                                    touchFields(['TransformInput.DataSource.S3DataSource.S3Uri']);
                                }}
                                inputInvalid={!!errors?.TransformInput?.DataSource?.S3DataSource?.S3Uri}
                                fieldErrorText={errors?.TransformInput?.DataSource?.S3DataSource?.S3Uri}
                                resource={state.form?.TransformInput?.DataSource?.S3DataSource?.S3Uri || ''}
                                alertOnEmpty={true}
                            />
                        </SpaceBetween>
                    </Container>
                    <Container header={<Header variant='h3'>Output data configuration</Header>}>
                        <SpaceBetween direction='vertical' size='l'>
                            <DatasetResourceSelector
                                fieldLabel={'S3 Location'}
                                selectableItemsTypes={['prefixes']}
                                showCreateButton={true}
                                onChange={({detail}) => {
                                    setFields({
                                        'TransformOutput.S3OutputPath': detail.resource,
                                    });
                                }}
                                inputOnBlur={() => {
                                    touchFields(['TransformOutput.S3OutputPath']);
                                }}
                                inputInvalid={!!errors?.TransformOutput?.S3OutputPath}
                                fieldErrorText={errors?.TransformOutput?.S3OutputPath}
                                resource={state.form?.TransformOutput?.S3OutputPath || ''}
                            />
                            <FormField
                                label='Assemble with'
                                errorText={errors.TransformOutput?.AssembleWith}
                            >
                                <Select
                                    selectedOption={{
                                        label: state.form.TransformOutput?.AssembleWith,
                                    }}
                                    options={assembleWithTypes}
                                    onChange={({ detail }) => {
                                        setFields({
                                            'TransformOutput.AssembleWith':
                                                detail.selectedOption.label,
                                        });
                                    }}
                                    onBlur={() => touchFields(['TransformOutput.AssembleWith'])}
                                />
                            </FormField>
                            <ExpandableSection headerText='Additional configuration'>
                                <FormField
                                    label={
                                        <span>
                                            Accept <i>- optional</i>{' '}
                                        </span>
                                    }
                                    errorText={errors.TransformOutput?.Accept}
                                >
                                    <Input
                                        value={state.form.TransformOutput?.Accept || ''}
                                        onChange={(e) => {
                                            setFields({
                                                'TransformOutput.Accept': e.detail.value,
                                            });
                                        }}
                                        onBlur={() => touchFields(['TransformOutput.Accept'])}
                                    />
                                </FormField>
                            </ExpandableSection>
                        </SpaceBetween>
                    </Container>
                    <Container
                        header={
                            <ExpandableSection
                                headerText='Input/output filtering and data joins'
                                headerDescription='Optional data processing configuration'
                            >
                                <SpaceBetween direction='vertical' size='l'>
                                    <FormField
                                        label='Input filter'
                                        description='Filter input data prior to transform. Leave blank if you want to use all of the input source data.'
                                        constraintText='Filter data by providing a JSON filter path or CSV column indices.'
                                        errorText={errors.DataProcessing?.InputFilter}
                                    >
                                        <Input
                                            value={state.form.DataProcessing?.InputFilter || ''}
                                            onChange={(e) => {
                                                setFields({
                                                    'DataProcessing.InputFilter': e.detail.value,
                                                });
                                            }}
                                            onBlur={() =>
                                                touchFields(['DataProcessing.InputFilter'])
                                            }
                                        />
                                    </FormField>
                                    <FormField
                                        label='Join source'
                                        description='Choose the source of data to join with your output. Use Output filter to specify the final output.'
                                        errorText={errors.DataProcessing?.JoinSource}
                                    >
                                        <Select
                                            selectedOption={{
                                                value:
                                                    state.form.DataProcessing?.JoinSource || 'None',
                                            }}
                                            options={joinSources}
                                            onChange={({ detail }) => {
                                                setFields({
                                                    'DataProcessing.JoinSource':
                                                        detail.selectedOption.value,
                                                });
                                            }}
                                            onBlur={() =>
                                                touchFields(['DataProcessing.JoinSource'])
                                            }
                                        />
                                    </FormField>
                                    <FormField
                                        label='Output filter'
                                        description='Filter output data after input/output join, if used. Leave blank if you want to use all of the output.'
                                        constraintText='Filter data by providing a JSON filter path or CSV column indices.'
                                        errorText={errors.DataProcessing?.OutputFilter}
                                    >
                                        <Input
                                            value={state.form.DataProcessing?.OutputFilter || ''}
                                            onChange={(e) => {
                                                setFields({
                                                    'DataProcessing.OutputFilter': e.detail.value,
                                                });
                                            }}
                                            onBlur={() =>
                                                touchFields(['DataProcessing.OutputFilter'])
                                            }
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </ExpandableSection>
                        }
                    />
                    <Container>
                        <EnvironmentVariables
                            item={state.form}
                            setFields={setFields}
                            touchFields={touchFields}
                            formErrors={errors}
                        />
                    </Container>
                </SpaceBetween>
            </Form>
            <Modal
                title='Batch Transform Model'
                visible={showSelectModelModal}
                dismissText='Cancel'
                confirmText='Select model'
                onDismiss={async () => {
                    setShowSelectModelModal(false);
                }}
                onConfirm={async () => {
                    if (selectedModel) {
                        setFields({ ModelName: selectedModel.resourceId });
                    }
                    setShowSelectModelModal(false);
                }}
            >
                <>
                    <p>
                        Select one of the models from your project to use with the batch transform
                        job you&apos;re creating.
                    </p>
                    <Table
                        header={<></>}
                        tableName='Model'
                        tableType='single'
                        trackBy='resourceId'
                        itemNameProperty='resourceId'
                        allItems={modelList}
                        columnDefinitions={modelColumns}
                        visibleColumns={['modelName', 'creationTime']}
                        visibleContentPreference={visibleContentPreference}
                        loadingItems={loadingModels}
                        serverFetch={getProjectModels}
                        storeClear={clearModelsList}
                        selectItemsCallback={(models: ModelResourceMetadata[]) => {
                            if (models.length === 1) {
                                selectedModel = models[0];
                            }
                        }}
                        variant='embedded'
                    />
                </>
            </Modal>
        </ContentLayout>
    );
}

export default TransformCreate;
