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

import React, { RefObject, useEffect, useRef } from 'react';
import { defaultColumns, visibleColumns, visibleContentPreference } from './endpoint.columns';
import { clearEndpointsList, getProjectEndpoints } from './endpoint.reducer';
import { useAppDispatch, useAppSelector } from '../../config/store';
import Table from '../../modules/table';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import EndpointActions from './endpoint.actions';
import { useParams } from 'react-router-dom';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../src/shared/doc';
import { focusOnCreateButton } from '../../shared/util/url-utils';
import { EndpointResourceMetadata } from '../../shared/model/resource-metadata.model';

export const Endpoint = () => {
    const endpoints: EndpointResourceMetadata[] = useAppSelector(
        (state) => state.endpoint.entities
    );
    const endpointsListLoading = useAppSelector((state) => state.endpoint.loading);
    const createEndpointRef: RefObject<HTMLInputElement> = useRef(null);
    const { projectName } = useParams();

    const dispatch = useAppDispatch();

    DocTitle(projectName!.concat(' Endpoints'));

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'Endpoints',
                    href: `#/project/${projectName}/endpoint`,
                },
            ])
        );
        if (focusOnCreateButton()) {
            createEndpointRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'Endpoints');
        }
    }, [dispatch, projectName]);

    return (
        <Table
            tableName='Endpoint'
            tableType='single'
            itemNameProperty='resourceId'
            trackBy='resourceId'
            actions={EndpointActions}
            focusProps={{ createEndpointRef: createEndpointRef }}
            allItems={endpoints}
            columnDefinitions={defaultColumns}
            visibleColumns={visibleColumns}
            visibleContentPreference={visibleContentPreference}
            loadingItems={endpointsListLoading}
            loadingText='Loading resources'
            serverFetch={getProjectEndpoints}
            storeClear={clearEndpointsList}
        />
    );
};

export default Endpoint;
