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
import {Button, Container, FormField, Input, SpaceBetween, Grid, Header} from '@cloudscape-design/components';
import { ClusterType, IAppConfiguration } from '../../shared/model/app.configuration.model';
import { FormProps } from '../jobs/form-props';
import { prefixedSetFields, prefixedTouchFields } from '../../shared/validation';
import Condition from '../../modules/condition';
import { InstanceTypeSelector } from '../../shared/metadata/instance-type-dropdown';


export type ClusterTypesProps = FormProps<IAppConfiguration>;

export function ClusterTypeConfiguration (props: ClusterTypesProps) {
    const { item, setFields, touchFields, formErrors } = props;

    return (
        <SpaceBetween direction='vertical' size='s'>
            <Grid gridDefinition={item.configuration.EMRConfig.clusterTypes.map(() => ({colspan: 6}))}>
                {item.configuration.EMRConfig.clusterTypes.map((clusterType, index) => {
                    return (
                        <Container
                            header={
                                <Header variant='h3'>
                                    {`Cluster Type ${index + 1}: ${clusterType.name}`}
                                </Header>
                            }
                        >
                            <SpaceBetween direction='vertical' size='s'>
                                <ClusterTypeField
                                    item={clusterType}
                                    setFields={prefixedSetFields(
                                        `configuration.EMRConfig.clusterTypes[${index}]`,
                                        setFields
                                    )}
                                    touchFields={prefixedTouchFields(
                                        `configuration.EMRConfig.clusterTypes[${index}]`,
                                        touchFields
                                    )}
                                    formErrors={formErrors?.configuration?.EMRConfig?.clusterTypes?.[index]}
                                />
                                <Condition condition={item.configuration.EMRConfig.clusterTypes.length > 1}>
                                    <Button
                                        variant='normal'
                                        iconName='close'
                                        onClick={() => {
                                            setFields({
                                                'configuration.EMRConfig.clusterTypes': item.configuration.EMRConfig.clusterTypes.filter(
                                                    (element) => element !== clusterType
                                                ),
                                            });
                                        }}
                                    >
                                        Remove
                                    </Button>
                                </Condition>
                            </SpaceBetween>
                        </Container>
                    );
                })}
            </Grid>
            <Condition condition={item.configuration.EMRConfig.clusterTypes.length < 20}>
                <SpaceBetween direction='vertical' size='s'>
                    <hr />
                    <Button
                        variant='normal'
                        iconName='add-plus'
                        onClick={() => {
                            setFields({ 'configuration.EMRConfig.clusterTypes': [...item.configuration.EMRConfig.clusterTypes, createClusterType()] });
                        }}
                    >
                        Add New Cluster Type
                    </Button>
                </SpaceBetween>
            </Condition>
        </SpaceBetween>
    );
}

type ClusterTypeProps = FormProps<ClusterType>;
function ClusterTypeField (props: ClusterTypeProps) {
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
                    onChange={(event) => setFields({ size: Number(event.detail.value) })}
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

const createClusterType = (): ClusterType => {
    return {
        name: '',
        size: 1,
        masterType: '',
        coreType: ''
    };
};