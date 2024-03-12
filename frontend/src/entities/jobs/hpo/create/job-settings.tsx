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
import { IHPOJob } from '../hpo-job.model';
import { FormProps } from '../../form-props';

export type JobSettingsProps = FormProps<IHPOJob>;

export function JobSettings (props: JobSettingsProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <Container header={<Header>Job settings</Header>}>
            <FormField
                label='Tuning job name'
                description='Amazon SageMaker adds this name to the name of training jobs launched by this tuning job.'
                errorText={formErrors?.HyperParameterTuningJobName}
                constraintText={
                    'The name must be from 1 to 32 characters and must be unique in your AWS account and AWS Region. Valid characters are a-z, A-Z, 0-9, and hyphen (-).'
                }
            >
                <Input
                    value={item.HyperParameterTuningJobName}
                    onChange={(event) => {
                        setFields({ HyperParameterTuningJobName: event.detail.value });
                    }}
                    onBlur={() => touchFields(['HyperParameterTuningJobName'])}
                />
            </FormField>
        </Container>
    );
}
