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
    Modal,
    Alert
} from '@cloudscape-design/components';
import React, {useEffect, useMemo, useState} from 'react';
import _ from 'lodash';
import {SetFieldsFunction} from '../../shared/validation';

export type ConfirmConfigurationChangesModalProps = {
    visible: boolean;
    setVisible: (boolean) => void;
    setFields: SetFieldsFunction;
    isSubmitting: boolean;
    submit: () => void;
    appConfiguration: {object};
    inMemoryConfiguration: {object};
};

export function ConfirmConfigurationChangesModal (props: ConfirmConfigurationChangesModalProps) {
    const [changeReason, setChangeReason] = useState('');

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
            output.push((<li><p><strong>{_.startCase(key)}</strong></p></li>));

            if (_.isPlainObject(value)) {
                const recursiveJson = jsonToOutline(value); // recursively call
                output.push((recursiveJson));
            }
        }
        return <ul>{output}</ul>;
    }

    /**
     * Computes the difference between two JSON objects, recursively.
     *
     * This function takes two JSON objects as input and returns a new object that
     * contains the differences between the two. Works with nested objects.
     *
     * @param {object} [obj1={}] - The first JSON object to compare.
     * @param {object} [obj2={}] - The second JSON object to compare.
     * @returns {object} - A new object containing the differences between the two input objects.
     */
    function getJsonDifference (obj1 = {}, obj2 = {}) {
        const output = {},
            merged = { ...obj1, ...obj2 }; // has properties of both

        for (const key in merged) {
            const value1 = obj1[key], value2 = obj2[key];

            if (_.isPlainObject(value1) || _.isPlainObject(value2)) {
                const value = getJsonDifference(value1, value2); // recursively call
                if (Object.keys(value).length !== 0) {
                    output[key] = value;
                }

            } else {
                if (!_.isEqual(value1, value2)) {
                    output[key] = value2;
                }
            }
        }
        return output;
    }

    const changesDiff = useMemo(() => {
        return getJsonDifference(props.appConfiguration, props.inMemoryConfiguration);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.appConfiguration, props.inMemoryConfiguration]);

    const isDeactivatingService = !_.isEmpty(changesDiff) &&
        Object.keys(changesDiff).includes('EnabledServices') &&
        Object.values(changesDiff['EnabledServices']).includes(false);

    useEffect(() => {
        props.setFields({ 'changeReason': changeReason });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [changeReason]);

    useEffect(() => {
        setChangeReason(`Changes to: ${Object.keys(changesDiff)}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.visible]);

    return (
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
                            disabled={_.isEmpty(changesDiff)}
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
                <Alert statusIconAriaLabel='Warning' visible={isDeactivatingService} type='warning'>
                    You are about to deactivate a service. Deactivated services will no longer appear
                    within the MLSpace user interface or be available for use within Notebooks.
                    Deactivating services will suspend all active corresponding jobs and instances
                    associated with the service.
                </Alert>
                <Container>
                    <TextContent>
                        {_.isEmpty(changesDiff) ? <p>No changes detected</p> : jsonToOutline(changesDiff)}
                    </TextContent>
                </Container>


                <FormField
                    label='Change reason'
                >
                    <Input
                        value={changeReason}
                        onChange={(event) => {
                            setChangeReason(event.detail.value);
                        }}
                        disabled={_.isEmpty(changesDiff)}
                    />
                </FormField>
            </SpaceBetween>
        </Modal>
    );
}

export default ConfirmConfigurationChangesModal;