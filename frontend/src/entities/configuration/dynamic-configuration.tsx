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
    ExpandableSection,
    Header,
    SpaceBetween,
    Container,
    Button,
    Input,
} from '@cloudscape-design/components';
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { appConfig, appConfigList, getConfiguration, listConfigurations, updateConfiguration } from './configuration-reducer';
import { IAppConfiguration } from '../../shared/model/app.configuration.model';
import { useValidationReducer } from '../../shared/validation';
import { z } from 'zod';

export function DynamicConfiguration () {
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const configList: IAppConfiguration[] = useAppSelector(appConfigList);

    const formSchema = z.object({//configuration.EMRConfig.clusterSizes[0].name
        configuration: z.object({
            EMRConfig: z.object({
                clusterSizes: z.object({
                    name: z.string({ required_error: 'A cluster name must be provided.' })
                })
            })
        }),
    });

    const { state, setState, setFields, touchFields } = useValidationReducer(formSchema, {
        validateAll: false as boolean,
        needsValidation: false,
        touched: {},
        form: {
            ...applicationConfig,
        },
        formValid: false,
        formSubmitting: false as boolean,
    });

    const dispatch = useAppDispatch();
    useEffect(() => {
        dispatch(listConfigurations({configScope: 'global', numVersions: 5}));
    }, [dispatch]);

    const handleSubmit = async () => {
        setState({ formSubmitting: true });
        dispatch(updateConfiguration({
            appConfiguration: state.form
        })).then(() => {
            dispatch(getConfiguration({configScope: 'global'}));
            setState({ formSubmitting: false });
        });
        
    };

    return (
        <Container>
            <Header
                variant='h2'
                description={`The current dynamic configuration of ${window.env.APPLICATION_NAME}. These settings can be modified without redeploying the application`}
            >
                {window.env.APPLICATION_NAME} Dynamic Configuration
            </Header>
            <SpaceBetween direction='vertical' size='xl'>
                <ExpandableSection headerText='Allowed Instance Types' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                </ExpandableSection>
                <ExpandableSection headerText='Enabled Services' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                </ExpandableSection>
                <ExpandableSection headerText='EMR Config' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                    <Input
                        data-cy='test-input'
                        value={state.form.configuration.EMRConfig.clusterSizes[0].name}
                        onChange={(event) => {
                            setFields({ 'configuration.EMRConfig.clusterSizes[0].name': event.detail.value });
                        }}
                        onBlur={() => touchFields(['configuration.EMRConfig.clusterSizes[0].name'])}
                    />
                </ExpandableSection>
                <ExpandableSection headerText='Project Creation' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                </ExpandableSection>
                <ExpandableSection headerText='System Banner' variant='default' defaultExpanded>
                    {<pre>TODO</pre>}
                </ExpandableSection>
                <Button
                    iconAlt='Update dynamic configuration'
                    variant='primary'
                    onClick={handleSubmit}
                    loading={state.formSubmitting}
                    data-cy='dynamic-configuration-submit'
                >
                    Save Changes
                </Button>
                <ExpandableSection headerText='Configuration History' variant='default' defaultExpanded>
                    {<pre>View the configuration history and rollback to prior versions.</pre>}
                    {configList.length}
                </ExpandableSection>
            </SpaceBetween>
            
        </Container>
    );
}

export default DynamicConfiguration;
