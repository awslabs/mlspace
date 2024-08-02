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
import { z } from 'zod';
import { useValidationReducer } from '../../../shared/validation';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Box,
    Button,
    Container,
    FormField,
    Header,
    Input,
    SpaceBetween,
    Textarea,
} from '@cloudscape-design/components';
import Form from '@cloudscape-design/components/form';
import ContentLayout from '../../../shared/layout/content-layout';
import { addUserVisibleColumns, userColumns } from '../../user/user.columns';
import Table from '../../../modules/table';
import { IUser } from '../../../shared/model/user.model';
import { addUsersToGroup } from '../user/group-user-functions';
import { useAddGroupUsersMutation, useCreateGroupMutation, useGetGroupQuery, useUpdateGroupMutation } from '../group.reducer';

export type GroupCreateProperties = {
    isEdit?: boolean;
};

export function GroupCreate ({isEdit}: GroupCreateProperties) {
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const navigate = useNavigate();
    const {groupName} = useParams();
    const allUsers: IUser[] = useAppSelector((state) => state.user.allUsers);
    const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
    const [ createGroup, createGroupResult ] = useCreateGroupMutation();
    const [ updateGroup, updateGroupResult ] = useUpdateGroupMutation();
    const { data: group, isError: isErrorGroup } = useGetGroupQuery(groupName!);

    if (isEdit && isErrorGroup) {
        navigate('/404');
    }

    const [ addGroupUsers ] = useAddGroupUsersMutation();

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
            .regex(/^[ -~]+$/, {
                message: 'Group description can only contain printable characters',
            }),
    });

    const {state, errors, isValid, setFields, touchFields} = useValidationReducer(groupSchema, {
        validateAll: false,
        needsValidation: false,
        form: {
            name: group?.group.name || '',
            description: group?.group.description || '',
        },
        touched: {},
        formErrors: {} as any,
        formSubmitting: false,
    });

    [createGroupResult, updateGroupResult].forEach((result, index) => {
        if (result.isError) {
            console.log(index, result);
            notificationService.generateNotification(
                `Failed to ${isEdit ? 'update' : 'create' } group ${state.form.name} with error: ${result.error.data}`,
                'error'
            );
    
            result.reset();
        }
    });

    async function handleSubmit () {
        let response;
    
        if (!isEdit) {
            response = await createGroup(state.form);
        } else {
            response = await updateGroup(state.form);
        }
        console.log('response', response);
        
        if (!('error' in response)) {
            notificationService.generateNotification(
                `Successfully ${isEdit ? 'updated' : 'created'} group ${state.form.name}`,
                'success'
            );
            
            if (!isEdit && selectedUsers.length > 0){
                await addUsersToGroup(dispatch, state.form.name, selectedUsers, addGroupUsers);
            }
            navigate(`/admin/groups/${state.form.name}`);
        }
    }

    function addGroupUserTable (){
        if (!isEdit){
            return (
                <Box margin={{top: 'l'}}>
                    <SpaceBetween direction='vertical' size='m'>
                        <Header
                            description='Select users to be added to the group upon creation'
                            variant='h2'
                        >
                            Group users
                        </Header>
                        <Table
                            tableName='User'
                            header={<></>}
                            tableType='multi'
                            selectItemsCallback={(e) => {
                                setSelectedUsers(e || []);
                            }}
                            trackBy='username'
                            allItems={allUsers}
                            columnDefinitions={userColumns}
                            visibleColumns={addUserVisibleColumns}
                            variant='embedded'
                        />
                    </SpaceBetween>
                </Box>
            );
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
                            loading={updateGroupResult.isLoading || createGroupResult.isLoading}
                            variant='primary'
                            onClick={() => {
                                handleSubmit();
                            }}
                            disabled={updateGroupResult.isLoading || createGroupResult.isLoading || !isValid}
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
                            errorText={errors.name}
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
                            errorText={errors.description}
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
                    {addGroupUserTable()}
                </Container>
            </Form>
        </ContentLayout>
    );
}

export default GroupCreate;