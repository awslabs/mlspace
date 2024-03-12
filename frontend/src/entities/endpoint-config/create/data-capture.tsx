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

import React from 'react';
import {
    Checkbox,
    ExpandableSection,
    FormField,
    Input,
    Select,
    SpaceBetween,
    Textarea,
    Toggle,
} from '@cloudscape-design/components';
import Condition from '../../../modules/condition';
import { EndpointConfigComponentOptions } from '../common-components';
import { IDataCaptureConfig } from '../../../shared/model/endpoint-config.model';

export const DataCapture = ({
    endpointConfig,
    setEndpointConfig,
    variant = 'default',
}: EndpointConfigComponentOptions): JSX.Element => {
    const percentageOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((num) => {
        return { label: `${num}%`, value: `${num}` };
    });

    const toggleCaptureOption = (mode: 'Input' | 'Output', enabled: boolean) => {
        const updatedCaptureConfig: IDataCaptureConfig = JSON.parse(
            JSON.stringify(endpointConfig.DataCaptureConfig)
        );
        if (!enabled) {
            updatedCaptureConfig.CaptureOptions.splice(
                updatedCaptureConfig.CaptureOptions.findIndex((o) => o.CaptureMode === mode),
                1
            );
        } else {
            updatedCaptureConfig.CaptureOptions.push({ CaptureMode: mode });
        }
        setEndpointConfig!({
            ...endpointConfig,
            DataCaptureConfig: updatedCaptureConfig,
        });
    };

    return (
        <ExpandableSection
            variant='container'
            defaultExpanded={true}
            headerText='Data capture - optional'
            headingTagOverride={variant !== 'default' ? 'h3' : 'h2'}
        >
            <Toggle
                onChange={({ detail }) => {
                    const updatedCaptureConfig = JSON.parse(
                        JSON.stringify(endpointConfig.DataCaptureConfig)
                    );
                    updatedCaptureConfig.EnableCapture = detail.checked;
                    setEndpointConfig!({
                        ...endpointConfig,
                        DataCaptureConfig: updatedCaptureConfig,
                    });
                }}
                checked={endpointConfig.DataCaptureConfig.EnableCapture}
                description='By enabling this feature, Amazon SageMaker can save prediction request and prediction response information from your endpoint to a specified location.'
            >
                Enable data capture
            </Toggle>
            <Condition condition={endpointConfig.DataCaptureConfig.EnableCapture}>
                <SpaceBetween size='s'>
                    <FormField
                        description='Amazon SageMaker will save the selected information from your endpoint'
                        label={<span>Data capture options</span>}
                    >
                        <Checkbox
                            onChange={({ detail }) => {
                                toggleCaptureOption('Input', detail.checked);
                            }}
                            checked={
                                !!endpointConfig.DataCaptureConfig.CaptureOptions.find(
                                    (o) => o.CaptureMode === 'Input'
                                )
                            }
                        >
                            Prediction request
                        </Checkbox>
                        <Checkbox
                            onChange={({ detail }) => {
                                toggleCaptureOption('Output', detail.checked);
                            }}
                            checked={
                                !!endpointConfig.DataCaptureConfig.CaptureOptions.find(
                                    (o) => o.CaptureMode === 'Output'
                                )
                            }
                        >
                            Prediction response
                        </Checkbox>
                    </FormField>
                    <FormField
                        description='Amazon SageMaker will save the prediction requests and responses along with metadata for your endpoint at this location.'
                        label={<span>S3 location to store data collected</span>}
                    >
                        <Input
                            value={endpointConfig.DataCaptureConfig.DestinationS3Uri}
                            onChange={({ detail }) => {
                                const updatedCaptureConfig = JSON.parse(
                                    JSON.stringify(endpointConfig.DataCaptureConfig)
                                );
                                updatedCaptureConfig.DestinationS3Uri = detail.value;
                                setEndpointConfig!({
                                    ...endpointConfig,
                                    DataCaptureConfig: updatedCaptureConfig,
                                });
                            }}
                        />
                    </FormField>
                    <FormField
                        description='Amazon SageMaker will randomly sample and save the specified percentage of traffic to your endpoint.'
                        label={<span>Sampling percentage (%)</span>}
                    >
                        <Select
                            selectedOption={{
                                label: `${endpointConfig.DataCaptureConfig.InitialSamplingPercentage}%`,
                                value: `${endpointConfig.DataCaptureConfig.InitialSamplingPercentage}`,
                            }}
                            onChange={({ detail }) => {
                                const updatedCaptureConfig = JSON.parse(
                                    JSON.stringify(endpointConfig.DataCaptureConfig)
                                );
                                updatedCaptureConfig.InitialSamplingPercentage =
                                    +detail.selectedOption.value!;
                                setEndpointConfig!({
                                    ...endpointConfig,
                                    DataCaptureConfig: updatedCaptureConfig,
                                });
                            }}
                            options={percentageOptions}
                            selectedAriaLabel='Selected'
                        />
                    </FormField>
                    <FormField
                        description='Amazon SageMaker will use CSV or JSON encoding while the payload is captured to the capture files'
                        label={
                            <span>
                                Capture content type <i>- optional</i>{' '}
                            </span>
                        }
                    ></FormField>
                    <FormField
                        constraintText='Provide your list, separated by commas. You can add up to 10 items.'
                        label='CSV/Text'
                    >
                        <Textarea
                            onChange={({ detail }) => {
                                const updatedCaptureConfig = JSON.parse(
                                    JSON.stringify(endpointConfig.DataCaptureConfig)
                                );
                                updatedCaptureConfig.CaptureContentTypeHeader.CsvContentTypes =
                                    detail.value.split(',');
                                setEndpointConfig!({
                                    ...endpointConfig,
                                    DataCaptureConfig: updatedCaptureConfig,
                                });
                            }}
                            value={endpointConfig.DataCaptureConfig.CaptureContentTypeHeader.CsvContentTypes.join(
                                ','
                            )}
                            placeholder='text/csv'
                        />
                    </FormField>
                    <FormField
                        constraintText='Provide your list, separated by commas. You can add up to 10 items.'
                        label='JSON'
                    >
                        <Textarea
                            onChange={({ detail }) => {
                                const updatedCaptureConfig = JSON.parse(
                                    JSON.stringify(endpointConfig.DataCaptureConfig)
                                );
                                updatedCaptureConfig.CaptureContentTypeHeader.JsonContentTypes =
                                    detail.value.split(',');
                                setEndpointConfig!({
                                    ...endpointConfig,
                                    DataCaptureConfig: updatedCaptureConfig,
                                });
                            }}
                            value={endpointConfig.DataCaptureConfig.CaptureContentTypeHeader.JsonContentTypes.join(
                                ','
                            )}
                            placeholder='application/json'
                        />
                        Provide your list, separated by commas. You can add up to 10 items.
                    </FormField>
                </SpaceBetween>
            </Condition>
        </ExpandableSection>
    );
};
