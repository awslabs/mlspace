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
} from '@cloudscape-design/components';
import { useAppDispatch } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import {
    IEndpointConfig,
    defaultEndpointConfig,
} from '../../../shared/model/endpoint-config.model';
import { ProductionVariantsTable } from '../common-components';
import { DataCapture } from './data-capture';
import {
    createEndpointConfig,
    setSelectedVariant,
    toggleEditVariantModal,
} from '../endpoint-config.reducer';
import { AddModelModal, EditVariantModal } from './modals';
import { ConditionalWrapper } from '../../../modules/condition/condition';
import { getEndpointConfigByName } from '../endpoint-config.service';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { scrollToInvalid, useValidationState } from '../../../shared/validation';
import { z } from 'zod';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { setTableAnnouncement } from '../../../shared/util/table-utils';
import { generateNameConstraintText } from '../../../shared/util/form-utils';
import ContentLayout from '../../../shared/layout/content-layout';
import { useNotificationService } from '../../../shared/util/hooks';

type EndpointConfigCreateOptions = {
    createConfigCallback?: (endpointConfig: IEndpointConfig, createdNew: boolean) => void;
};

export function EndpointConfigCreate ({ createConfigCallback }: EndpointConfigCreateOptions) {
    const [endpointConfig, setEndpointConfig] = useState(defaultEndpointConfig as IEndpointConfig);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [errorText] = useState('');
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const notificationService = useNotificationService(dispatch);

    if (!createConfigCallback) {
        DocTitle('Create Endpoint Config');
    }

    //We prepend the endpoint config with '{projectname}-'
    const formSchema = z.object({
        EndpointConfigName: z
            .string()
            .min(3)
            .max(63, {
                message: 'Name cannot be more than 63 characters.',
            })
            .regex(/^[a-zA-Z0-9-]*$/, {
                message: generateNameConstraintText(),
            }),
    });

    const { updateForm, touchFieldHandler, setState, state } = useValidationState(formSchema, {
        validateAll: false,
        needsValidation: false,
        form: {
            ...endpointConfig,
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
                { text: 'Endpoint Configs', href: `#/project/${projectName}/endpoint-config` },
                {
                    text: 'Create endpoint configuration',
                    href: `#/project/${projectName}/endpoint-config/create`,
                },
            ])
        );

        scrollToPageHeader('h1', 'Create endpoint configuration');
    }, [dispatch, projectName]);

    async function handleSubmit () {
        // revalidate and show all errors
        setState({ type: 'updateState', payload: { validateAll: true, needsValidation: true } });
        scrollToInvalid();

        const newEndpointConfig = {
            ...endpointConfig,
            EndpointConfigName: state.form.EndpointConfigName,
        };
        if (state.formValid) {
            setState({ type: 'updateState', payload: { formSubmitting: true } });
            setSubmitLoading(true);
            if (newEndpointConfig.ProductionVariants!.length !== 0) {
                try {
                    const response = await createEndpointConfig({
                        endpointConfig: newEndpointConfig,
                        projectName: projectName!,
                    });
                    if (response.status === 200) {
                        if (!createConfigCallback) {
                            notificationService.generateNotification(
                                `Successfully created endpoint configuration: ${newEndpointConfig.EndpointConfigName}`,
                                'success'
                            );
                            navigate(
                                `/project/${projectName}/endpoint-config/${newEndpointConfig.EndpointConfigName}`
                            );
                        } else {
                            try {
                                const newConfig = await getEndpointConfigByName(
                                    `${newEndpointConfig.EndpointConfigName!}`
                                );
                                createConfigCallback(newConfig.data, true);
                            } catch (err) {
                                notificationService.generateNotification(
                                    `Failed to retrieve endpoint configuration details with error: ${response.data}`,
                                    'error'
                                );
                                setState({
                                    type: 'updateState',
                                    payload: { formSubmitting: false },
                                });
                                setSubmitLoading(false);
                            }
                        }
                    }
                } catch (err: any) {
                    notificationService.generateNotification(
                        `Failed to retrieve endpoint configuration details with error: ${err.response.data}`,
                        'error'
                    );
                }
            } else {
                notificationService.generateNotification(
                    'Failed to create endpoint configuration: at least one Production Variant must be selected.',
                    'error'
                );
            }
        } else {
            scrollToInvalid();
        }
        setState({ type: 'updateState', payload: { formSubmitting: false } });
        setSubmitLoading(false);
    }

    const embeddedWrapper = (condition: boolean, children: any) => {
        if (condition) {
            return (
                <Container header={<Header variant='h2'>{'New endpoint configuration'} </Header>}>
                    {children}
                </Container>
            );
        }
        return (
            <ContentLayout
                headerVariant='high-contrast' 
                header={
                    <Header
                        variant='h1'
                        description='To deploy models to Amazon SageMaker, first create an endpoint configuration. In the configuration, specify which models to deploy, and the relative traffic weighting and hardware requirements for each.'
                    >
                        Create endpoint configuration
                    </Header>
                }
            >
                {children}
            </ContentLayout>
        );
    };

    return (
        <ConditionalWrapper condition={!!createConfigCallback} wrapper={embeddedWrapper}>
            <Form
                actions={
                    <SpaceBetween direction='horizontal' size='xs'>
                        {!createConfigCallback ? (
                            <Button
                                formAction='none'
                                iconAlt='Cancel'
                                variant='link'
                                onClick={() => {
                                    navigate(`/project/${projectName}/endpoint-config`, {
                                        state: { prevPath: window.location.hash },
                                    });
                                }}
                            >
                                Cancel
                            </Button>
                        ) : undefined}
                        <Button
                            iconAlt='Create endpoint config'
                            variant='primary'
                            onClick={() => {
                                setState({ type: 'validateAll' });
                                handleSubmit();
                            }}
                            disabled={state.formSubmitting}
                            loading={submitLoading}
                        >
                            Create endpoint configuration
                        </Button>
                    </SpaceBetween>
                }
                errorText={errorText}
            >
                <SpaceBetween direction='vertical' size='xl'>
                    <Container
                        header={
                            <Header variant={createConfigCallback ? 'h3' : 'h2'}>
                                {'Endpoint configuration'}{' '}
                            </Header>
                        }
                    >
                        <SpaceBetween direction='vertical' size='xxl'>
                            <FormField
                                label='Endpoint configuration name'
                                constraintText={generateNameConstraintText()}
                                errorText={state.formErrors.EndpointConfigName}
                            >
                                <Input
                                    value={state.form.EndpointConfigName}
                                    onChange={(event) => {
                                        updateForm({ EndpointConfigName: event.detail.value });
                                    }}
                                    onBlur={touchFieldHandler('EndpointConfigName')}
                                />
                            </FormField>
                        </SpaceBetween>
                    </Container>
                    <DataCapture
                        endpointConfig={endpointConfig}
                        setEndpointConfig={setEndpointConfig}
                        variant={createConfigCallback ? 'embedded' : 'default'}
                    />
                    <ProductionVariantsTable
                        endpointConfig={endpointConfig}
                        projectName={projectName}
                        canEdit={true}
                        tableItemAction={async (action, itemKey) => {
                            if (action === 'remove') {
                                const currentVariants = endpointConfig.ProductionVariants!;
                                currentVariants.splice(
                                    currentVariants.findIndex((v) => v.VariantName === itemKey),
                                    1
                                );
                                setEndpointConfig({
                                    ...endpointConfig,
                                    ProductionVariants: currentVariants,
                                });
                                setTableAnnouncement('Selected model removed from table');
                            } else if (action === 'edit') {
                                await dispatch(
                                    setSelectedVariant(
                                        endpointConfig.ProductionVariants?.find(
                                            (v) => v.VariantName === itemKey
                                        )
                                    )
                                );
                                dispatch(toggleEditVariantModal(true));
                            }
                        }}
                        variant={createConfigCallback ? 'embedded' : 'default'}
                    />
                </SpaceBetween>
            </Form>
            <AddModelModal endpointConfig={endpointConfig} setEndpointConfig={setEndpointConfig} />
            <EditVariantModal
                endpointConfig={endpointConfig}
                setEndpointConfig={setEndpointConfig}
            />
        </ConditionalWrapper>
    );
}

export default EndpointConfigCreate;
