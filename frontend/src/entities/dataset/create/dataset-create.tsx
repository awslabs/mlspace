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

import React, { useCallback, useEffect, useState } from 'react';
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
    Popover,
    StatusIndicator,
    Alert,
    Textarea,
    Multiselect,
    SelectProps,
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import {
    IDataset,
    defaultDataset,
    DatasetType,
} from '../../../shared/model/dataset.model';
import { initCap } from '../../../shared/util/enum-utils';
import './dataset-create.styles.css';
import { createDataset, uploadResources } from '../dataset.service';
import { z } from 'zod';
import { createDatasetFromForm } from './dataset-create-functions';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { scrollToInvalid, useValidationReducer } from '../../../shared/validation';
import { DocTitle, scrollToPageHeader } from '../../../shared/doc';
import DatasetBrowser from '../../../modules/dataset/dataset-browser';
import { DatasetBrowserActions } from '../dataset.actions';
import { DatasetBrowserManageMode } from '../../../modules/dataset/dataset-browser.types';
import { DatasetResourceObject } from '../../../modules/dataset/dataset-browser.reducer';
import { useUsername } from '../../../shared/util/auth-utils';
import ContentLayout from '../../../shared/layout/content-layout';
import { getAllGroups } from '../../group/group.reducer';
import { IGroup } from '../../../shared/model/group.model';
import { useNotificationService } from '../../../shared/util/hooks';
import { OptionDefinition } from '@cloudscape-design/components/internal/components/option/interfaces';
import Condition from '../../../modules/condition';
import Axios from 'axios';

const formSchema = z.object({
    name: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[a-zA-Z0-9-]*$/, {
            message:
                'Dataset name must not be empty, can contain only alphanumeric characters, and be between 1 and 255 characters',
        }),
    description: z
        .string()
        .regex(/^[\w\-\s'.]+$/, {
            message: 'Dataset description can contain only alphanumeric characters.',
        })
        .max(254)
});

export function DatasetCreate () {
    const username = useUsername();
    const [dataset] = useState(defaultDataset as IDataset);
    const [datasetFileList, setDatasetFileList] = useState([] as DatasetResourceObject[]);
    const groups: IGroup[] = useAppSelector((state) => state.group.allGroups);
    const { projectName = '' } = useParams();

    scrollToPageHeader();
    DocTitle('Create Dataset');

    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const basePath = projectName ? `/project/${projectName}` : '/personal';
    const notificationService = useNotificationService(dispatch);

    const { state, setState, errors, isValid, touchFields, setFields } = useValidationReducer(formSchema, {
        validateAll: false,
        form: {
            name: '',
            description: '',
            type: DatasetType.PRIVATE,
            groupNames: [] as OptionDefinition[],
        },
        touched: {},
        formSubmitting: false,
    });

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Datasets', href: `#${basePath}/dataset` },
                { text: 'Create dataset', href: `#${basePath}/dataset/create` },
            ])
        );

        scrollToPageHeader('h1', 'dataset');
    }, [dispatch, basePath, projectName]);

    useEffect(() => {
        dispatch(getAllGroups());
    }, [dispatch]);

    function generateOptions () {
        // Standard options always available
        const options: { label: string; value?: string; options?: any[] }[] = [
            {label: initCap(DatasetType.GLOBAL), value: DatasetType.GLOBAL},
            {label: initCap(DatasetType.PRIVATE), value: DatasetType.PRIVATE},
        ];

        if (projectName) {
            options.push({ label: initCap(DatasetType.PROJECT), value: DatasetType.PROJECT });
        }

        if (groups) {
            options.push({ label: initCap(DatasetType.GROUP), value: DatasetType.GROUP });
        }

        return options;
    }

    function generateGroupOptions () {
        const groupOptions: SelectProps.Option[] = [];
        groups.map((group) => {
            groupOptions.push({ label: group.name, value: group.name});
        });
        return groupOptions;
    }

    async function handleSubmit () {
        if (isValid) {
            setState({ formSubmitting: true });

            // create new dataset from state.form
            const newDataset = createDatasetFromForm(state.form, projectName, username);
            const response = await createDataset(newDataset).catch((error) => {
                if (Axios.isAxiosError(error)) {
                    // if dataset exists display message to user
                    notificationService.generateNotification(
                        `Failed to create dataset. ${error.message}`,
                        'error'
                    );
                }
            });

            if (response?.status === 200) {
                const resourceObjects = datasetFileList.filter((item): item is DatasetResourceObject => item.type === 'object');
                await uploadResources(newDataset, resourceObjects, notificationService);

                let scope = newDataset.scope;
                if (newDataset.type === DatasetType.GROUP) {
                    scope = DatasetType.GROUP;
                }

                // Need to clear state/reset the form
                navigate(`${basePath}/dataset/${newDataset.type}/${scope}/${newDataset.name}`);
            }
            
            setState({ formSubmitting: false });
        } else {
            scrollToInvalid();
        }
    }

    return (
        <ContentLayout
            headerVariant='high-contrast'
            header={
                <Header
                    variant='h1'
                    description='A Dataset is a collection of artifacts that contain data to be used in SageMaker. This can can include Training, HPO, and Batch Transform jobs.'
                >
                    Create dataset
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
                                navigate(`${basePath}/dataset`, {
                                    state: { prevPath: window.location.hash },
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Popover
                            dismissAriaLabel='Close'
                            triggerType='custom'
                            content={
                                isValid ? (
                                    <StatusIndicator type='info'>
                                        Do not navigate away while dataset is being created.
                                    </StatusIndicator>
                                ) : (
                                    <StatusIndicator type='error'>
                                        All sections must be filled out.
                                    </StatusIndicator>
                                )
                            }
                        >
                            <Button
                                data-cy='dataset-submit-button'
                                loading={state.formSubmitting}
                                variant='primary'
                                onClick={() => {
                                    setState({ validateAll: true });
                                    handleSubmit();
                                }}
                                disabled={!isValid}
                            >
                                Create dataset
                            </Button>
                        </Popover>
                    </SpaceBetween>
                }
            >
                <SpaceBetween direction='vertical' size='xl'>
                    <Container>
                        <SpaceBetween direction='vertical' size='s'>
                            <FormField
                                description='Maximum of 255 characters. Must be unique to the type that you choose. The dataset name must be unique to the scope (Global/Private/Project/Group).'
                                errorText={errors.name}
                                label='Dataset name'
                            >
                                <Input
                                    data-cy='dataset-name-input'
                                    value={state.form.name}
                                    onChange={({detail}) => setFields({name: detail.value})}
                                    onBlur={() => touchFields(['name'])}
                                />
                            </FormField>
                            <FormField
                                description='Description is required.'
                                errorText={errors.description}
                                label='Description'
                            >
                                <Textarea
                                    data-cy='dataset-description-textarea'
                                    value={state.form.description}
                                    onChange={({detail}) => setFields({description: detail.value})}
                                    onBlur={() => touchFields(['description'])}
                                />
                            </FormField>
                            <FormField
                                description={
                                    window.env.MANAGE_IAM_ROLES ? (
                                        'Global datasets are accessible from any project, project datasets ' +
                                        'are accessible only to the project they were created in, group datasets ' +
                                        'are accessible only to members of that group, and private datasets ' +
                                        'are accessible only to the user that created them.'
                                    ) : (
                                        <Alert
                                            statusIconAriaLabel='Info'
                                            header='Dataset Access Limitations'
                                        >
                                            Dataset Type is used as a convention to organize data within
                                            S3 but <strong>does not</strong> prevent other {window.env.APPLICATION_NAME} users
                                            from accessing data. Making a &quot;Private&quot; or
                                            &quot;Project&quot; dataset is merely a convention and does
                                            not enforce access control.
                                        </Alert>
                                    )
                                }
                                errorText={errors.type}
                                label='Dataset Type'
                            >
                                <Select
                                    data-cy='dataset-type-select'
                                    selectedOption={{
                                        label: initCap(state.form.type),
                                        value: state.form.type,
                                    }}
                                    options={generateOptions()}
                                    onChange={({ detail }) => {
                                        setFields({type: detail.selectedOption.value as keyof typeof DatasetType});
                                    }}
                                    onBlur={() => touchFields(['type'])}
                                />
                            </FormField>
                            <Condition condition={state.form.type === DatasetType.GROUP}>
                                <FormField
                                    description={
                                        'Group datasets are accessible only to members of that group. ' +
                                        'A dataset may be associated with multiple groups.'
                                    }
                                    errorText={errors.groupNames}
                                    label='Groups'
                                >
                                    <Multiselect
                                        selectedOptions={state.form.groupNames}
                                        onChange={({ detail }) => {
                                            setFields({groupNames: detail.selectedOptions});
                                        }}
                                        
                                        options={generateGroupOptions()}
                                        placeholder='Choose one or more groups'
                                        deselectAriaLabel={(e) => `Remove ${e.label}`}
                                        selectedAriaLabel='Selected groups'
                                        filteringType='auto'
                                        data-cy='group-name-multiselect'
                                    />
                                </FormField>
                            </Condition>
                        </SpaceBetween>
                    </Container>
                    <Container>
                        <DatasetBrowser
                            resource={dataset.location || ''}
                            actions={DatasetBrowserActions}
                            selectableItemsTypes={['objects']}
                            manageMode={DatasetBrowserManageMode.Create}
                            onItemsChange={useCallback(({detail}) => {
                                setDatasetFileList(detail.items.filter((item): item is DatasetResourceObject => item.type === 'object'));
                            }, [setDatasetFileList])}
                        />
                    </Container>
                </SpaceBetween>
            </Form>
        </ContentLayout>
    );
}

export default DatasetCreate;
