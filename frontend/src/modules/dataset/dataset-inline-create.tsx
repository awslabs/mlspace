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
import { initCap } from '../../shared/util/enum-utils';
import { DatasetType } from '../../shared/model';
import { z } from 'zod';
import { useValidationReducer } from '../../shared/validation';
import { NonCancelableEventHandler } from '@cloudscape-design/components/internal/events';
import { IGroup } from '../../shared/model/group.model';

export type DatasetInlineCreateProps = {
    username: string,
    projectName: string,
    onChange:  NonCancelableEventHandler<{value: string | undefined}>
};

export function DatasetInlineCreate (props: DatasetInlineCreateProps) {
    const {username, projectName, onChange} = props;
    // TODO: disable this until we're ready to enable creating inline group datasets
    // const groups: IGroup[] = useAppSelector((state) => state.group.allGroups);
    const groups: IGroup[] | undefined = undefined;


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
            name: '',
            groupName: ''
        }
    });

    useEffect(() => {
        if (isValid) {
            const datasetContext = state.form;

            let type = String(datasetContext.type);
            // Because there can be multiple groups, a group's "type" will look like 'group0', 'group1', etc 
            if (type.startsWith('group')) {
                type = DatasetType.GROUP;
            }
            let scopeAndType = type;
            switch (type) {
                case DatasetType.PRIVATE:
                    scopeAndType += `/${username}`;
                    break;
                case DatasetType.PROJECT:
                    scopeAndType += `/${projectName}`;
                    break;
            }

            onChange(new CustomEvent('onChange', { cancelable: false, detail: { value: `s3://${window.env.DATASET_BUCKET}/${scopeAndType}/datasets/${datasetContext.name}/` } }));
        } else {
            onChange(new CustomEvent('onChange', { cancelable: false, detail: { value: undefined } }));
        }
    }, [isValid, projectName, state.form, username, onChange]);

    function generateOptions () {
        // Standard options always available
        const options: { label: string; value?: string; options?: any[] }[] = [
            {label: initCap(DatasetType.PROJECT), value: DatasetType.PROJECT},
            {label: initCap(DatasetType.PRIVATE), value: DatasetType.PRIVATE},
        ];

        if (groups) {
            const groupLabels: { label: string; value: string }[] = [];
            groups.map((group, index) => {
                groupLabels.push({ label: group.name, value: `${DatasetType.GROUP}${index}`});
            });

            options.push({ label: 'Groups', options: groupLabels});
        }

        return options;
    }
    
    return (
        <SpaceBetween size='m' direction='vertical'>
            <FormField label='Dataset type' description='Project datasets are accessible only to the project they were created in, group datasets are accessible only to the group they were created in, and private datasets are accessible to the user that created them.'>
                <Select
                    selectedOption={{
                        label: state.form.groupName ? `Group: ${state.form.groupName}` : initCap(state.form.type || ''),
                        value: state.form.type,
                    }}
                    options={generateOptions()}
                    onChange={({detail}) => {
                        setFields({
                            type: detail.selectedOption?.value as keyof typeof DatasetType
                        });
                        setFields({groupName: detail.selectedOption.value?.startsWith('group') ? detail.selectedOption.label : ''});
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