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
import { FormField, Input, Select, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect } from 'react';
import { enumToOptions } from '../../shared/util/enum-utils';
import { DatasetType } from '../../shared/model';
import { z } from 'zod';
import { useValidationReducer } from '../../shared/validation';
import { NonCancelableEventHandler } from '@cloudscape-design/components/internal/events';

export type DatasetInlineCreateProps = {
    username: string,
    projectName: string,
    onChange:  NonCancelableEventHandler<{value: string | undefined}>
};

export function DatasetInlineCreate (props: DatasetInlineCreateProps) {
    const {username, projectName, onChange} = props;

    const createOptions = enumToOptions(DatasetType, true).filter((option) => option.value !== DatasetType.GLOBAL);

    const formSchema = z.object({
        name: z
            .string()
            .min(1)
            .max(255)
            .regex(/^[a-zA-Z0-9-]*$/, {
                message:
                    'Dataset name must not be empty, can contain only alphanumeric characters, and be between 1 and 255 characters',
            })
    });

    const { state, setFields, touchFields, errors, isValid } = useValidationReducer(formSchema, {
        formSubmitting: false,
        touched: {},
        validateAll: false,
        form: {
            type: DatasetType.PRIVATE,
            name: ''
        }
    });

    useEffect(() => {
        if (isValid) {
            const datasetContext = state.form;
            
            let scope = String(datasetContext.type);
            switch (datasetContext.type) {
                case DatasetType.PRIVATE:
                    scope += `/${username}`;
                    break;
                case DatasetType.PROJECT:
                    scope += `/${projectName}`;
                    break;
                //TODO: need a GROUP case - requires a group name
            }

            onChange(new CustomEvent('onChange', { cancelable: false, detail: { value: `s3://${window.env.DATASET_BUCKET}/${datasetContext.type}/${scope}/datasets/${datasetContext.name}/` } }));
        } else {
            onChange(new CustomEvent('onChange', { cancelable: false, detail: { value: undefined } }));
        }
    }, [isValid, projectName, state.form, username, onChange]);
    
    return (
        <SpaceBetween size='m' direction='vertical'>
            <FormField label='Dataset type' description='Project datasets are accessible only to the project they were created in and private datasets are accessible to the user that created them.'>
                <Select
                    selectedOption={createOptions.find((o) => o.value === state.form.type)!}
                    options={createOptions}
                    onChange={({detail}) => {
                        setFields({
                            type: DatasetType[detail.selectedOption?.value?.toUpperCase() as keyof typeof DatasetType]
                        });
                    }}  />
            </FormField>

            <FormField label='Dataset name' description='Maximum of 255 characters. Must be unique to the type that you choose. The dataset name must be unique to the scope (Private/Project).'
                errorText={errors?.name}>
                <Input value={state.form?.name || ''} type='text' onChange={({detail}) => {
                    setFields({
                        name: detail.value
                    });
                }} onBlur={() => touchFields(['name'])} />
            </FormField>
        </SpaceBetween>
    );
}