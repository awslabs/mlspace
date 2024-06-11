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
    FormField,
    Grid,
    Header,
    Input,
    SpaceBetween,
    Toggle
} from '@cloudscape-design/components';
import React from 'react';

export type SystemBannerConfigurationProps = {
    setFields: (SetFieldsFunction) => void;
    textColor: string;
    backgroundColor: string;
    text: string;
    isEnabled: boolean;
    touchFields: (TouchFieldsFunction) => void;
};

export function SystemBannerConfiguration (props: SystemBannerConfigurationProps) {
    return (
        <Container
            header={
                <Header variant='h2'>
                    System Banner
                </Header>
            }>
            <SpaceBetween direction='vertical' size='l'>
                <Grid gridDefinition={[{colspan: 4}, {colspan: 4}, {colspan: 4}]}>
                    <div style={{display: 'grid', textAlign: 'center'}}>
                        <div style={{display: 'grid', justifyContent: 'center'}}>
                            <Toggle
                                onChange={({detail}) => {
                                    props.setFields({'configuration.SystemBanner.isEnabled': detail.checked});
                                }}
                                checked={props.isEnabled!}
                            >
                            </Toggle>
                        </div>
                        <p>Activate System Banner</p>
                    </div>
                    <FormField>
                        <div style={{display: 'grid', textAlign: 'center'}}>
                            <div style={{display: 'grid', justifyContent: 'center'}}>
                                <input
                                    type='color'
                                    onInput={(event) =>
                                        props.setFields({'configuration.SystemBanner.textColor': event.target.value})
                                    }
                                    value={props.textColor}
                                    disabled={!props.isEnabled}
                                    style={{
                                        border: '2px solid #7F8897',
                                        borderRadius: '6px',
                                        padding: '3px'
                                    }}
                                />
                            </div>
                            <p>Text Color</p>
                        </div>
                    </FormField>
                    <FormField>
                        <div style={{display: 'grid', textAlign: 'center'}}>
                            <div style={{display: 'grid', justifyContent: 'center'}}>
                                <input
                                    type='color'
                                    onInput={(event) =>
                                        props.setFields({'configuration.SystemBanner.backgroundColor': event.target.value})
                                    }
                                    value={props.backgroundColor}
                                    disabled={!props.isEnabled}
                                    style={{
                                        border: '2px solid #7F8897',
                                        borderRadius: '6px',
                                        padding: '3px'
                                    }}
                                />
                            </div>
                            <p>Background Color</p>
                        </div>
                    </FormField>
                </Grid>
                <FormField
                    label='Banner Text'
                >
                    <Input
                        onChange={({detail}) => {
                            props.setFields({'configuration.SystemBanner.text': detail.value});
                        }}
                        onBlur={() => props.touchFields(['configuration.SystemBanner.text'])}
                        value={props.text}
                        placeholder='Enter system banner text'
                        disabled={!props.isEnabled}
                    />
                </FormField>
            </SpaceBetween>
        </Container>
    );
}

export default SystemBannerConfiguration;