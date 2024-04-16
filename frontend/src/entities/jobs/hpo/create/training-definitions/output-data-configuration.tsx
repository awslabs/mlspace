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
import { FormProps } from '../../../form-props';
import { DatasetExtension, OutputDataConfig } from '../../hpo-job.model';
import {
    Container,
    Header,
    SpaceBetween,
} from '@cloudscape-design/components';
import DatasetResourceSelector from '../../../../../modules/dataset/dataset-selector';

export type OutputDataConfigurationProps = FormProps<OutputDataConfig & DatasetExtension>;

export function OutputDataConfiguration (props: OutputDataConfigurationProps) {
    const { item, setFields, formErrors, touchFields } = props;

    return (
        <Container header={<Header>Output data configuration</Header>}>
            <SpaceBetween direction='vertical' size='m'>
                <DatasetResourceSelector
                    selectableItemsTypes={['prefixes']}
                    showCreateButton={true}
                    fieldLabel={'Select an existing S3 path'}
                    fieldDescription='Your object path will be generated based on the S3 path you select below'
                    onChange={({detail}) => {
                        setFields({
                            'OutputDataConfig.S3OutputPath': detail.resource,
                        });
                    }}
                    inputOnBlur={() => touchFields(['OutputDataConfig.S3OutputPath'])}
                    inputInvalid={!!formErrors?.OutputDataConfig?.S3OutputPath}
                    fieldErrorText={formErrors?.OutputDataConfig?.S3OutputPath}
                    resource={item.S3OutputPath || ''}
                />
            </SpaceBetween>
        </Container>
    );
}
