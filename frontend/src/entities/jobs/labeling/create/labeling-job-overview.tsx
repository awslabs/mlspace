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

/* eslint-disable */
import React from 'react';
import {
    Checkbox,
    Container,
    FormField,
    Header,
    Input,
    SpaceBetween,
} from '@cloudscape-design/components';
import { FormProps } from '../../form-props';
import Condition from '../../../../modules/condition';
import { ILabelingJobCreateForm } from './labeling-job-create';
import { ModifyMethod } from '../../../../shared/validation/modify-method';
import DatasetResourceSelector from '../../../../modules/dataset/dataset-selector';

export type LabelingJobOverviewProps = FormProps<ILabelingJobCreateForm>;

export function LabelingJobOverview(props: LabelingJobOverviewProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <Container header={<Header>Job overview</Header>}>
            <SpaceBetween direction="vertical" size="m">
                <FormField
                    label="Job name"
                    constraintText={`The name must be from 1 to 63 characters and must be unique in your AWS account and AWS Region. Valid characters are a-z, A-Z, 0-9, and hyphen (-).`}
                    errorText={formErrors?.job?.LabelingJobName}
                >
                    <Input
                        value={item.job.LabelingJobName}
                        onChange={({ detail }) => {
                            setFields({ 'job.LabelingJobName': detail.value });
                        }}
                        onBlur={() => touchFields(['job.LabelingJobName'])}
                        data-cy="name-input"
                    />
                </FormField>

                <Checkbox
                    checked={item.specifyAttribute}
                    onChange={({ detail }) => {
                        setFields({
                            specifyAttribute: detail.checked,
                            'job.LabelAttributeName': '',
                        });

                        if (!detail.checked) {
                            setFields(
                                {
                                    'job.LabelAttributeName': false,
                                },
                                ModifyMethod.Unset
                            );
                            touchFields(['job.LabelAttributeName'], ModifyMethod.Unset);
                        }
                    }}
                >
                    I want to specify a label attribute name different from the labeling job name.
                </Checkbox>

                <Condition condition={item.specifyAttribute}>
                    <FormField
                        label="Label attribute name"
                        constraintText={`Maximum of 63 alphanumeric characters. Can include hyphens (-), but not spaces or reserved suffixes "-ref" and "-metadata".`}
                        errorText={formErrors?.job?.LabelAttributeName}
                    >
                        <Input
                            value={`${item.job?.LabelAttributeName}`}
                            onChange={(event) => {
                                setFields({ 'job.LabelAttributeName': event.detail.value });
                            }}
                            onBlur={() => touchFields(['job.LabelAttributeName'])}
                        />
                    </FormField>
                </Condition>
                <DatasetResourceSelector
                    selectableItemsTypes={['objects']}
                    fieldLabel='S3 location for input datasets'
                    fieldDescription='Provide a path to the S3 location where your manifest file is stored.'
                    inputPlaceholder='s3://bucket/path/to/manifest'
                    onChange={({detail}) => {
                        setFields({
                            'job.InputConfig.DataSource.S3DataSource.ManifestS3Uri': detail.resource,
                        });
                    }}
                    inputOnBlur={() => {
                        touchFields(['job.InputConfig.DataSource.S3DataSource.ManifestS3Uri']);
                    }}
                    fieldErrorText={formErrors?.job?.InputConfig?.DataSource?.S3DataSource?.ManifestS3Uri}
                    inputData-cy="manifest-file-input"
                    resource={item.job.InputConfig.DataSource.S3DataSource.ManifestS3Uri || ''}
                />
                <DatasetResourceSelector
                    selectableItemsTypes={['prefixes']}
                    fieldLabel='Output dataset location'
                    fieldDescription='Provide a path to the S3 location where you want your labeled dataset to be stored.'
                    showCreateButton={true}
                    onChange={({detail}) => {
                        setFields({
                            'job.OutputConfig.S3OutputPath': detail.resource,
                        });
                    }}
                    inputOnBlur={() => {
                        touchFields(['job.OutputConfig.S3OutputPath']);
                    }}
                    fieldErrorText={formErrors?.job?.OutputConfig?.S3OutputPath}
                    inputData-cy="output-location-input"
                    resource={item.job.OutputConfig.S3OutputPath || ''}
                />
            </SpaceBetween>
        </Container>
    );
}

export default LabelingJobOverview;
