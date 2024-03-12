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
import { Container, FormField, Header, Input } from '@cloudscape-design/components';
import { ITrainingJobDefinition } from '../../hpo-job.model';
import { FormProps } from '../../../form-props';
import { NetworkSettings } from './network-settings';

export type TrainingJobDefinitionNameProps = FormProps<ITrainingJobDefinition>;

export function TrainingJobDefinitionName (props: TrainingJobDefinitionNameProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <Container header={<Header>Training job definition</Header>}>
            <FormField
                label='Training job definition name'
                constraintText={
                    'The name must be from 1 to 63 characters and must be unique in your AWS account and AWS Region. Valid characters are a-z, A-Z, 0-9, and hyphen (-).'
                }
                errorText={formErrors?.DefinitionName}
            >
                <Input
                    value={item.DefinitionName!}
                    onChange={(event) => {
                        setFields({ DefinitionName: event.detail.value });
                    }}
                    onBlur={() => touchFields(['DefinitionName'])}
                />
            </FormField>
            <NetworkSettings
                item={item}
                setFields={setFields}
                touchFields={touchFields}
                formErrors={formErrors}
            />
        </Container>
    );
}
