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
import { useNavigate, useParams } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import {
    Button,
    SpaceBetween,
    Header,
    FormField,
    Container,
    StatusIndicator,
    Textarea,
    Input,
    ContentLayout,
    Multiselect,
    SelectProps,
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { DatasetType, IDataset } from '../../../shared/model/dataset.model';
import {
    getDataset,
    editDataset,
    datasetBinding,
    loadingDataset,
} from '../dataset.reducer';
import { z } from 'zod';
import { scrollToInvalid, useValidationState } from '../../../shared/validation';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { selectCurrentUser } from '../../user/user.reducer';
import { useNotificationService } from '../../../shared/util/hooks';
import { getAllGroups } from '../../group/group.reducer';
import { IGroup } from '../../../shared/model/group.model';
import { DatasetProperties } from '../dataset';

const formSchema = z.object({
    description: z.string().regex(/^[\w\-\s']+$/, {
        message: 'Dataset description can contain only alphanumeric characters.',
    }),
});

export function DatasetUpdate ({isAdmin}: DatasetProperties) {
    const dataset: IDataset = useAppSelector(datasetBinding);
    const groups: IGroup[] = useAppSelector((state) => state.group.allGroups);
    const { projectName, type, scope, name } = useParams();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    let basePath = '';
    if (isAdmin) {
        basePath = '/admin/datasets';
    } else {
        basePath = `${projectName ? `/project/${projectName}` : '/personal'}/dataset`;
    }
    const notificationService = useNotificationService(dispatch);
    const loadingDatasetEditPage = useAppSelector(loadingDataset);

    scrollToPageHeader();
    DocTitle('Edit Dataset: ', dataset.name);

    const { updateForm, updateList, touchFieldHandler, setState, state } = useValidationState(formSchema, {
        validateAll: false,
        needsValidation: false,
        form: {
            ...dataset,
        },
        touched: {
            inputDataConfig: [],
        },
        formErrors: {} as any,
        formValid: false,
        formSubmitting: false,
    });

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Datasets', href: `#${basePath}`},
                { text: `${name}`, href: `#${basePath}/${type}/${scope}/${name}/edit` },
            ])
        );
        dispatch(getDataset({ type: type, scope: scope, name: name }))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
        dispatch(getAllGroups());
    }, [dispatch, navigate, basePath, name, projectName, scope, type, isAdmin]);

    function handleSubmit () {
        if (state.formValid) {
            setState({ type: 'updateState', payload: { formSubmitting: true } });
            dispatch(editDataset({ ...state.form })).then((response) => {
                if (response.type.endsWith('/fulfilled')) {
                    notificationService.generateNotification(
                        'Successfully updated Dataset.',
                        'success'
                    );
                    navigate(basePath);
                } else {
                    notificationService.generateNotification('Failed to update Dataset.', 'error');
                }
            });
        } else {
            scrollToInvalid();
        }
        setState({ type: 'updateState', payload: { formSubmitting: false } });
    }

    function generateGroupOptions () {
        const groupOptions: SelectProps.Option[] = [];
        groups.map((group) => {
            groupOptions.push({ label: group.name, value: group.name});
        });
        return groupOptions;
    }

    const currentUser = useAppSelector(selectCurrentUser);

    const disabled = dataset.createdBy !== currentUser.username || state.formSubmitting;

    return (
        <ContentLayout headerVariant='high-contrast' header={<Header variant='h1'>Update Dataset {dataset.name}</Header>}>
            <SpaceBetween direction='vertical' size='xxl'>
                <Container>
                    {loadingDatasetEditPage ? (
                        <StatusIndicator type='loading'>Loading properties</StatusIndicator>
                    ) : (
                        <Form
                            actions={
                                <SpaceBetween direction='horizontal' size='xl'>
                                    <Button
                                        formAction='none'
                                        variant='link'
                                        onClick={() => navigate(basePath)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        loading={state.formSubmitting}
                                        variant='primary'
                                        onClick={() => {
                                            setState({ type: 'validateAll' });
                                            handleSubmit();
                                        }}
                                        disabled={disabled}
                                    >
                                        Update dataset
                                    </Button>
                                </SpaceBetween>
                            }
                        >
                            <SpaceBetween direction='vertical' size='m'>
                                <FormField label='Dataset type'>
                                    <Input
                                        data-cy='dataset-type'
                                        value={dataset.type || 'Unknown'}
                                        disabled
                                    />
                                </FormField>
                                <FormField label='Owner'>
                                    <Input
                                        data-cy='dataset-owner'
                                        value={dataset.createdBy || 'Unknown'}
                                        disabled
                                    />
                                </FormField>
                                <FormField label='Location'>
                                    <Textarea
                                        data-cy='dataset-location'
                                        value={dataset.location || 'Unknown'}
                                        disabled
                                    />
                                </FormField>
                                <FormField
                                    label='Description'
                                    errorText={state.formErrors.description}
                                    description='Description is required.'
                                >
                                    <Textarea
                                        data-cy='dataset-description'
                                        value={state.form.description}
                                        onChange={(event) => {
                                            updateForm({ description: event.detail.value });
                                        }}
                                        onBlur={touchFieldHandler('description')}
                                    />
                                </FormField>
                                {dataset.type === DatasetType.GROUP &&
                                    <FormField
                                        label='Groups'
                                        description='Select which groups to share this Group dataset with.'
                                    >
                                        <Multiselect
                                            selectedOptions={state.form.groups.map((group) => {
                                                return {label: group, value: group};
                                            })}
                                            onChange={({ detail }) => {
                                                const groupList = detail.selectedOptions.map((option) => {
                                                    return option.value;
                                                });
                                                updateList({groups: groupList});
                                            }}
                                            
                                            options={generateGroupOptions()}
                                            placeholder='Choose one or more groups'
                                            deselectAriaLabel={(e) => `Remove ${e.label}`}
                                            selectedAriaLabel='Selected groups'
                                            filteringType='auto'
                                            data-cy='group-name-multiselect'
                                        />
                                    </FormField>
                                }
                            </SpaceBetween>
                        </Form>
                    )}
                </Container>
            </SpaceBetween>
        </ContentLayout>
    );
}

export default DatasetUpdate;
