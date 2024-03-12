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
    Box,
    ColumnLayout,
    Container,
    Header,
    SpaceBetween,
    StatusIndicator,
} from '@cloudscape-design/components';
import React, { ReactNode } from 'react';
import { DetailsContainerOptions } from './details-container.types';

export default function DetailsContainer ({
    columns,
    header,
    info,
    actions,
    alert,
    loading,
    isEmbedded = false,
}: DetailsContainerOptions) {
    const elements: ReactNode[] = [];
    let elementCount = 0;
    info.forEach((value, key) => {
        const valueEnsuredList: ReactNode[] = Array.isArray(value) ? value : [ value || '-']; // if not array, make into array

        const valueElements = (valueEnsuredList).map((value, index) => {
            let valueKey = `${key}-value`;
            if (index > 0) {
                valueKey += `-${index}`;
            }
            return <Box key={valueKey} data-cy={valueKey}>{value}</Box>;
        });

        elements.push(
            <Box key={elementCount++}>
                <Box variant='awsui-key-label' data-cy={`${key}-label`}>
                    {key}
                </Box>
                {valueElements}
            </Box>
        );
    });
    return (
        <Container
            variant={isEmbedded ? 'stacked' : 'default'}
            header={
                <Header variant={isEmbedded ? 'h3' : 'h2'} actions={actions}>
                    {header}
                </Header>
            }
        >
            {loading ? (
                <StatusIndicator type='loading'>Loading details</StatusIndicator>
            ) : (
                <SpaceBetween size='l'>
                    {alert}
                    <ColumnLayout columns={columns}>{elements}</ColumnLayout>
                </SpaceBetween>
            )}
        </Container>
    );
}
