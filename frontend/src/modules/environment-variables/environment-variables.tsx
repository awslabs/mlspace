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

import {
    AttributeEditor,
    ExpandableSection,
    FormField,
    Input,
    SpaceBetween,
} from '@cloudscape-design/components';
import React from 'react';
import { z } from 'zod';
import { ModifyMethod } from '../../shared/validation/modify-method';
import { FormProps } from '../../entities/jobs/form-props';
import { duplicateAttributeRefinement } from '../../shared/validation';

export const AttributeEditorSchema = z
    .array(
        z.object({
            key: z.string().min(1, { message: 'Empty key not permitted.' }),
            value: z.string().min(1, { message: 'Empty value not permitted.' }),
        })
    )
    .superRefine(duplicateAttributeRefinement('key'))
    .optional();

export function EnvironmentVariables (props: FormProps<Readonly<any>>) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <ExpandableSection
            headerText={
                <React.Fragment>
                    Environment variables <i>- optional</i>
                </React.Fragment>
            }
            headingTagOverride='h3'
            defaultExpanded={true}
        >
            <SpaceBetween direction='vertical' size='xxl'>
                <FormField label='' description=''>
                    <AttributeEditor
                        onAddButtonClick={() =>
                            setFields({
                                Environment: (item.Environment || []).concat({
                                    key: '',
                                    value: '',
                                }),
                            })
                        }
                        onRemoveButtonClick={({ detail: { itemIndex } }) => {
                            touchFields([`Environment[${itemIndex}]`], ModifyMethod.Unset);
                            const toRemove = {} as any;
                            toRemove[`Environment[${itemIndex}]`] = true;
                            setFields(toRemove, ModifyMethod.Unset);
                        }}
                        items={item.Environment}
                        addButtonText='Add environment variable'
                        definition={[
                            {
                                label: 'Key',
                                control: (attribute: any, itemIndex) => (
                                    <FormField
                                        errorText={formErrors?.Environment?.[itemIndex]?.key}
                                    >
                                        <Input
                                            autoFocus
                                            placeholder='Enter key'
                                            value={attribute.key}
                                            onChange={({ detail }) => {
                                                const toChange = {} as any;
                                                toChange[`Environment[${itemIndex}]`] = {
                                                    key: detail.value,
                                                };
                                                setFields(toChange, ModifyMethod.Merge);
                                            }}
                                            onBlur={() =>
                                                touchFields([`Environment[${itemIndex}].key`])
                                            }
                                        />
                                    </FormField>
                                ),
                            },
                            {
                                label: 'Value',
                                control: (attribute: any, itemIndex) => (
                                    <FormField
                                        errorText={formErrors?.Environment?.[itemIndex]?.value}
                                    >
                                        <Input
                                            placeholder='Enter value'
                                            value={attribute.value}
                                            onChange={({ detail }) => {
                                                const toChange = {} as any;
                                                toChange[`Environment[${itemIndex}]`] = {
                                                    value: detail.value,
                                                };
                                                setFields(toChange, ModifyMethod.Merge);
                                            }}
                                            onBlur={() =>
                                                touchFields([`Environment[${itemIndex}].value`])
                                            }
                                        />
                                    </FormField>
                                ),
                            },
                        ]}
                        removeButtonText='Remove'
                        empty='No items associated with the resource.'
                    />
                </FormField>
            </SpaceBetween>
        </ExpandableSection>
    );
}
