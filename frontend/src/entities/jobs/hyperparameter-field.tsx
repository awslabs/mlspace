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
import { Select, FormField, Input, Multiselect } from '@cloudscape-design/components';
import { FormProps } from './form-props';
import { Hyperparameter } from './algorithms';

export type HyperparameterFieldProps = FormProps<Hyperparameter> & {
    value: string;
};
export function HyperparameterField (props: HyperparameterFieldProps) {
    const { item, setFields, touchFields, formErrors, value } = props;
    let field;

    if (item.options !== undefined) {
        if (item.commaSeparatedList === true) {
            field = (
                <Multiselect
                    selectedOptions={value?.split(',').map((value) => ({ value, label: value }))}
                    options={item.options?.map(String).filter((s) => s.trim().length > 0).map((value) => ({ value }))}
                    onChange={(event) => {
                        const toUpdate = {} as any;
                        toUpdate[item.key] = event.detail.selectedOptions.map((option) => option.value).join(',');
                        setFields(toUpdate);
                    }}
                    onBlur={() => touchFields([item.key])}
                />
            );
        } else {
            field = (
                <Select
                    selectedOption={{ value }}
                    options={item.options?.map((v: string | number) => {
                        if (v === '') {
                            return { value: String(v), description: 'No Value' };
                        }
                        return { value: String(v) };
                    })}
                    onChange={(event) => {
                        const toUpdate = {} as any;
                        toUpdate[item.key] = event.detail.selectedOption.value;
                        setFields(toUpdate);
                    }}
                    onBlur={() => touchFields([item.key])}
                />
            );
        }
    } else {
        field = (
            <Input
                value={value}
                key={item.key}
                onChange={(event) => {
                    const toUpdate = {} as any;
                    toUpdate[item.key] = event.detail.value;
                    setFields(toUpdate);
                }}
                onBlur={() => touchFields([item.key])}
            />
        );
    }

    return (
        <FormField
            label={item.key}
            description={item.description}
            errorText={formErrors?.[item.key]}
        >
            {field}
        </FormField>
    );
}
