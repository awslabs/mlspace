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
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch } from '../../config/store';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { deleteEndpoint } from './endpoint.reducer';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { EndpointResourceMetadata } from '../../shared/model/resource-metadata.model';
import { deletionDescription } from '../../shared/util/form-utils';

function EndpointConfigActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const nav = (endpoint: string) => navigate(endpoint);
    const createEndpointRef = props?.focusProps?.createEndpointRef;
    const { projectName } = useParams();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {EndpointActionButton(nav, projectName!, dispatch, props)}
            {EndpointCreateButton(projectName!, createEndpointRef)}
        </SpaceBetween>
    );
}

function EndpointActionButton (
    nav: any,
    projectName: string,
    dispatch: ThunkDispatch<any, undefined, Action>,
    props?: any
) {
    const selectedEndpoint = props?.selectedItems[0];

    return (
        <ButtonDropdown
            items={[
                { text: 'Details', id: 'details' },
                { text: 'Delete', id: 'delete' },
            ]}
            variant='primary'
            disabled={selectedEndpoint === undefined}
            onItemClick={(e) =>
                EndpointActionHandler(e, selectedEndpoint, nav, projectName, dispatch)
            }
        >
            Actions
        </ButtonDropdown>
    );
}

function EndpointCreateButton (projectName: string, createEndpointRef: RefObject<HTMLInputElement>) {
    const navigate = useNavigate();
    return (
        <Button
            variant='primary'
            ref={createEndpointRef}
            onClick={() => navigate(`/project/${projectName}/endpoint/create`)}
        >
            Create endpoint
        </Button>
    );
}

const EndpointActionHandler = (
    e: any,
    endpoint: EndpointResourceMetadata,
    nav: any,
    selectedProjectName: string,
    dispatch: ThunkDispatch<any, undefined, Action>
) => {
    switch (e.detail.id) {
        case 'details':
            nav(`/project/${selectedProjectName}/endpoint/${endpoint.resourceId}`);
            break;
        case 'delete':
            dispatch(
                setDeleteModal({
                    resourceName: endpoint.resourceId,
                    resourceType: 'endpoint',
                    onConfirm: async () => await deleteEndpoint(endpoint.resourceId),
                    postConfirm: () => nav(`/project/${selectedProjectName}/endpoint`),
                    description: `${deletionDescription(
                        'Endpoint'
                    )} Endpoints cannot be deleted while in a transitive state (Creating/Updating).`,
                    disabled:
                        endpoint.metadata.EndpointStatus === 'Updating' ||
                        endpoint.metadata.EndpointStatus === 'Creating',
                })
            );
    }
};

export default EndpointConfigActions;
