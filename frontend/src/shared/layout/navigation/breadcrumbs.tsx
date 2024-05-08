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

import { BreadcrumbGroup, BreadcrumbGroupProps } from '@cloudscape-design/components';

import { useAppSelector } from '../../../config/store';
import React from 'react';

function BreadcrumbsProvider () {
    const breadcrumbs: BreadcrumbGroupProps.Item[] = useAppSelector(
        (state) => state.navigation.breadcrumbs
    );

    return (
        <BreadcrumbGroup items={breadcrumbs} ariaLabel='Breadcrumbs' />
    );
}

export default BreadcrumbsProvider;
