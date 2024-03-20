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
import { ITrainingJobDefinition } from '../../hpo-job.model';
import { prefixedSetFields, prefixedTouchFields } from '../../../../../shared/validation';
import { ResourceConfiguration } from '../resource-configuration';
import { SpaceBetween } from '@cloudscape-design/components';
// import { ManageSpotTraining } from './manage-spot-training';
import { StoppingCondition } from './stopping-condition';

export type ConfigureResourcesProps = FormProps<ITrainingJobDefinition>;

export function ConfigureResources (props: ConfigureResourcesProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <SpaceBetween direction='vertical' size='l'>
            <ResourceConfiguration
                item={item.ResourceConfig}
                setFields={prefixedSetFields('ResourceConfig', setFields)}
                touchFields={prefixedTouchFields('ResourceConfig', touchFields)}
                formErrors={formErrors?.ResourceConfig}
            />
            {/* <ManageSpotTraining
                item={item}
                setFields={setFields}
                touchFields={touchFields}
                formErrors={formErrors}
            /> */}
            <StoppingCondition
                item={item}
                setFields={setFields}
                touchFields={touchFields}
                formErrors={formErrors}
            />
        </SpaceBetween>
    );
}
