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
    Alert,
    Container,
    Grid,
    Header,
    SpaceBetween,
    Toggle,
    Box
} from '@cloudscape-design/components';
import React from 'react';
import {SetFieldsFunction} from '../../shared/validation';

const configurableServices = {
    batchTranslate: 'Amazon Translate batch',
    realtimeTranslate: 'Amazon Translate real-time',
    emrCluster: 'Amazon EMR',
    labelingJob: 'Amazon Ground Truth'
};

export type ActivatedServicesConfigurationProps = {
    setFields: SetFieldsFunction;
    enabledServices: {[key: string]: boolean};
};

const generateDescription = () => {
    return `
        Activate or deactivate services within MLSpace. Deactivated 
        services will no longer appear within the MLSpace user interface${!window.env.MANAGE_IAM_ROLES ? `. 
        Due to dynamic roles not being in use, deactivating a service will not limit the ability of users to
        leverage that service in notebooks.` : ` or be available for use within notebooks. 
        IAM permissions  that control access to these services within the MLSpace user interface and Jupyter Notebooks 
        will automatically update.  Deactivating services will suspend all active corresponding jobs and instances 
        associated with the service.`}
    `;
};

export function ActivatedServicesConfiguration (props: ActivatedServicesConfigurationProps) {
    return (
        <Container
            header={
                <Header variant='h2'>
                    Activated Services
                </Header>
            }>
            <SpaceBetween direction='vertical' size='m'>
                <Alert
                    type={window.env.MANAGE_IAM_ROLES ? 'info' : 'warning'}
                    statusIconAriaLabel={window.env.MANAGE_IAM_ROLES ? 'Info' : 'Warning'}
                >
                    {generateDescription()}
                </Alert>
                <Grid gridDefinition={Object.keys(configurableServices).map(() => ({colspan: 3}))}>
                    {Object.keys(configurableServices).map((service) => {
                        return (
                            <Box textAlign='center'>
                                <SpaceBetween alignItems='center' size='xs'>
                                    <Toggle
                                        onChange={({detail}) => {
                                            const updatedField = {};
                                            updatedField[`configuration.EnabledServices.${service}`] = detail.checked;
                                            props.setFields(updatedField);
                                        }}
                                        checked={props.enabledServices[service]}
                                    >
                                    </Toggle>
                                </SpaceBetween>
                                <p>{configurableServices[service]}</p>
                            </Box>
                        );
                    })}
                </Grid>
            </SpaceBetween>
        </Container>
    );
}

export default ActivatedServicesConfiguration;