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

import React, { useMemo } from 'react';
import { useEffect } from 'react';
import { LoadingStatus } from '../loading-status';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { Select, SelectProps } from '@cloudscape-design/components';
import { NonCancelableEventHandler } from '@cloudscape-design/components/internal/events';
import { listComputeTypes, selectComputeTypes } from './metadata.reducer';
import {
    OptionDefinition
} from '@cloudscape-design/components/internal/components/option/interfaces';
import { appConfig } from '../../entities/configuration/configuration-reducer';

export type InstanceTypeSelectorProperties = {
    selectedOption: OptionDefinition | null;
    onChange?: NonCancelableEventHandler<SelectProps.ChangeDetail>;
    onBlur?: NonCancelableEventHandler;
    enabledInstances?: 'endpoint' | 'notebook' | 'trainingJob' | 'transformJob'
    instanceTypeCategory?: 'InstanceType' | 'TransformInstanceType' | 'ProcessingInstanceType' | 'TrainingInstanceType' | 'AppInstanceType' | 'ProductionVariantInstanceType';
};

export function InstanceTypeSelector (props: InstanceTypeSelectorProperties) {
    const dispatch = useAppDispatch();
    const computeTypes = useAppSelector(selectComputeTypes);
    const applicationConfig = useAppSelector(appConfig);
    const instanceTypes: string[] = useMemo(() => {
        if (props.enabledInstances) {
            return applicationConfig?.configuration?.EnabledInstanceTypes?.[props.enabledInstances] || [];
        }

        return computeTypes.values?.InstanceTypes?.[props.instanceTypeCategory || 'InstanceType'] || [];
    }, [applicationConfig?.configuration?.EnabledInstanceTypes, computeTypes.values?.InstanceTypes, props.enabledInstances, props.instanceTypeCategory]);

    let selectedOption = props.selectedOption;

    if (!selectedOption?.value || !instanceTypes.includes(selectedOption.value)) {
        selectedOption = null;
    }

    const instanceGroups = useMemo(() => {
        return (instanceTypes).reduce((accumulator, instanceType) => {
            // Instance types returned from this call are in the format of "ml.<family>.size".
            // We can categorize these instances based on the first letter of the
            // <family> value.
            let category = 'Accelerated computing';
            switch (instanceType.split('.')[1][0]) {
                case 't':
                case 'm':
                    category = 'Standard';
                    break;
                case 'c':
                    category = 'Compute Optimized';
                    break;
                case 'r':
                    category = 'Memory Optimized';
                    break;
            }

            accumulator[category].options.push({ value: instanceType });

            return accumulator;
        }, {
            'Standard': { label: 'Standard', options: [] },
            'Compute Optimized': { label: 'Compute Optimized', options: [] },
            'Memory Optimized': { label: 'Memory Optimized', options: [] },
            'Accelerated computing': { label: 'Accelerated computing', options: [] },
        } as {[key: string]: {label: string, options: OptionDefinition[]}});
    }, [instanceTypes]);

    const selectOptions = Object.entries(instanceGroups)
        // remove empty groups
        .filter(([, value]) => value.options.length > 0)
        // map to raw OptionGroup
        .map(([, value]) => value);

    useEffect(() => {
        if (!props.enabledInstances && computeTypes.status === LoadingStatus.INITIAL) {
            dispatch(listComputeTypes());
        }
    }, [dispatch, computeTypes.status, props.enabledInstances]);

    return (
        <Select
            data-cy='instance-type-select'
            selectedOption={selectedOption}
            loadingText='Loading instance types...'
            placeholder='Select an instance type...'
            statusType={computeTypes.status === LoadingStatus.FULFILLED ? 'finished' : 'loading'}
            empty='No instances enabled.'
            options={selectOptions}
            onChange={props.onChange}
            filteringType='auto'
            onBlur={props.onBlur}
        />
    );
}
