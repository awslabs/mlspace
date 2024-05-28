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
import { FormProps } from '../../form-props';
import {
    Container,
    FormField,
    Grid,
    Header,
    Input,
    SpaceBetween,
} from '@cloudscape-design/components';
import { ResourceConfig } from '../hpo-job.model';
import { InstanceTypeSelector } from '../../../../shared/metadata/instance-type-dropdown';
import { ServiceTypes } from '../../../../shared/model/app.configuration.model';

export type ResourceConfigurationProps = FormProps<ResourceConfig>;

export function ResourceConfiguration (props: ResourceConfigurationProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <Container
            header={
                <Header description='The following resources will be applied to each training job.'>
                    Resource configuration
                </Header>
            }
        >
            <SpaceBetween direction='vertical' size='l'>
                <FormField label='Instance type' errorText={formErrors?.InstanceType}>
                    <InstanceTypeSelector
                        selectedOption={item.InstanceType ? { value: item.InstanceType } : null}
                        onChange={(event) => {
                            setFields({ InstanceType: event.detail.selectedOption.value });
                        }}
                        service={ServiceTypes.TRAINING_JOB}
                    />
                </FormField>
                <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }]}>
                    <FormField label='Instance count' errorText={formErrors?.InstanceCount}>
                        <Input
                            value={String(item.InstanceCount)}
                            inputMode='numeric'
                            type='number'
                            onChange={(event) => {
                                setFields({
                                    InstanceCount:
                                        Number(event.detail.value) < 1
                                            ? 1
                                            : Number(event.detail.value),
                                });
                                touchFields(['InstanceCount']);
                            }}
                        />
                    </FormField>
                    <FormField
                        label='Additional volume size per instance(GB)'
                        errorText={formErrors?.VolumeSizeInGB}
                    >
                        <Input
                            value={String(item.VolumeSizeInGB)}
                            inputMode='numeric'
                            type='number'
                            onChange={(event) => {
                                setFields({
                                    VolumeSizeInGB:
                                        Number(event.detail.value) < 0
                                            ? 0
                                            : Number(event.detail.value),
                                });
                                touchFields(['VolumeSizeInGB']);
                            }}
                        />
                    </FormField>
                </Grid>
            </SpaceBetween>
        </Container>
    );
}