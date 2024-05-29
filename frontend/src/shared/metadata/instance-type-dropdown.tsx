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
import { Multiselect, Select, SelectProps } from '@cloudscape-design/components';
import { NonCancelableEventHandler } from '@cloudscape-design/components/internal/events';
import { listComputeTypes, selectComputeTypes } from './metadata.reducer';
import {
    OptionDefinition,
    OptionGroup,
} from '@cloudscape-design/components/internal/components/option/interfaces';
import { useState } from 'react';
import { IAppConfiguration, ServiceTypes } from '../model/app.configuration.model';
import { appConfig } from '../../entities/configuration/configuration-reducer';



export type InstanceTypeProperties = {
    onChange?: NonCancelableEventHandler<SelectProps.ChangeDetail>;
    onBlur?: NonCancelableEventHandler;
};

type InstanceTypeMultiSelectorProperties = InstanceTypeProperties & {
    selectedOptions: OptionDefinition[]; 
    instanceTypeCategory?:
        | 'InstanceType'
        | 'TransformInstanceType'
        | 'ProcessingInstanceType'
        | 'TrainingInstanceType'
        | 'AppInstanceType'
        | 'ProductionVariantInstanceType';
};

type InstanceTypeSelectorProperties = InstanceTypeProperties & {
    selectedOption: OptionDefinition | null;
    service?: ServiceTypes;
};

function getInstanceTypes (computeTypes: string[]) {
    const categorizedTypes: Record<string, OptionDefinition[]> = {
        Standard: [],
        'Compute Optimized': [],
        'Memory Optimized': [],
        'Accelerated computing': [],
    };

    computeTypes.forEach(
        (instanceType) => {
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
            categorizedTypes[category].push({ value: instanceType, label: instanceType });
        }
    );
    const groups: OptionGroup[] = [];
    Object.keys(categorizedTypes).forEach((category) => {
        if (categorizedTypes[category].length > 0) {
            groups.push({ label: category, options: categorizedTypes[category] });
        }
    });
    return groups;
}

export function InstanceTypeSelector (props: InstanceTypeSelectorProperties) {
    const dispatch = useAppDispatch();
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const computeTypes = useAppSelector(selectComputeTypes);
    
    const instanceOptions = useMemo(() => {
        if (props.service) {
            return getInstanceTypes(applicationConfig.configuration.EnabledInstanceTypes[props.service]);
        } else {
            return getInstanceTypes(computeTypes.values.InstanceTypes['InstanceType']);
        }
    }, [props, applicationConfig.configuration.EnabledInstanceTypes, computeTypes.values.InstanceTypes]);
      
    useEffect(() => {
        if (computeTypes.status === LoadingStatus.INITIAL) {
            dispatch(listComputeTypes());
        }
    }, [dispatch, computeTypes.status]);

    return (
        <Select
            data-cy='instance-type-select'
            selectedOption={props.selectedOption}
            loadingText='Loading instance types...'
            placeholder='Select an instance type...'
            statusType={props.service || computeTypes.status === LoadingStatus.FULFILLED ? 'finished' : 'loading'}
            options={instanceOptions}
            onChange={props.onChange}
            filteringType='auto'
            onBlur={props.onBlur}
        />
    );
}

export function InstanceTypeMultiSelector (props: InstanceTypeMultiSelectorProperties) {
    const dispatch = useAppDispatch();
    const computeTypes = useAppSelector(selectComputeTypes);
    const [instanceOptions, setInstanceOptions] = useState([] as OptionDefinition[]);

    useEffect(() => {
        if (computeTypes.status === LoadingStatus.INITIAL) {
            dispatch(listComputeTypes());
        }
        if (computeTypes.status === LoadingStatus.FULFILLED) {
            const groups = getInstanceTypes(computeTypes.values.InstanceTypes[props.instanceTypeCategory || 'InstanceType']);
            setInstanceOptions(groups);
        }
    }, [
        dispatch,
        computeTypes.status,
        computeTypes,
        props.instanceTypeCategory,
    ]);

    return (
        <Multiselect
            data-cy={`instance-type-multi-select-${props.instanceTypeCategory}`}
            selectedOptions={props.selectedOptions}
            loadingText='Loading instance types...'
            placeholder='Select instance types...'
            statusType={computeTypes.status === LoadingStatus.FULFILLED ? 'finished' : 'loading'}
            options={instanceOptions}
            onChange={props.onChange}
            filteringType='auto'
            onBlur={props.onBlur}
        />
    );
}
