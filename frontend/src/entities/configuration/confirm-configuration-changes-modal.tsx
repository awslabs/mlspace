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
    Box,
    SpaceBetween,
    Button,
    TextContent,
    FormField,
    Input,
    Modal
} from '@cloudscape-design/components';
import React from 'react';
import _ from 'lodash';

export type ConfirmConfigurationChangesModalProps = {
    visible: boolean;
    setVisible: (boolean) => void;
    setFields: (any) => void;
    isSubmitting: boolean;
    difference: {object};
    changeReason: string;
    submit: () => void;
};

export function ConfirmConfigurationChangesModal (props: ConfirmConfigurationChangesModalProps) {
    const isObject = (x) => typeof x === 'object' && !Array.isArray(x) && x !== null;

    /**
     * Converts a JSON object into an outline structure represented as React nodes.
     *
     * @param {object} [json={}] - The JSON object to be converted.
     * @returns {React.ReactNode[]} - An array of React nodes representing the outline structure.
     */
    function jsonToOutline (json = {}) {
        const output: React.ReactNode[] = [];

        for (const key in json) {
            const value = json[key];
            output.push((<li><p><strong>{key}</strong></p></li>));

            if (isObject(value)) {
                const recursiveJson = jsonToOutline(value); // recursively call
                output.push((recursiveJson));
            }
        }
        return <ul>{output}</ul>;
    }

    return (
        <>
            <Modal
                visible={props.visible}
                onDismiss={() => props.setVisible(false)}
                header={<Header>Confirm changes</Header>}
                footer={
                    <Box float='right'>
                        <SpaceBetween direction='horizontal' size='xs'>
                            <Button onClick={() => props.setVisible(false)}>Cancel</Button>
                            <Button
                                variant='primary'
                                loading={props.isSubmitting}
                                disabled={_.isEmpty(props.difference)}
                                onClick={async () => {
                                    await props.submit();
                                    props.setVisible(false);
                                }
                                }>Save</Button>
                        </SpaceBetween>
                    </Box>
                }
            >
                <SpaceBetween size={'s'}>
                    <Container>
                        <TextContent>
                            {_.isEmpty(props.difference) ? <p>No changes detected</p> : jsonToOutline(props.difference)}
                        </TextContent>
                    </Container>


                    <FormField
                        label='Change reason'
                    >
                        <Input
                            value={props.changeReason}
                            onChange={(event) => {
                                props.setFields({ 'changeReason': event.detail.value });
                            }}
                            disabled={_.isEmpty(props.difference)}
                        />
                    </FormField>

                </SpaceBetween>

            </Modal>
        </>
    );
}

export default ConfirmConfigurationChangesModal;