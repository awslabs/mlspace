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
import { FormProps } from '../../../form-props';
import { ModifyMethod } from '../../../../../shared/validation/modify-method';
import { DatasetExtension, OutputDataConfig } from '../../hpo-job.model';
import {
    Alert,
    Autosuggest,
    Box,
    Container,
    FormField,
    Header,
    RadioGroup,
    SpaceBetween,
} from '@cloudscape-design/components';
import { DatasetType } from '../../../../../shared/model/dataset.model';
import { useAppDispatch } from '../../../../../config/store';
import { listDatasetsLocations } from '../../../../../entities/dataset/dataset.reducer';
import { useParams } from 'react-router-dom';
import { formatDisplayText } from '../../../../../shared/util/form-utils';
import { useAuth } from 'react-oidc-context';
import { datasetFromS3Uri } from '../../../../../shared/util/dataset-utils';
import { determineScope } from '../../../../dataset/dataset.service';
import Condition from '../../../../../modules/condition';

export type OutputDataConfigurationProps = FormProps<OutputDataConfig & DatasetExtension>;

export function OutputDataConfiguration (props: OutputDataConfigurationProps) {
    const { item, setFields, formErrors } = props;
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const auth = useAuth();
    const userName = auth.user!.profile.preferred_username;

    const [state, setState] = useState({
        bucket: '',
        datasets: [] as any[],
        datasetsLoaded: false,
    });
    const [s3OutputUri, setS3OutputUri] = useState('');

    useEffect(() => {
        // Sets output dataset information
        if (!item.Dataset && item.S3OutputPath) {
            item.Dataset = datasetFromS3Uri(
                item.S3OutputPath
            );
        }
    }, [item]);

    useEffect(() => {
        if (item.Dataset?.Type) {
            const scope = determineScope(item.Dataset?.Type, projectName, userName!);

            // Define the full dataset URI, leaving a spot for the dataset name to be appended at the end
            if (item.Dataset?.Type === DatasetType.GLOBAL) {
                setS3OutputUri(`s3://${window.env.DATASET_BUCKET}/${item.Dataset?.Type}/datasets/`);
            } else {
                setS3OutputUri(`s3://${window.env.DATASET_BUCKET}/${item.Dataset?.Type}/${scope}/datasets/`);
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
        }
    }, [dispatch, item.Dataset?.Type, projectName, userName]);

    return (
        <Container header={<Header>Output data configuration</Header>}>
            <SpaceBetween direction='vertical' size='m'>
                <FormField
                    label='Select an existing S3 path'
                    description='Your object path will be generated based on the S3 path you select below'
                />
                <FormField label='Data access type:'>
                    <RadioGroup
                        value={item.Dataset?.Type || DatasetType.PROJECT}
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
                    <SpaceBetween direction='vertical' size='m'>
                        <Autosuggest
                            onChange={({detail}) => {
                                setFields(
                                    {
                                        'OutputDataConfig.Dataset': {
                                            Type: item.Dataset?.Type,
                                            Name: detail.value,
                                        },
                                        'OutputDataConfig.S3OutputPath': s3OutputUri + detail.value
                                    },
                                    ModifyMethod.Set
                                );
                            }}
                            value={
                                item.Dataset?.Name || ''
                            }
                            options={state.datasets.map(
                                (location: { name: string; location: string }) => {
                                    return { value: location.name };
                                }
                            )}
                            ariaLabel='Select an output location'
                            placeholder='Select an output location'
                            empty='No datasets found.'
                            enteredTextLabel={ (value) => `${state.datasets.find((d) => d.name === item.Dataset?.Name) ? 'Use:' : 'Create:'} ${value}`}
                        />
                        <Condition condition={!state.datasets.find((d) => d.name === item.Dataset?.Name) && item.Dataset?.Name !== undefined && item.Dataset?.Name.length > 0}>
                            <Alert
                                statusIconAriaLabel='Info'
                                header='A new dataset will be created when this job starts successfully.'>
                            </Alert>
                        </Condition>
                    </SpaceBetween>

                </FormField>
                <FormField label='S3 output location'>
                    <Box>{formatDisplayText(item.S3OutputPath)}</Box>
                </FormField>
            </SpaceBetween>
        </Container>
    );
}
