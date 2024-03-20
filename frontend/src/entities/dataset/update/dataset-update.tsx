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
    Container,
    ContentLayout,
    StatusIndicator,
    Textarea,
    Input,
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { IDataset } from '../../../shared/model/dataset.model';
import {
    getDatasetByScopeAndName,
    editDataset,
    datasetBinding,
    loadingDataset,
} from '../dataset.reducer';
import { ExpandableSection } from '@cloudscape-design/components';
import { ManageFiles } from '../manage/dataset.files';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { z } from 'zod';
import { scrollToInvalid, useValidationState } from '../../../shared/validation';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { selectCurrentUser } from '../../user/user.reducer';

const formSchema = z.object({
    description: z.string().regex(/^[\w\-\s']+$/, {
        message: 'Dataset description can contain only alphanumeric characters.',
    }),
});

export function DatasetUpdate () {
    const dataset: IDataset = useAppSelector(datasetBinding);
    const { projectName, scope, name } = useParams();
    const [submitLoading, setSubmitLoading] = useState(false);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const basePath = projectName ? `/project/${projectName}` : '/personal';
    const notificationService = NotificationService(dispatch);
    const loadingDatasetEditPage = useAppSelector(loadingDataset);

    scrollToPageHeader();
    DocTitle('Edit Dataset: ', dataset.name);

    const { updateForm, touchFieldHandler, setState, state } = useValidationState(formSchema, {
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
                { text: 'Datasets', href: `#${basePath}/dataset` },
                { text: `${name}`, href: `#${basePath}/dataset/${scope}/${name}/edit` },
            ])
        );
        dispatch(getDatasetByScopeAndName({ scope: scope, name: name }))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
    }, [dispatch, navigate, basePath, name, projectName, scope]);

    function handleSubmit () {
        if (state.formValid) {
            setState({ type: 'updateState', payload: { formSubmitting: true } });
            setSubmitLoading(true);

            dispatch(editDataset({ ...state.form })).then((response) => {
                if (response.type.endsWith('/fulfilled')) {
                    notificationService.generateNotification(
                        'Successfully updated Dataset.',
                        'success'
                    );
                    navigate(`${basePath}/dataset`);
                } else {
                    notificationService.generateNotification('Failed to update Dataset.', 'error');
                }
            });
        } else {
            scrollToInvalid();
        }
        setState({ type: 'updateState', payload: { formSubmitting: false } });
        setSubmitLoading(false);
    }

    const currentUser = useAppSelector(selectCurrentUser);

    const disabled = dataset.createdBy !== currentUser.username || state.formSubmitting;

    return (
        <ContentLayout header={<Header variant='h1'>Update Dataset {dataset.name}</Header>}>
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
                                        onClick={() => navigate(`${basePath}/dataset`)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        loading={submitLoading}
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
                            </SpaceBetween>
                        </Form>
                    )}
                </Container>
                <Container>
                    {loadingDatasetEditPage ? (
                        <StatusIndicator type='loading'>Loading files</StatusIndicator>
                    ) : (
                        <ExpandableSection
                            data-cy='dataset-manage-files-expand'
                            headerText='Manage files'
                        >
                            <ManageFiles dataset={dataset} readOnly={false} />
                        </ExpandableSection>
                    )}
                </Container>
            </SpaceBetween>
        </ContentLayout>
    );
}

export default DatasetUpdate;
