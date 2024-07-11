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

import React, { RefObject, useRef } from 'react';
import { useEffect, useState } from 'react';
import {
    defaultColumns,
    visibleColumns,
    visibleContentPreference,
} from './endpoint-config.columns';
import { clearEndpointConfigs, getProjectEndpointConfigs } from './endpoint-config.reducer';
import { useAppDispatch, useAppSelector } from '../../config/store';
import Table from '../../modules/table';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import EndpointConfigActions from './endpoint-config.actions';
import { IEndpointConfig } from '../../shared/model/endpoint-config.model';
import { useParams } from 'react-router-dom';
import { EmbeddedableComponent } from './common-components';
import { Box, Button } from '@cloudscape-design/components';
import { CallbackFunction } from '../../types';
import { getEndpointConfigByName } from './endpoint-config.service';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../src/shared/doc';
import { focusOnCreateButton } from '../../shared/util/url-utils';
import { EndpointConfigResourceMetadata } from '../../shared/model/resource-metadata.model';
import { useNotificationService } from '../../shared/util/hooks';

type EndpointConfigComponentOptions = {
    selectEndpointConfig?: CallbackFunction;
} & EmbeddedableComponent;

export const EndpointConfig = ({
    isEmbedded = false,
    selectEndpointConfig,
}: EndpointConfigComponentOptions) => {
    const configList: EndpointConfigResourceMetadata[] = useAppSelector(
        (state) => state.endpointConfig.entities
    );
    const endpointConfigListLoading = useAppSelector((state) => state.endpointConfig.loading);
    const [selectedConfig, setSelectedConfig] = useState<IEndpointConfig>();
    const createEndpointConfigRef: RefObject<HTMLInputElement> = useRef(null);
    const { projectName } = useParams();

    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);

    if (isEmbedded === false) {
        DocTitle(projectName!.concat(' Endpoint Configs'));
    }

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'Endpoint Configs',
                    href: `#/project/${projectName}/endpoint-config`,
                },
            ])
        );
        if (focusOnCreateButton()) {
            createEndpointConfigRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'Endpoint Configs');
        }
    }, [dispatch, projectName]);

    const selectConfig = async (endpointConfigs: EndpointConfigResourceMetadata[]) => {
        if (endpointConfigs.length === 1) {
            try {
                const selectedConfig = await getEndpointConfigByName(endpointConfigs[0].resourceId);
                return setSelectedConfig(selectedConfig.data);
            } catch (err) {
                notificationService.generateNotification(
                    'Failed to retrieve endpoint configuration details.',
                    'error'
                );
            }
        }
    };

    return (
        <Table
            tableName='Endpoint Config'
            tableType='single'
            trackBy='resourceId'
            actions={isEmbedded ? undefined : EndpointConfigActions}
            focusProps={{ createEndpointConfigRef: createEndpointConfigRef }}
            allItems={configList}
            selectItemsCallback={isEmbedded ? selectConfig : undefined}
            columnDefinitions={defaultColumns}
            visibleColumns={visibleColumns}
            visibleContentPreference={isEmbedded ? undefined : visibleContentPreference}
            footer={
                isEmbedded ? (
                    <Box textAlign='right'>
                        <Button
                            disabled={!selectedConfig}
                            onClick={() => selectEndpointConfig!(selectedConfig!)}
                        >
                            Select endpoint configuration
                        </Button>
                    </Box>
                ) : undefined
            }
            loadingItems={endpointConfigListLoading}
            loadingText='Loading resources'
            variant={isEmbedded ? 'embedded' : undefined}
            serverFetch={getProjectEndpointConfigs}
            storeClear={clearEndpointConfigs}
        />
    );
};

export default EndpointConfig;
