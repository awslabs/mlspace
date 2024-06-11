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
    FormField,
    Grid,
    Header,
    Input,
    Multiselect,
    SpaceBetween
} from '@cloudscape-design/components';
import React, {useEffect, useState} from 'react';
import {ClusterTypeConfiguration} from './cluster-types';
import {formatDisplayNumber} from '../../shared/util/form-utils';
import {Application, IAppConfiguration} from '../../shared/model/app.configuration.model';
import {useAppSelector} from '../../config/store';
import {emrApplications} from '../emr/emr.reducer';
import {appConfig} from './configuration-reducer';

export type EmrConfigurationProps = {
    setFields: (SetFieldsFunction) => void;
    touchFields: (TouchFieldsFunction) => void;
    expandedSections: {[key: string]: boolean};
    setExpandedSections: (expandedSections:{[key: string]: boolean}) => void;
    errors: any;
    form: any;
    maxInstances: number;
    minInstances: number;
    scaleOutIncrement: number;
    scaleOutCooldown: number;
    scaleOutPercentageMemAvailable: number;
    scaleOutEvalPeriods: number;
    scaleInIncrement: number;
    scaleInCooldown: number;
    scaleInPercentageMemAvailable: number;
    scaleInEvalPeriods: number;
};

export function EmrConfiguration (props: EmrConfigurationProps) {
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const emrApplicationList: string[] = useAppSelector(emrApplications);
    const [selectedApplicationOptions, setSelectedApplicationOptions] = useState([] as any[]);
    const [applicationOptions, setApplicationOptions] = useState([] as any);

    useEffect(() => {
        const appList: any[] = [];
        emrApplicationList.forEach((application) => appList.push({value: application, label: application}));
        setApplicationOptions(appList);

        // Make sure we're always starting from an empty array to prevent duplicates
        setSelectedApplicationOptions([]);
        const selectedApps: any  = [];
        for (const configApp of applicationConfig.configuration.EMRConfig.applications) {
            if (emrApplicationList.includes(configApp.Name) && !selectedApplicationOptions.includes(configApp.Name)) {
                selectedApps.push({
                    value: configApp.Name,
                    label: configApp.Name
                });
            }
        }
        setSelectedApplicationOptions((priorSelectedOptions) => [...priorSelectedOptions, ...selectedApps]);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [emrApplicationList, applicationConfig]);

    const addApplication = (detail: any) => {
        setSelectedApplicationOptions(detail.selectedOptions);
        const updatedSelectedApps: Application[] = [];
        detail.selectedOptions.forEach((option) => updatedSelectedApps.push({Name: option.value}));
        props.setFields({ 'configuration.EMRConfig.applications': updatedSelectedApps });
    };

    return (
        <Container
            header={
                <Header variant='h2'>
                    EMR Config
                </Header>
            }>
            <ExpandableSection
                headerText='Applications'
                variant='default'
                headingTagOverride='h3'
                headerDescription='Manage the applications available to EMR clusters that users create through the MLSpace user interface.'
                expanded={props.expandedSections?.applications}
                onChange={({ detail }) => props.setExpandedSections({...props.expandedSections, applications: detail.expanded})}
            >
                <Multiselect
                    selectedOptions={selectedApplicationOptions}
                    onChange={({ detail }) =>
                        addApplication(detail)
                    }
                    options={applicationOptions}
                    placeholder='Select applications'
                />
            </ExpandableSection>
            <ExpandableSection
                headerText='Cluster Types'
                variant='default'
                headingTagOverride='h3'
                headerDescription='Define or modify the cluster types that user can choose from when they create EMR clusters through the MLSpace user interface.'
                expanded={props.expandedSections.clusterTypes}
                onChange={({ detail }) => props.setExpandedSections({...props.expandedSections, clusterTypes: detail.expanded})}
            >
                <ClusterTypeConfiguration
                    item={
                        props.form
                    }
                    setFields={props.setFields}
                    touchFields={props.touchFields}
                    formErrors={props.errors}
                />
            </ExpandableSection>
            <ExpandableSection
                headerText='Auto Scaling Policy'
                variant='default'
                headingTagOverride='h3'
                headerDescription='An automatic scaling policy for a core instance group or task instance group in an Amazon EMR cluster. The automatic scaling policy defines how an instance group dynamically adds and terminates Amazon EC2 instances.'
                expanded={props.expandedSections.autoScaling}
                onChange={({ detail }) => props.setExpandedSections({...props.expandedSections, autoScaling: detail.expanded})}
            >
                <SpaceBetween direction='vertical' size='m'>
                    <Grid
                        gridDefinition={[{colspan: 6}, {colspan: 6}, {colspan: 6}, {colspan: 6}]}
                    >
                        <FormField
                            label='Max Instances'
                            constraintText='Must be an integer value.'
                            errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.maxInstances}
                            description='The maximum number of instances supporting the Amazon EMR Cluster at any time.'
                        >
                            <Input
                                data-cy='cluster-max-size'
                                value={props.maxInstances?.toString()}
                                onChange={(event) => {
                                    props.setFields({ 'configuration.EMRConfig.autoScaling.maxInstances': Number(event.detail.value) });
                                }}
                                onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.maxInstances'])}
                            />
                        </FormField>
                        <FormField
                            label='Min Instances'
                            constraintText='Must be an integer value.'
                            errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.minInstances}
                            description='The minimum number of instances supporting the Amazon EMR Cluster at any time.'
                        >
                            <Input
                                data-cy='cluster-min-size'
                                value={props.minInstances?.toString()}
                                onChange={(event) => {
                                    props.setFields({ 'configuration.EMRConfig.autoScaling.minInstances': Number(event.detail.value) });
                                }}
                                onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.minInstances'])}
                            />
                        </FormField>
                        <Container
                            header={
                                <Header variant='h2'  description='Determines when new Amazon EC2 instances will be provisioned to the cluster.'>
                                    Scale-Out Policy
                                </Header>
                            }
                        >
                            <p style={{marginTop:'-5px'}}><strong>All</strong> of the below values must be integers.</p>
                            <SpaceBetween direction='vertical' size='s'>
                                <FormField
                                    label='Increment'
                                    errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.scaleOut?.increment}
                                    description='The number of Amazon EC2 instances that will be added when the Percentage-Memory-Available value is exceeded.'
                                >
                                    <Input
                                        data-cy='cluster-scale-out-increment'
                                        value={props.scaleOutIncrement?.toString()}
                                        onChange={(event) => {
                                            props.setFields({ 'configuration.EMRConfig.autoScaling.scaleOut.increment': Number(event.detail.value) });
                                        }}
                                        onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.scaleOut.increment'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Cooldown'
                                    errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.scaleOut?.cooldown}
                                    description='The amount of time, in seconds, after a scaling activity completes before any further trigger-related scaling activities can start.'
                                >
                                    <Input
                                        data-cy='cluster-scale-out-cooldown'
                                        value={props.scaleOutCooldown?.toString()}
                                        onChange={(event) => {
                                            props.setFields({ 'configuration.EMRConfig.autoScaling.scaleOut.cooldown': Number(event.detail.value) });
                                        }}
                                        onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.scaleOut.cooldown'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Percentage Memory Available'
                                    errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.scaleOut?.percentageMemAvailable}
                                    description='The threshold that determines when the Scale-Out policy is triggered. Triggered when the percentage of available memory drops below this value.'
                                >
                                    <Input
                                        data-cy='cluster-scale-out-percentageMemAvailable'
                                        value={props.scaleOutPercentageMemAvailable?.toString()}
                                        onChange={(event) => {
                                            props.setFields({ 'configuration.EMRConfig.autoScaling.scaleOut.percentageMemAvailable': Number(event.detail.value) });
                                        }}
                                        onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.scaleOut.percentageMemAvailable'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Evaluation Periods'
                                    errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.scaleOut?.evalPeriods}
                                    description='The number of periods, in five-minute increments, during which the "Percentage Memory Available" condition must exist before the Scale-Out policy is triggered.'
                                >
                                    <Input
                                        data-cy='cluster-scale-out-evalPeriods'
                                        value={props.scaleOutEvalPeriods?.toString()}
                                        onChange={(event) => {
                                            props.setFields({ 'configuration.EMRConfig.autoScaling.scaleOut.evalPeriods': Number(event.detail.value) });
                                        }}
                                        onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.scaleOut.evalPeriods'])}
                                    />
                                </FormField>
                            </SpaceBetween>
                        </Container>
                        <Container
                            header={
                                <Header variant='h2'
                                    description='Determines when existing Amazon EC2 instances will released from the cluster.'>
                                    Scale-In Policy
                                </Header>
                            }
                        >
                            <p style={{marginTop: '-5px'}}><strong>All</strong> of the below values must be integers.</p>
                            <SpaceBetween direction='vertical' size='s'>
                                <FormField
                                    label='Increment'
                                    errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.scaleIn?.increment}
                                    description='The number of Amazon EC2 instances that will be released when the Percentage-Memory-Available value is exceeded.'
                                >
                                    <Input
                                        data-cy='cluster-scale-in-increment'
                                        value={props.scaleInIncrement?.toString()}
                                        onChange={(event) => {
                                            props.setFields({'configuration.EMRConfig.autoScaling.scaleIn.increment': formatDisplayNumber(Number(event.detail.value))});
                                        }}
                                        onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.scaleIn.increment'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Cooldown'
                                    errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.scaleIn?.cooldown}
                                    description='The amount of time, in seconds, after a scaling activity completes before any further trigger-related scaling activities can start.'
                                >
                                    <Input
                                        data-cy='cluster-scale-in-cooldown'
                                        value={props.scaleInCooldown?.toString()}
                                        onChange={(event) => {
                                            props.setFields({'configuration.EMRConfig.autoScaling.scaleIn.cooldown': Number(event.detail.value)});
                                        }}
                                        onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.scaleIn.cooldown'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Percentage Memory Available'
                                    errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.scaleIn?.percentageMemAvailable}
                                    description='The threshold that determines when the Scale-In policy is triggered. Triggered when the percentage of available memory exceeds this value.'
                                >
                                    <Input
                                        data-cy='cluster-scale-in-percentageMemAvailable'
                                        value={props.scaleInPercentageMemAvailable?.toString()}
                                        onChange={(event) => {
                                            props.setFields({'configuration.EMRConfig.autoScaling.scaleIn.percentageMemAvailable': Number(event.detail.value)});
                                        }}
                                        onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.scaleIn.percentageMemAvailable'])}
                                    />
                                </FormField>
                                <FormField
                                    label='Evaluation Periods'
                                    errorText={props.errors?.configuration?.EMRConfig?.autoScaling?.scaleIn?.evalPeriods}
                                    description='The number of periods, in five-minute increments, during which the "Percentage Memory Available" condition must exist before the Scale-In policy is triggered.'
                                >
                                    <Input
                                        data-cy='cluster-scale-in-evalPeriods'
                                        value={props.scaleInEvalPeriods?.toString()}
                                        onChange={(event) => {
                                            props.setFields({'configuration.EMRConfig.autoScaling.scaleIn.evalPeriods': Number(event.detail.value)});
                                        }}
                                        onBlur={() => props.touchFields(['configuration.EMRConfig.autoScaling.scaleIn.evalPeriods'])}
                                    />
                                </FormField>
                            </SpaceBetween>
                        </Container>
                    </Grid>
                </SpaceBetween>
            </ExpandableSection>
        </Container>
    );
}

export default EmrConfiguration;