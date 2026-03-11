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
import { ILabelingJobCreateForm } from './labeling-job-create';
import {
    Container,
    FormField,
    Header,
    Input,
    SpaceBetween,
} from '@cloudscape-design/components';
import Condition from '../../../../modules/condition';
import { LabelingJobTypes } from '../labeling-job.common';
export type LabelingJobWorkersProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobInputLabelAttributeName (props: LabelingJobWorkersProps) {
    const { item, formErrors, setFields, touchFields } = props;

    return (
        <Condition condition={item.taskSelection === LabelingJobTypes.VerificationBoundingBox || item.taskSelection === LabelingJobTypes.VerificationSemanticSegmentation}>
            <Container header={<Header>Display existing labels</Header>}>
                <SpaceBetween direction='vertical' size='m'>
                    <FormField
                        label='Input Manifest Label Attribute Name'
                        description="
                        Choose the input manifest's label attribute name that you want to verify.
                        This should match the label attribute name from the output dataset of the previous labeling job.
                        If you do not specify the label attribute name, one will be attempted to be extracted from the input manifest file.
                        "
                        constraintText={'Maximum of 63 alphanumeric characters. Can include hyphens (-), but not spaces or reserved suffixes "-ref" and "-metadata".'}
                        errorText={formErrors?.job?.InputLabelAttributeName}
                    >
                        <Input
                            value={`${item.job?.InputLabelAttributeName || ''}`}
                            placeholder='Enter the label attribute name from the previous job'
                            onChange={(event) => {
                                setFields({ 'job.InputLabelAttributeName': event.detail.value });
                            }}
                            onBlur={() => touchFields(['job.InputLabelAttributeName'])}
                            data-cy='label-attribute-input'
                        />
                    </FormField>
                </SpaceBetween>
            </Container>
        </Condition>
    );
}

export default LabelingJobInputLabelAttributeName;