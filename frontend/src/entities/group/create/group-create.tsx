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

import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { issuesToErrors, useValidationReducer } from '../../../shared/validation';
import { useAppDispatch } from '../../../config/store';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Container, FormField, Header, Input, SpaceBetween, Textarea, } from '@cloudscape-design/components';
import Form from '@cloudscape-design/components/form';
import ContentLayout from '../../../shared/layout/content-layout';
import { createGroup, getGroup, updateGroup } from '../group.reducer';

export type GroupCreateProperties = {
    isEdit?: boolean;
};

export function GroupCreate ({isEdit}: GroupCreateProperties) {
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const navigate = useNavigate();
    const {groupName} = useParams();
    const [initialLoaded, setInitialLoaded] = useState(false);

    const groupSchema = z.object({
        name: z
            .string()
            .min(3, {
                message: 'Group name must be longer than 3 characters',
            })
            .max(24, {
                message: 'Group name cannot be more than 24 characters',
            })
            .regex(/^[a-zA-Z0-9]+$/, {
                message: 'Group name can only contain alphanumeric characters.',
            }),
        description: z
            .string({
                invalid_type_error: 'Group description must be a string',
            })
            .min(1, {
                message: 'Group description cannot be empty',
            })
            .max(4000, {
                message: 'Group description cannot be more than 4000 characters.',
            })
            .regex(/[ -~]/, {
                message: 'Group description can only contain printable characters',
            }),
    });

    const {state, setState, setFields, touchFields} = useValidationReducer(groupSchema, {
        validateAll: false,
        needsValidation: false,
        form: {
            name: '',
            description: '',
        },
        touched: {},
        formErrors: {} as any,
        formSubmitting: false,
    });

    useMemo(() => {
        if (isEdit && !initialLoaded) {
            setState({formSubmitting: true});
            dispatch(getGroup(groupName)).then((response) => {
                if (response.payload) {
                    setInitialLoaded(true);
                    setState({
                        form: {
                            name: response.payload?.data.group?.name || '',
                            description: response.payload?.data.group?.description || '',
                        },
                        formSubmitting: false
                    });
                } else {
                    navigate('/404');
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit, groupName, initialLoaded]);


    state.formErrors = {};
    const parseResult = groupSchema.safeParse(state.form);
    if (!parseResult.success) {
        state.formErrors = issuesToErrors(
            parseResult.error.issues,
            state.validateAll === true ? undefined : state.touched
        );
    }

    async function handleSubmit () {
        setState({formSubmitting: true});
        let response = null;
        try {
            if (!isEdit) {
                response = await dispatch(createGroup(state.form));
            } else {
                response = await dispatch(updateGroup(state.form));
            }
            if (response.payload?.status === 200) {
                notificationService.generateNotification(
                    `Successfully ${isEdit ? 'updated' : 'created'} group ${state.form.name}`,
                    'success'
                );
                navigate('/admin/groups');
            } else {
                notificationService.generateNotification(
                    `Failed to ${isEdit ? 'update' : 'create'} group ${state.form.name} with error: ${response.error.message}`,
                    'error'
                );
            }
        } catch (e) {
            notificationService.generateNotification(
                `Failed to ${isEdit ? 'update' : 'create'} group ${state.form.name}`,
                'error'
            );
        } finally {
            setState({formSubmitting: false});
        }
    }

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description={`${window.env.APPLICATION_NAME} allows users to share datasets and projects with ${window.env.APPLICATION_NAME} managed user groups.`}
                >
                    {isEdit ? 'Update group' : 'Create group'}
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
                                navigate('/admin/groups', {
                                    state: {prevPath: window.location.hash},
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            data-cy='submit'
                            loading={state.formSubmitting}
                            variant='primary'
                            onClick={() => {
                                handleSubmit();
                            }}
                            disabled={state.formSubmitting || !parseResult.success}
                        >
                            Submit
                        </Button>
                    </SpaceBetween>
                }
            >
                <Container header={<Header variant='h2'>Group details</Header>}>
                    <SpaceBetween direction='vertical' size='m'>
                        <FormField
                            description='The name can only contain alphanumeric characters.'
                            errorText={state.formErrors.name}
                            label='Group name'
                        >
                            <Input
                                data-cy='name-input'
                                value={state.form.name!}
                                onChange={(event) => {
                                    setFields({'name': event.detail.value});
                                }}
                                onBlur={() => touchFields(['name'])}
                                disabled={isEdit}
                            />
                        </FormField>
                        <FormField
                            description='Set a description for your group.'
                            errorText={state.formErrors.description}
                            label='Group description'
                        >
                            <Textarea
                                data-cy='description-input'
                                value={state.form.description!}
                                onChange={(event) => {
                                    setFields({'description': event.detail.value});
                                }}
                                onBlur={() => touchFields(['description'])}
                            />
                        </FormField>
                    </SpaceBetween>
                </Container>
            </Form>
        </ContentLayout>
    );
}

export default GroupCreate;