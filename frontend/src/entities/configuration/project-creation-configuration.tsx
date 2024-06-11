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
    Header,
    Toggle,
    Grid,
    Box,
    SpaceBetween
} from '@cloudscape-design/components';
import React from 'react';

export type ProjectCreationConfigurationProps = {
    setFields: (SetFieldsFunction) => void;
    isAdminOnly: boolean;
};

export function ProjectCreationConfiguration (props: ProjectCreationConfigurationProps) {
    return (
        <Container
            header={
                <Header variant='h2'
                    description='All users can create new projects in MLSpace. Restrict project creation to users with Admin permissions by activating “Admin Only.”'
                >
                    Project Creation
                </Header>
            }>
            <Grid gridDefinition={[{ colspan: 2 }]}>
                <Box textAlign='center'>
                    <SpaceBetween alignItems='center' size='xs'>
                        <Toggle
                            onChange={({detail}) => {
                                props.setFields({'configuration.ProjectCreation.isAdminOnly': detail.checked});
                            }}
                            checked={props.isAdminOnly}
                        >
                        </Toggle>
                    </SpaceBetween>
                    <p>Admin Only</p>
                </Box>
            </Grid>
        </Container>
    );
}

export default ProjectCreationConfiguration;