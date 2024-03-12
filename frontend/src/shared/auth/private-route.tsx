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
import { RouteProps } from 'react-router-dom';
import { Flashbar, FlashbarProps } from '@cloudscape-design/components';
import ErrorBoundary from '../error/error-boundary';

type IOwnProps = {
    hasAnyAuthorities?: string[];
    children: React.ReactNode;
} & RouteProps;

export const PrivateRoute = ({ children, hasAnyAuthorities = [], ...rest }: IOwnProps) => {
    const [items, setItems] = React.useState([
        {
            header: 'Insufficient access',
            type: 'error',
            content: 'You are trying to access a resource that you do not have permissions for.',
            dismissible: true,
            dismissLabel: 'Dismiss message',
            onDismiss: () => setItems([]),
            id: 'message_1',
        },
    ] as FlashbarProps.MessageDefinition[]);

    if (!children) {
        throw new Error(
            `A component needs to be specified for private route for path ${(rest as any).path}`
        );
    }

    if (hasAnyAuthorities) {
        return <ErrorBoundary>{children}</ErrorBoundary>;
    }

    return <Flashbar items={items} />;
};

export default PrivateRoute;
