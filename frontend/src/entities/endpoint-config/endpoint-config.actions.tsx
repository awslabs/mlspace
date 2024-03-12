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

import React, { RefObject } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteEndpointConfig } from './endpoint-config.reducer';
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch } from '../../config/store';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { EndpointConfigResourceMetadata } from '../../shared/model/resource-metadata.model';
import { deletionDescription } from '../../shared/util/form-utils';

function EndpointConfigActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const nav = (endpoint: string) => navigate(endpoint);
    const createEndpointConfigRef = props?.focusProps?.createEndpointConfigRef;
    const { projectName } = useParams();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {EndpointConfigActionButton(nav, projectName!, dispatch, props)}
            {EndpointConfigCreateButton(projectName!, createEndpointConfigRef)}
        </SpaceBetween>
    );
}

function EndpointConfigActionButton (
    nav: any,
    projectName: string,
    dispatch: ThunkDispatch<any, undefined, Action>,
    props?: any
) {
    const selectedEndpointConfig = props?.selectedItems[0];

    return (
        <ButtonDropdown
            items={[
                { text: 'Details', id: 'details' },
                { text: 'Delete', id: 'delete' },
            ]}
            variant='primary'
            disabled={selectedEndpointConfig === undefined}
            onItemClick={(e) =>
                EndpointConfigActionHandler(e, selectedEndpointConfig, nav, projectName, dispatch)
            }
        >
            Actions
        </ButtonDropdown>
    );
}

function EndpointConfigCreateButton (
    projectName: string,
    createEndpointConfigRef: RefObject<HTMLInputElement>
) {
    const navigate = useNavigate();
    return (
        <Button
            variant='primary'
            ref={createEndpointConfigRef}
            onClick={() => navigate(`/project/${projectName}/endpoint-config/create`)}
        >
            Create endpoint configuration
        </Button>
    );
}

const EndpointConfigActionHandler = (
    e: any,
    endpointConfig: EndpointConfigResourceMetadata,
    nav: any,
    selectedProjectName: string,
    dispatch: ThunkDispatch<any, undefined, Action>
) => {
    switch (e.detail.id) {
        case 'details':
            nav(`/project/${selectedProjectName}/endpoint-config/${endpointConfig.resourceId}`);
            break;
        case 'delete':
            dispatch(
                setDeleteModal({
                    resourceName: endpointConfig.resourceId,
                    resourceType: 'endpoint config',
                    onConfirm: () => deleteEndpointConfig(endpointConfig.resourceId),
                    postConfirm: () => nav(`/project/${selectedProjectName}/endpoint-config`),
                    description: deletionDescription('Endpoint configuration'),
                })
            );
    }
};

export default EndpointConfigActions;
