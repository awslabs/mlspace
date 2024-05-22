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
import { Button, ExpandableSection, FormField, Input, SpaceBetween } from '@cloudscape-design/components';
import { ClusterSize, IAppConfiguration } from '../../shared/model/app.configuration.model';
import { FormProps } from '../jobs/form-props';
import { prefixedSetFields, prefixedTouchFields } from '../../shared/validation';
import Condition from '../../modules/condition';
import { InstanceTypeSelector } from '../../shared/metadata/instance-type-dropdown';


export type ClusterSizesProps = FormProps<(IAppConfiguration)>;

export function ClusterSizeConfiguration (props: ClusterSizesProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <SpaceBetween direction='vertical' size='s'>
            {item.configuration.EMRConfig.clusterSizes.map((clusterSize, index) => {
                return (
                    <ExpandableSection
                        headerText={`Cluster Size ${index + 1}: ${clusterSize.name}`}
                        headingTagOverride='h4'
                    >
                        <SpaceBetween direction='vertical' size='s'>
                            <ClusterSizeField
                                item={clusterSize}
                                setFields={prefixedSetFields(
                                    `configuration.EMRConfig.clusterSizes[${index}]`,
                                    setFields
                                )}
                                touchFields={prefixedTouchFields(
                                    `configuration.EMRConfig.clusterSizes[${index}]`,
                                    touchFields
                                )}
                                formErrors={formErrors?.configuration?.EMRConfig?.clusterSizes?.[index]}
                            />
                            <Condition condition={item.configuration.EMRConfig.clusterSizes.length > 1}>
                                <Button
                                    variant='normal'
                                    iconName='close'
                                    onClick={() => {
                                        setFields({
                                            'configuration.EMRConfig.clusterSizes': item.configuration.EMRConfig.clusterSizes.filter(
                                                (element) => element !== clusterSize
                                            ),
                                        });
                                    }}
                                >
                                    Remove {`'${clusterSize.name}'`}
                                </Button>
                            </Condition>
                        </SpaceBetween>
                    </ExpandableSection>
                );
            })}
            <Condition condition={item.configuration.EMRConfig.clusterSizes.length < 20}>
                <SpaceBetween direction='vertical' size='s'>
                    <hr />
                    <Button
                        variant='normal'
                        iconName='add-plus'
                        onClick={() => {
                            setFields({ 'configuration.EMRConfig.clusterSizes': [...item.configuration.EMRConfig.clusterSizes, createClusterSize()] });
                        }}
                    >
                        Add New Cluster Size
                    </Button>
                </SpaceBetween>
            </Condition>
        </SpaceBetween>
    );
}

type ClusterSizeProps = FormProps<ClusterSize>;
function ClusterSizeField (props: ClusterSizeProps) {
    // This setFields is prefixed to reference the app config
    const { item, setFields, touchFields, formErrors } = props;


    return (
        <SpaceBetween direction='vertical' size='m'>
            <FormField 
                label='Name' 
                errorText={formErrors?.name} 
                description='The name used to describe this cluster. Ex: "Small", "Medium GPU", "Large Compute Optimized".'
            >
                <Input
                    value={item.name}
                    onChange={(event) => setFields({ name: event.detail.value })}
                    onBlur={() => touchFields(['name'])}
                />
            </FormField>
            <FormField 
                label='Size' 
                errorText={formErrors?.size} 
                description='The initial number of Amazon EC2 instances in the cluster.'
            >
                <Input
                    value={item.size.toString()}
                    onChange={(event) => setFields({ size: +event.detail.value })}
                    onBlur={() => touchFields(['size'])}
                />
            </FormField>
            <FormField 
                label='Master instance type' 
                description='The Amazon EC2 instance type of the master node.'
            >
                <InstanceTypeSelector
                    selectedOption={
                        {
                            label: item.masterType,
                            value: item.masterType,
                        }
                    }
                    onChange={({ detail }) => {
                        setFields({ masterType: detail.selectedOption.value });
                    }}
                    instanceTypeCategory='InstanceType'
                />
            </FormField>
            <FormField 
                label='Core instance type' 
                description='The Amazon EC2 instance type of the core and task nodes.'
            >
                <InstanceTypeSelector
                    selectedOption={
                        {
                            label: item.coreType,
                            value: item.coreType,
                        }
                    }
                    onChange={({ detail }) => {
                        setFields({ coreType: detail.selectedOption.value });
                    }}
                    instanceTypeCategory='InstanceType'
                />
            </FormField>
        </SpaceBetween>
    );
}

const createClusterSize = (): ClusterSize => {
    return {
        name: '',
        size: 1,
        masterType: '',
        coreType: ''
    };
};