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

import React, { useEffect } from 'react';
import { ITrainingJobDefinition } from '../../hpo-job.model';
import { ExpandableSection, Toggle, FormField, Multiselect } from '@cloudscape-design/components';
import { FormProps } from '../form-props';
import { Subnet } from '../../../../../shared/model/vpc.config';
import { ModifyMethod } from '../../../../../shared/validation/modify-method';
import { useAppDispatch, useAppSelector } from '../../../../../config/store';
import { listSubnets, selectSubnets } from '../../../../../shared/metadata/metadata.reducer';
import { LoadingStatus } from '../../../../../shared/loading-status';

export function NetworkSettings (props: FormProps<ITrainingJobDefinition>) {
    const { item, setFields, touchFields } = props;
    const subnets = useAppSelector(selectSubnets);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (subnets.status === LoadingStatus.INITIAL) {
            dispatch(listSubnets());
        }
    }, [dispatch, subnets.status]);

    return (
        <ExpandableSection headerText='Advanced network settings' headingTagOverride='h3'>
            <Toggle
                onChange={({ detail }) => {
                    setFields({
                        EnableNetworkIsolation: detail.checked,
                    });
                    touchFields(['EnableNetworkIsolation']);
                }}
                checked={!!item.EnableNetworkIsolation}
                description="Containers that run with network isolation can't make any outbound network calls."
            >
                Enable network isolation
            </Toggle>
            <FormField
                label='Subnet(s)'
                description='Choose a subnet in an availability zone supported by Amazon SageMaker.'
            >
                <Multiselect
                    selectedOptions={(item.VpcConfig?.Subnets || []).map((subnet) => {
                        return { label: subnet, value: subnet };
                    })}
                    onChange={({ detail }) => {
                        if (detail.selectedOptions.length > 0) {
                            setFields({
                                // Subnet ids are expected to be a comma separated string
                                'VpcConfig.Subnets': detail.selectedOptions.map(
                                    (option) => option.value
                                ),
                            });
                        } else {
                            setFields(
                                {
                                    'VpcConfig.Subnets': true,
                                },
                                ModifyMethod.Unset
                            );
                        }
                    }}
                    options={(subnets?.values || []).map((subnet: Subnet) => {
                        return {
                            label: subnet.subnetId,
                            value: subnet.subnetId,
                            description: subnet.availabilityZone,
                        };
                    })}
                    placeholder='Choose options'
                    data-cy='network-settings-multiselect'
                />
            </FormField>
        </ExpandableSection>
    );
}
