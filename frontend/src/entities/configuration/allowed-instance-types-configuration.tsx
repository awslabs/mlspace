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
    Container,
    ExpandableSection,
    Header
} from '@cloudscape-design/components';
import React, { useMemo } from 'react';
import { InstanceTypeMultiSelector } from '../../shared/metadata/instance-type-dropdown';

export type AllowedInstanceTypesConfigurationProps = {
    setFields: (SetFieldsFunction) => void;
    expandedSections: {[key: string]: boolean};
    setExpandedSections: (expandedSections:{[key: string]: boolean}) => void;
    enabledNotebookInstanceTypes: string[];
    enabledTrainingInstanceTypes;
    enabledTransformInstanceTypes;
    enabledEndpointInstanceTypes;
};

export function AllowedInstanceTypesConfiguration (props: AllowedInstanceTypesConfigurationProps) {
    // Initialize the notebook instance type selectors with the currently selected options
    const selectedNotebookInstanceOptions = useMemo(() => props.enabledNotebookInstanceTypes.map((instance) => {
        return {
            value: instance,
            label: instance,
        };
    }), [props.enabledNotebookInstanceTypes]);

    // Initialize the training job instance type selectors with the currently selected options
    const selectedTrainingJobInstanceOptions = useMemo(() => props.enabledTrainingInstanceTypes.map((instance) => {
        return {
            value: instance,
            label: instance,
        };
    }), [props.enabledTrainingInstanceTypes]);

    // Initialize the transform job instance type selectors with the currently selected options
    const selectedTransformJobInstanceOptions = useMemo(() => props.enabledTransformInstanceTypes.map((instance) => {
        return {
            value: instance,
            label: instance,
        };
    }), [props.enabledTransformInstanceTypes]);

    // Initialize the endpoint instance type selectors with the currently selected options
    const selectedEndpointInstanceOptions = useMemo(() => props.enabledEndpointInstanceTypes.map((instance) => {
        return {
            value: instance,
            label: instance,
        };
    }), [props.enabledEndpointInstanceTypes]);

    return (
        <Container
            header={
                <Header variant='h2'
                    description='Modify the Amazon EC2 instance types that you wish to make available to users within the following resources: Notebook instance, Training and HPO jobs, Transform jobs, and Endpoints.'
                >
                    Allowed Instance Types
                </Header>
            }
        >
            <ExpandableSection headerText='Notebook instances' variant='default' expanded={props.expandedSections.notebookInstances} onChange={({ detail }) =>
                props.setExpandedSections({...props.expandedSections, notebookInstances: detail.expanded})
            }>
                <InstanceTypeMultiSelector
                    selectedOptions={selectedNotebookInstanceOptions}
                    onChange={({ detail }) => props.setFields({ 'configuration.EnabledInstanceTypes.notebook': detail.selectedOptions.map((option) => option.value)})}
                    instanceTypeCategory='InstanceType'
                />
            </ExpandableSection>
            <ExpandableSection headerText='Training and HPO jobs' variant='default' expanded={props.expandedSections.trainingAndHpo} onChange={({ detail }) =>
                props.setExpandedSections({...props.expandedSections, trainingAndHpo: detail.expanded})
            }>
                <InstanceTypeMultiSelector
                    selectedOptions={selectedTrainingJobInstanceOptions}
                    onChange={({ detail }) => props.setFields({ 'configuration.EnabledInstanceTypes.trainingJob': detail.selectedOptions.map((option) => option.value)})}
                    instanceTypeCategory='TrainingInstanceType'
                />
            </ExpandableSection>
            <ExpandableSection headerText='Transform jobs' variant='default' expanded={props.expandedSections.transform} onChange={({ detail }) =>
                props.setExpandedSections({...props.expandedSections, transform: detail.expanded})
            }>
                <InstanceTypeMultiSelector
                    selectedOptions={selectedTransformJobInstanceOptions}
                    onChange={({ detail }) => props.setFields({ 'configuration.EnabledInstanceTypes.transformJob': detail.selectedOptions.map((option) => option.value)})}
                    instanceTypeCategory='TransformInstanceType'
                />
            </ExpandableSection>
            <ExpandableSection headerText='Endpoints' variant='default' expanded={props.expandedSections.endpoints} onChange={({ detail }) =>
                props.setExpandedSections({...props.expandedSections, endpoints: detail.expanded})
            }>
                <InstanceTypeMultiSelector
                    selectedOptions={selectedEndpointInstanceOptions}
                    onChange={({ detail }) => props.setFields({ 'configuration.EnabledInstanceTypes.endpoint': detail.selectedOptions.map((option) => option.value)})}
                    instanceTypeCategory='ProductionVariantInstanceType'
                />
            </ExpandableSection>
        </Container>
    );
}

export default AllowedInstanceTypesConfiguration;