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
    Select,
    SpaceBetween,
} from '@cloudscape-design/components';
import { prefixedSetFields, prefixedTouchFields } from '../../../../../shared/validation';
import Condition from '../../../../../modules/condition';
import { enumToOptions } from '../../../../../shared/util/enum-utils';
import { createInputDataConfig } from '../../../create.functions';
import { datasetFromS3Uri } from '../../../../../shared/util/dataset-utils';
import DatasetResourceSelector from '../../../../../modules/dataset/dataset-selector';

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
    // This setFields is prefixed to reference the input configuration for this channel
    const { item, setFields, touchFields, formErrors } = props;

    // When the InputDataConfig is loaded, check if there is existing path information
    useEffect(() => {
        // Sets input dataset information when there is no dataset information
        if (!item.Dataset && item.DataSource?.S3DataSource?.S3Uri) {
            setFields({Dataset: datasetFromS3Uri(item.DataSource.S3DataSource.S3Uri)});
        }

        // Running on initial render and don't want to update with dependencies
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                <FormField label={<>Input mode - <em>optional</em></>}>
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
            <DatasetResourceSelector
                fieldLabel={'S3 Location'}
                selectableItemsTypes={['objects']}
                onChange={({detail}) => {
                    setFields({
                        'DataSource.S3DataSource.S3Uri': detail.resource,
                    });
                }}
                inputOnBlur={() => {
                    touchFields(['DataSource.S3DataSource.S3Uri']);
                }}
                inputInvalid={!!formErrors?.DataSource?.S3DataSource?.S3Uri}
                fieldErrorText={formErrors?.DataSource?.S3DataSource?.S3Uri}
                resource={item.DataSource.S3DataSource?.S3Uri || ''}
            />
        </SpaceBetween>
    );
}