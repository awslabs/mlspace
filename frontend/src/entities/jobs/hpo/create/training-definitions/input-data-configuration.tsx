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
import {
    CompressionType,
    DatasetExtension,
    InputDataConfig,
    InputDataConfigurationInputMode,
    RecordWrapperType,
    S3DataDistributionType,
    S3DataType,
} from '../../hpo-job.model';
import {
    Button,
    Container,
    ExpandableSection,
    FormField,
    Grid,
    Header,
    Input,
    RadioGroup,
    Select,
    SpaceBetween,
} from '@cloudscape-design/components';
import { prefixedSetFields, prefixedTouchFields } from '../../../../../shared/validation';
import Condition from '../../../../../modules/condition';
import { enumToOptions } from '../../../../../shared/util/enum-utils';
import { DatasetType } from '../../../../../shared/model/dataset.model';
import { createInputDataConfig } from '../../../create.functions';
import { useAppDispatch } from '../../../../../config/store';
import { useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import {
    listDatasetBucketAndLocations,
    listDatasetFiles,
} from '../../../../dataset/dataset.service';
import NotificationService from '../../../../../shared/layout/notification/notification.service';
import { datasetFromS3Uri } from '../../../../../shared/util/dataset-utils';

export type InputDataConfigurationProps = FormProps<(InputDataConfig & DatasetExtension)[]>;

export function InputDataConfiguration (props: InputDataConfigurationProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <Container header={<Header>Input data configuration</Header>}>
            <Header variant='h3'>Channels</Header>
            <SpaceBetween direction='vertical' size='s'>
                {item.map((inputDataConfig, index) => {
                    const channelName = `Channel ${index + 1}: ${item[index].ChannelName}`;
                    return (
                        <ExpandableSection
                            key={`channel-${index}`}
                            defaultExpanded={true}
                            headerText={channelName}
                            headingTagOverride='h4'
                        >
                            <SpaceBetween direction='vertical' size='s'>
                                <Channel
                                    item={inputDataConfig}
                                    setFields={prefixedSetFields(
                                        `InputDataConfig[${index}]`,
                                        setFields
                                    )}
                                    touchFields={prefixedTouchFields(
                                        `InputDataConfig[${index}]`,
                                        touchFields
                                    )}
                                    formErrors={formErrors?.InputDataConfig?.[index]}
                                />

                                <Condition condition={item.length > 0}>
                                    <Button
                                        variant='normal'
                                        iconName='close'
                                        onClick={() => {
                                            setFields({
                                                InputDataConfig: item.filter(
                                                    (element) => element !== inputDataConfig
                                                ),
                                            });
                                        }}
                                    >
                                        Remove {`"${channelName}"`}
                                    </Button>
                                </Condition>
                            </SpaceBetween>
                        </ExpandableSection>
                    );
                })}

                <Condition condition={item.length < 20}>
                    <SpaceBetween direction='vertical' size='s'>
                        <hr />

                        <Button
                            variant='normal'
                            iconName='add-plus'
                            onClick={() => {
                                setFields({ InputDataConfig: [...item, createInputDataConfig()] });
                            }}
                        >
                            Add Channel
                        </Button>
                    </SpaceBetween>
                </Condition>
            </SpaceBetween>
        </Container>
    );
}

export type ChannelProps = FormProps<InputDataConfig & DatasetExtension>;
export function Channel (props: ChannelProps) {
    const { projectName } = useParams();
    const auth = useAuth();
    const userName = auth.user!.profile.preferred_username;
    // This setFields is prefixed to reference the input configuration for this channel
    const { item, setFields, touchFields, formErrors } = props;
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const [notifiedOfMissingInput, setNotifiedOfMissingInput] = useState(false);

    const [state, setState] = React.useState({
        bucket: '',
        datasets: [] as any[],
        datasetFiles: [],
        datasetsLoaded: false,
        scope: 'global',
    });

    // When the InputDataConfig is loaded, check if there is existing path information
    useEffect(() => {
        // Sets input dataset information when there is no dataset information
        if (!item.Dataset && item.DataSource?.S3DataSource?.S3Uri) {
            setFields({Dataset: datasetFromS3Uri(item.DataSource.S3DataSource.S3Uri)});
        }

        // Running on initial render and don't want to update with dependencies
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let scope = 'global';
        if (item.Dataset?.Type) {
            switch (item.Dataset.Type) {
                case DatasetType.PRIVATE:
                    scope = userName!;
                    break;
                case DatasetType.PROJECT:
                    scope = projectName!;
                    break;
            }
            listDatasetBucketAndLocations(scope, item.Dataset.Type).then((datasetsInfo) => {
                setState((s) => ({
                    ...s,
                    bucket: datasetsInfo.bucket,
                    datasets: datasetsInfo.locations,
                    datasetsLoaded: true,
                    scope: scope,
                }));
            });
        }

        // Uses touchFields, but isn't dependent
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, item.Dataset?.Type, projectName, userName]);

    useEffect(() => {
        if (item.Dataset?.Name && state.datasetsLoaded) {
            const dataset = state.datasets.find(
                (dataset: any) => dataset.name === item.Dataset?.Name
            );

            // If the dataset is found, update the file values
            // This should apply in any case where the value is selected from the drop-down
            if (dataset !== undefined) {
                listDatasetFiles(state.scope, item.Dataset.Name).then((datasetFiles) => {
                    const datasetLocation = dataset.location.replace(/s3:\/\/.+?\//, '');
                    const fileOptions = datasetFiles.Keys.map(
                        ({ key }: { key: string; size: number }) =>
                            key.substr(datasetLocation.length)
                    ).filter((value: string) => value.trim().length > 0);

                    setState((s) => ({
                        ...s,
                        datasetFiles: fileOptions,
                    }));
                });
            } else if (item.Dataset.Name && !notifiedOfMissingInput) {
                // If the dataset is not found, set the name back to undefined to clear the field
                // Should only apply in cloning or when Dataset and the .Name is set to an inaccessible Dataset
                setNotifiedOfMissingInput(true);
                notificationService.generateNotification(
                    `The input location for the "${item.ChannelName}" channel of the job is not available and was unset.`,
                    'warning'
                );
                setFields({ 'Dataset.Name': undefined });
            }
        }

        // Several dependencies that we don't want to hook on: setFields, setNotifiedOfMissingInput, etc
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, item.Dataset?.Name, projectName, userName, state.datasetsLoaded]);

    /**
     * InputDataConfig Field to Property Mappings
     * Channel name = .ChannelName
     * Input mode = .InputMode
     * Content type - optional = .ContentType
     * Compression type - .CompressionType
     * Record wrapper - .RecordWrapperType
     * Data source - N/A (only S3 option currently)
     * Data access type - .Dataset.Type (overrides current dataset when changed)
     * S3 data type - .DataSource.S3DataSource.S3DataType
     * S3 data distribution type - DataSource.S3DataSource.S3DataDistributionType
     * S3 location -
     *  .Dataset.Type
     *  .Dataset.Name
     *  .Dataset.Location
     * Files -
     *   .Dataset.Location
     *   .DataSource.S3DataSource.S3Uri
     */

    return (
        <SpaceBetween direction='vertical' size='m'>
            <Grid
                gridDefinition={[
                    { colspan: { default: 12, xxs: 4 } },
                    { colspan: { default: 12, xxs: 4 } },
                ]}
            >
                <FormField label='Channel name' errorText={formErrors?.ChannelName}>
                    <Input
                        autoFocus
                        value={item.ChannelName}
                        onChange={(event) => setFields({ ChannelName: event.detail.value })}
                        onBlur={() => touchFields(['ChannelName'])}
                    />
                </FormField>
                <FormField label='Input mode'>
                    <Select
                        selectedOption={{ value: item.InputMode }}
                        options={enumToOptions(InputDataConfigurationInputMode)}
                        onChange={(event) => {
                            setFields({ InputMode: event.detail.selectedOption.value });
                            touchFields(['InputMode']);
                        }}
                    />
                </FormField>
            </Grid>
            <FormField
                label='Content type - optional'
                description={
                    <div>
                        <span>Choose one of the formats below</span>
                        <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                            <li>application/x-recordio-protobuf</li>
                            <li>text/csv</li>
                            <li>text/csv;label_size=&#123;Number of label columns&#125;</li>
                        </ul>
                    </div>
                }
            >
                <Input
                    value={item.ContentType}
                    onChange={(event) => setFields({ ContentType: event.detail.value })}
                    onBlur={() => touchFields(['ContentType'])}
                />
            </FormField>
            <Grid
                gridDefinition={[
                    { colspan: { default: 12, xxs: 4 } },
                    { colspan: { default: 12, xxs: 4 } },
                ]}
            >
                <FormField label='Compression type'>
                    <Select
                        selectedOption={{ value: item.CompressionType }}
                        options={enumToOptions(CompressionType)}
                        onChange={(event) => {
                            setFields({ CompressionType: event.detail.selectedOption.value });
                            touchFields(['CompressionType']);
                        }}
                    />
                </FormField>
                <FormField label='Record wrapper'>
                    <Select
                        selectedOption={{ value: item.RecordWrapperType }}
                        options={enumToOptions(RecordWrapperType)}
                        onChange={(event) => {
                            setFields({ RecordWrapperType: event.detail.selectedOption.value });
                            touchFields(['RecordWrapperType']);
                        }}
                    />
                </FormField>
            </Grid>
            <Grid
                gridDefinition={[
                    { colspan: { default: 12, xxs: 4 } },
                    { colspan: { default: 12, xxs: 4 } },
                ]}
            >
                <FormField label='Data source'>
                    <RadioGroup
                        value={'S3'}
                        items={[{ value: 'S3', label: 'S3' }]}
                        onChange={() => {
                            return null;
                        }}
                    />
                </FormField>
                <FormField label='Data access type'>
                    <RadioGroup
                        value={item.Dataset?.Type}
                        items={enumToOptions(DatasetType, true)}
                        onChange={(event) => {
                            setFields(
                                {
                                    Dataset: {
                                        Type: DatasetType[
                                            event.detail.value.toUpperCase() as keyof typeof DatasetType
                                        ],
                                    },
                                },
                                ModifyMethod.Set
                            );
                        }}
                    />
                </FormField>
            </Grid>
            <Grid
                gridDefinition={[
                    { colspan: { default: 12, xxs: 4 } },
                    { colspan: { default: 12, xxs: 4 } },
                ]}
            >
                <FormField label='S3 data type'>
                    <Select
                        selectedOption={{ value: item.DataSource.S3DataSource?.S3DataType }}
                        options={enumToOptions(S3DataType)}
                        onChange={(event) => {
                            setFields({
                                'DataSource.S3DataSource.S3DataType':
                                    event.detail.selectedOption.value,
                            });
                            touchFields(['DataSource.S3DataSource.S3DataType']);
                        }}
                    />
                </FormField>
                <FormField label='S3 data distribution type'>
                    <Select
                        selectedOption={{
                            value: item.DataSource.S3DataSource?.S3DataDistributionType,
                        }}
                        options={enumToOptions(S3DataDistributionType)}
                        onChange={(event) => {
                            setFields({
                                'DataSource.S3DataSource.S3DataDistributionType':
                                    event.detail.selectedOption.value,
                            });
                            touchFields(['DataSource.S3DataSource.S3DataDistributionType']);
                        }}
                    />
                </FormField>
            </Grid>
            <FormField label='S3 location' errorText={formErrors?.Dataset?.Name}>
                <Select
                    placeholder='Select an input location'
                    empty='No datasets found.'
                    selectedOption={item.Dataset?.Name ? { value: item.Dataset?.Name } : null}
                    options={state.datasets.map((location: { name: string; location: string }) => {
                        return { value: location.name };
                    })}
                    onChange={(event) => {
                        const dataset = state.datasets.find(
                            (dataset: { name: string; location: string }) =>
                                dataset.name === event.detail.selectedOption.value
                        );

                        setFields({
                            // Setting the Dataset.Name triggers a useEffect that performs additional processing
                            Dataset: {
                                Type: item.Dataset?.Type,
                                Name: event.detail.selectedOption.value,
                                Location: '',
                            },
                            'DataSource.S3DataSource.S3Uri': dataset.location,
                        });
                        setState((s) => ({
                            ...s,
                            datasetFiles: [],
                        }));
                    }}
                />
            </FormField>
            <Condition condition={item.Dataset?.Name !== undefined}>
                <FormField label='Files' errorText={formErrors?.Dataset?.Location}>
                    <Select
                        selectedOption={
                            item.Dataset?.Location ? { value: item.Dataset?.Location } : null
                        }
                        placeholder={'No file, use folder'}
                        options={[
                            { value: '', label: 'No file, use folder' },
                            ...(state.datasetFiles?.map((l: string) => {
                                return { value: l, label: l };
                            }) || []),
                        ]}
                        onChange={(event) => {
                            const dataset = state.datasets.find(
                                (dataset: { name: string; location: string }) =>
                                    dataset.name === item.Dataset?.Name
                            );

                            setFields({
                                'Dataset.Location': event.detail.selectedOption.value,
                                'DataSource.S3DataSource.S3Uri':
                                    dataset.location + event.detail.selectedOption.value,
                            });
                        }}
                    />
                </FormField>
            </Condition>
        </SpaceBetween>
    );
}