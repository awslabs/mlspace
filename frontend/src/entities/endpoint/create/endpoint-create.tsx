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
    Tiles,
    ContentLayout,
    Alert,
} from '@cloudscape-design/components';
import { useAppDispatch } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { defaultEndpoint, IEndpoint } from '../../../shared/model/endpoint.model';
import { createEndpoint } from '../endpoint.reducer';
import EndpointConfig from '../../endpoint-config';
import EndpointConfigCreate from '../../endpoint-config/create';
import { IEndpointConfig } from '../../../shared/model/endpoint-config.model';
import { NewEndpointConfigDetails } from './new-config-details';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { scrollToInvalid, useValidationState } from '../../../shared/validation';
import { z } from 'zod';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { generateNameConstraintText } from '../../../shared/util/form-utils';

export function EndpointCreate () {
    const [endpoint, setEndpoint] = useState(defaultEndpoint as IEndpoint);
    const [newEndpointConfig, setNewEndpointConfig] = useState<IEndpointConfig>();
    const [createdNewConfig, setCreatedNewConfig] = useState(false);
    const [errorText] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [endpointConfigType, setEndpointConfigType] = useState('existing');
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const navigate = useNavigate();

    scrollToPageHeader();
    DocTitle('Create Endpoint');

    //endpoint name is prepended with '{projectname}-'
    const formSchema = z.object({
        EndpointName: z
            .string({ required_error: 'Endpoint name is required' })
            .min(3)
            .max(63, {
                message: 'Name cannot be more than 63 characters',
            })
            .regex(/^[a-zA-Z0-9-]*$/, {
                message:
                    'Maximum of 63 alphanumeric characters. Can include hyphens (-), but not spaces. Must be unique within your account in an AWS Region',
            }),
    });

    const { updateForm, touchFieldHandler, setState, state } = useValidationState(formSchema, {
        validateAll: false,
        needsValidation: false,
        form: {
            ...endpoint,
        },
        touched: {},
        formErrors: {} as any,
        formValid: false,
        formSubmitting: false,
    });

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Endpoint', href: `#/project/${projectName}/endpoint` },
                {
                    text: 'Create Endpoint',
                    href: `#/project/${projectName}/endpoint/create `,
                },
            ])
        );

        scrollToPageHeader('h1', 'Create and configure endpoint');
    }, [dispatch, projectName]);

    function handleSubmit () {
        // revalidate and show all errors
        setState({ type: 'updateState', payload: { validateAll: true, needsValidation: true } });
        scrollToInvalid();

        const newEndpoint: IEndpoint = { ...endpoint, EndpointName: state.form.EndpointName };
        if (state.formValid) {
            setState({ type: 'updateState', payload: { formSubmitting: true } });
            setSubmitLoading(true);
            if (newEndpoint.EndpointConfigName !== undefined) {
                createEndpoint({
                    endpoint: newEndpoint,
                    projectName: projectName!,
                })
                    .then((response) => {
                        if (response.status === 200) {
                            notificationService.generateNotification(
                                `Successfully created endpoint: ${newEndpoint.EndpointName}`,
                                'success'
                            );
                            setState({ type: 'updateState', payload: { formSubmitting: false } });
                            setSubmitLoading(false);
                            navigate(
                                `/project/${projectName}/endpoint/${newEndpoint.EndpointName}`
                            );
                        } else {
                            notificationService.generateNotification(
                                `Failed to create endpoint with error: ${response.data}`,
                                'error'
                            );
                        }
                    })
                    .catch((err) => {
                        notificationService.generateNotification(
                            `Failed to create endpoint with error: ${err.response.data}`,
                            'error'
                        );
                    })
                    .finally(() => {
                        setState({ type: 'updateState', payload: { formSubmitting: false } });
                        setSubmitLoading(false);
                    });
            } else {
                notificationService.generateNotification(
                    'You need to select or create an Endpoint configuration to create an Endpoint.',
                    'error'
                );
                setState({ type: 'updateState', payload: { formSubmitting: false } });
                setSubmitLoading(false);
            }
        }
    }

    const selectExistingConfig = (existingConfig?: IEndpointConfig, createdNew?: boolean) => {
        if (createdNew) {
            setCreatedNewConfig(true);
        }
        setEndpoint({
            ...endpoint,
            EndpointConfigName: existingConfig?.EndpointConfigName,
        });
        if (endpointConfigType !== 'existing') {
            setEndpointConfigType('existing');
        }
        setNewEndpointConfig(existingConfig);
    };

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description='To deploy models to Amazon SageMaker, first create an endpoint. Provide an endpoint configuration to specify which models to deploy and the hardware requirements for each.'
                >
                    Create and configure endpoint
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
                                navigate(`/project/${projectName}/endpoint`, {
                                    state: { prevPath: window.location.hash },
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            iconAlt='Create Endpoint'
                            variant='primary'
                            onClick={handleSubmit}
                            disabled={state.formSubmitting}
                            loading={submitLoading}
                        >
                            Create endpoint
                        </Button>
                    </SpaceBetween>
                }
                errorText={errorText}
            >
                <SpaceBetween direction='vertical' size='xl'>
                    <Container header={<Header variant='h2'>Endpoint</Header>}>
                        <FormField
                            label='Endpoint name'
                            constraintText={generateNameConstraintText()}
                            errorText={state.formErrors.EndpointName}
                        >
                            <Input
                                value={state.form.EndpointName}
                                onChange={(event) => {
                                    updateForm({ EndpointName: event.detail.value });
                                }}
                                onBlur={touchFieldHandler('EndpointName')}
                            />
                        </FormField>
                    </Container>
                    <Container header={<Header variant='h2'>Attach endpoint configuration</Header>}>
                        <Tiles
                            onChange={({ detail }) => setEndpointConfigType(detail.value)}
                            value={endpointConfigType}
                            items={[
                                {
                                    label: 'Use an existing endpoint configuration',
                                    description:
                                        'Use an existing endpoint configuration or clone an endpoint configuration.',
                                    value: 'existing',
                                },
                                {
                                    label: 'Create a new endpoint configuration',
                                    description:
                                        'Add models and configure the instance and initial weight for each model.',
                                    value: 'new',
                                },
                            ]}
                        />
                    </Container>
                    <Alert
                        onDismiss={() => setCreatedNewConfig(false)}
                        visible={createdNewConfig}
                        dismissAriaLabel='Close alert'
                        dismissible
                        type='success'
                    >
                        Success! You created an endpoint configuration. You can apply your endpoint
                        configuration and create an endpoint.
                    </Alert>
                    {endpointConfigType === 'existing' ? (
                        newEndpointConfig ? (
                            <NewEndpointConfigDetails
                                endpointConfig={newEndpointConfig}
                                canEdit={false}
                                changeConfig={() => selectExistingConfig()}
                            />
                        ) : (
                            <Container>
                                <EndpointConfig
                                    isEmbedded={true}
                                    selectEndpointConfig={selectExistingConfig}
                                />
                            </Container>
                        )
                    ) : (
                        <EndpointConfigCreate createConfigCallback={selectExistingConfig} />
                    )}
                </SpaceBetween>
            </Form>
        </ContentLayout>
    );
}

export default EndpointCreate;
