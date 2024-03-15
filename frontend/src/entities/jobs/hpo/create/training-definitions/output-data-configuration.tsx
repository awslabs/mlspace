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
import { FormProps } from '../../../form-props';
import { ModifyMethod } from '../../../../../shared/validation/modify-method';
import { DatasetExtension, OutputDataConfig } from '../../hpo-job.model';
import {
    Box,
    Container,
    FormField,
    Header,
    RadioGroup,
    Select,
    SpaceBetween,
} from '@cloudscape-design/components';
import { DatasetType } from '../../../../../shared/model/dataset.model';
import { useAppDispatch } from '../../../../../config/store';
import { listDatasetsLocations } from '../../../../../entities/dataset/dataset.reducer';
import { useParams } from 'react-router-dom';
import { formatDisplayText } from '../../../../../shared/util/form-utils';
import { useAuth } from 'react-oidc-context';
import NotificationService from '../../../../../shared/layout/notification/notification.service';
import { datasetFromS3Uri } from '../../../../../shared/util/dataset-utils';

export type OutputDataConfigurationProps = FormProps<OutputDataConfig & DatasetExtension>;

export function OutputDataConfiguration (props: OutputDataConfigurationProps) {
    const { item, setFields, formErrors } = props;
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const auth = useAuth();
    const userName = auth.user!.profile.preferred_username;
    const notificationService = NotificationService(dispatch);

    const [state, setState] = React.useState({
        bucket: '',
        datasets: [] as any[],
        datasetsLoaded: false,
    });

    useEffect(() => {
        // Sets output dataset information
        if (!item.Dataset && item.S3OutputPath) {
            item.Dataset = datasetFromS3Uri(
                item.S3OutputPath
            );
        }
    }, [item]);

    useEffect(() => {
        let scope = 'global';
        switch (item.Dataset?.Type) {
            case DatasetType.PRIVATE:
                scope = userName!;
                break;
            case DatasetType.PROJECT:
                scope = projectName!;
                break;
        }

        dispatch(listDatasetsLocations({ scope, type: item.Dataset?.Type }))
            .then((response) => response.payload)
            .then((datasets) => {
                if (datasets) {
                    setState((s) => ({
                        ...s,
                        bucket: datasets.bucket,
                        datasets: datasets.locations,
                        datasetsLoaded: true,
                    }));
                } else {
                    setState((s) => ({
                        ...s,
                        bucket: '',
                        datasets: [],
                    }));
                }
            });
    }, [dispatch, item.Dataset?.Type, projectName, userName]);

    useEffect(() => {
        // Don't execute before datasets have returned, but can't check if empty, because could have no datasets
        if (item.Dataset?.Name && state.datasetsLoaded) {
            const dataset = state.datasets.find(
                (dataset: any) => dataset.name === item.Dataset.Name
            );
            // If the Dataset.Name is validated to be a valid dataset, set the location
            if (dataset) {
                setFields({ 'OutputDataConfig.S3OutputPath': dataset.location });
            } else {
                // If the Dataset.Name isn't valid, then clear the field
                // Should only apply if the Dataset.Name is set programmatically (e.g. cloning a training job)
                notificationService.generateNotification(
                    'The output location for the job is not available and was unset',
                    'warning'
                );
                setFields({ 'OutputDataConfig.Dataset.Name': undefined });
                setFields({ 'OutputDataConfig.S3OutputPath': '' }, ModifyMethod.Unset);
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.Dataset?.Name, state.datasetsLoaded]);

    return (
        <Container header={<Header>Output data configuration</Header>}>
            <SpaceBetween direction='vertical' size='m'>
                <FormField
                    label='Select an existing S3 path'
                    description='Your object path will be generated based on the S3 path you select below'
                />
                <FormField label='Data access type:'>
                    <RadioGroup
                        value={item.Dataset?.Type}
                        items={[
                            { value: DatasetType.PROJECT, label: 'Project' },
                            { value: DatasetType.PRIVATE, label: 'Private' },
                        ]}
                        onChange={(event) => {
                            setFields(
                                {
                                    'OutputDataConfig.Dataset': {
                                        Type: DatasetType[
                                            event.detail.value.toUpperCase() as keyof typeof DatasetType
                                        ],
                                    },
                                },
                                ModifyMethod.Set
                            );

                            setFields({ 'OutputDataConfig.S3OutputPath': '' }, ModifyMethod.Unset);
                        }}
                    ></RadioGroup>
                </FormField>
                <FormField
                    label='S3 location'
                    errorText={formErrors?.OutputDataConfig?.Dataset?.Name}
                >
                    <Select
                        placeholder='Select an output location'
                        empty='No datasets found.'
                        selectedOption={item.Dataset?.Name ? { value: item.Dataset?.Name } : null}
                        options={state.datasets.map(
                            (location: { name: string; location: string }) => {
                                return { value: location.name };
                            }
                        )}
                        onChange={(event) => {
                            // Setting the Dataset.Name triggers a useEffect for additional processing
                            setFields(
                                {
                                    'OutputDataConfig.Dataset': {
                                        Type: item.Dataset?.Type,
                                        Name: event.detail.selectedOption.value,
                                    },
                                },
                                ModifyMethod.Set
                            );
                        }}
                    />
                </FormField>
                <FormField label='S3 output locations'>
                    <Box>{formatDisplayText(item.S3OutputPath)}</Box>
                </FormField>
            </SpaceBetween>
        </Container>
    );
}