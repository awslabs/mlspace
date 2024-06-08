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
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import z from 'zod';
import Form from '@cloudscape-design/components/form';
import {
    Button,
    Container,
    ContentLayout,
    FormField,
    Header,
    Input,
    SpaceBetween,
} from '@cloudscape-design/components';
import { useAppDispatch } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { createModel } from '../model.reducer';
import CreateModelContainer from '../container/create/container-create';
import {
    prefixedSetFields,
    prefixedTouchFields,
    scrollToInvalid,
    useValidationReducer,
} from '../../../shared/validation';
import { defaultModel } from '../../../shared/model/model.model';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { IModelContainerMode } from '../../../shared/model/container.model';
import { AttributeEditorSchema } from '../../../modules/environment-variables/environment-variables';
import { NetworkSettings } from '../../jobs/hpo/create/training-definitions/network-settings';
import { generateNameConstraintText } from '../../../shared/util/form-utils';
import '../../../shared/validation/helpers/uri';

export function ModelCreate () {
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const navigate = useNavigate();
    const { projectName } = useParams();
    const currentLocation = useLocation();

    scrollToPageHeader();
    DocTitle('Create Model');

    const formSchema = z.object({
        ModelName: z
            .string()
            .min(3, { message: 'Model name is required' })
            .max(63)
            .regex(/^[a-zA-Z0-9](-*[a-zA-Z0-9])*$/, {
                message: 'Name can only contain alphanumeric characters and hyphens (-)',
            }),
        Containers: z
            .array(
                z
                    .object({
                        ContainerHostName: z
                            .string()
                            .min(3)
                            .max(63)
                            .regex(/^[a-zA-Z0-9](-*[a-zA-Z0-9])*$/, {
                                message:
                                    'Name can only contain alphanumeric characters and hyphens (-)',
                            })
                            .optional(),
                        Image: z.string().min(1, 'Inference image is required'),
                        Mode: z.string(),
                        ModelDataUrl: z.string().optional(),
                        Environment: AttributeEditorSchema,
                    })
                    .superRefine((container, ctx) => {
                        if (container.Mode === IModelContainerMode.MULTI_MODEL || !!container.ModelDataUrl?.trim()) {
                            const parseResult = z
                                .string({
                                    required_error:
                                        'Model artifacts are required when hosting multiple models in a single container',
                                })
                                .s3Uri()
                                .safeParse(container.ModelDataUrl);
                            if (!parseResult.success) {
                                parseResult.error.issues.forEach((issue) => {
                                    ctx.addIssue({
                                        ...issue,
                                        path: ['ModelDataUrl'],
                                    });
                                });
                            }
                        }
                    })
            )
            .min(1),
    });

    const { state, setState, errors, setFields, touchFields } = useValidationReducer(formSchema, {
        validateAll: false as boolean,
        form: defaultModel(),
        touched: {},
        formSubmitting: false as boolean,
    });

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Models', href: `#/project/${projectName}/model` },
                { text: 'Create model', href: `#/project/${projectName}/model/create` },
            ])
        );

        // If provided with Model values, use that to override the default
        if (currentLocation.state?.presetModel) {
            setFields({ Containers: [currentLocation.state.presetModel] });
        }

        scrollToPageHeader('h1', 'Create model');

        // This should not run on any location update, so location is omitted from the dependencies intentionally
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, projectName]);

    function handleSubmit () {
        const parseResult = formSchema.safeParse(state.form);

        if (parseResult.success) {
            setState({ formSubmitting: true, validateAll: true });

            // housekeeping to remove ModelDataUrl if it is unset
            state.form.Containers?.forEach((container) => {
                if (container?.ModelDataUrl === '') {
                    delete container.ModelDataUrl;
                }

                scrollToInvalid();
            });

            createModel({
                model: state.form,
                projectName: projectName!,
            })
                .then((response) => {
                    if (response.status === 200) {
                        notificationService.generateNotification(
                            `Successfully created model with name ${state.form.ModelName}`,
                            'success'
                        );
                        setState({ formSubmitting: false });
                        navigate(`/project/${projectName}/model/${state.form.ModelName}`);
                    } else {
                        notificationService.generateNotification(
                            `Failed to create model with error: ${response.data}`,
                            'error'
                        );
                    }
                })
                .catch((err) => {
                    notificationService.generateNotification(
                        `Failed to create model with error: ${err.response.data}`,
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
                    description='To deploy a model to Amazon SageMaker, first create the model by providing the location of the model artifacts and inference code.'
                >
                    Create model
                </Header>
            }
        >
            <Form
                actions={
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button
                            formAction='none'
                            iconAlt='Cancel'
                            variant='link'
                            onClick={() =>
                                navigate(`/project/${projectName}/model`, {
                                    state: { prevPath: window.location.hash },
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            iconAlt='Create model'
                            variant='primary'
                            onClick={() => handleSubmit()}
                            disabled={state.formSubmitting}
                            loading={state.formSubmitting}
                        >
                            Create model
                        </Button>
                    </SpaceBetween>
                }
            >
                <SpaceBetween direction='vertical' size='xl'>
                    <Container header={<Header variant='h2'>{'Model settings'} </Header>}>
                        <FormField
                            label='Model name'
                            constraintText={generateNameConstraintText()}
                            errorText={errors?.ModelName}
                        >
                            <Input
                                value={state.form.ModelName!}
                                onChange={(e) => setFields({ ModelName: e.detail.value })}
                                onBlur={() => touchFields(['ModelName'])}
                            />
                        </FormField>
                        <NetworkSettings
                            item={state.form}
                            setFields={setFields}
                            touchFields={touchFields}
                            formErrors={errors}
                        />
                    </Container>

                    {state.form.Containers?.map((container, index) => {
                        return (
                            <CreateModelContainer
                                key={index}
                                {...{
                                    state: container,
                                    setState,
                                    errors: errors.Containers?.[index],
                                    setFields: prefixedSetFields(`Containers[${index}]`, setFields),
                                    touchFields: prefixedTouchFields(
                                        `Containers[${index}]`,
                                        touchFields
                                    ),
                                }}
                            />
                        );
                    })}
                </SpaceBetween>
                {/* TODO: Add multi-container model support. Hide Add Container button.
                <Button
                    formAction="none"
                    disabled={model.Containers!.length > 4}
                    onClick={() =>
                        setModel({
                            ...model,
                            Containers: [...model.Containers!, defaultModelContainer],
                        })
                    }
                >
                    Add Container
                </Button> */}
            </Form>
        </ContentLayout>
    );
}

export default ModelCreate;
