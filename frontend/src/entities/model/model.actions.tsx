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
import { deleteModelFromProject } from './model.reducer';
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch } from '../../config/store';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { ModelResourceMetadata } from '../../shared/model/resource-metadata.model';
import { deletionDescription } from '../../shared/util/form-utils';

function ModelActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const nav = (endpoint: string) => navigate(endpoint);
    const createModelRef = props?.focusProps?.createModelRef;
    const { projectName } = useParams();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {ModelActionButton(nav, projectName!, dispatch, props)}
            {ModelCreateButton(projectName!, createModelRef)}
        </SpaceBetween>
    );
}

// function ModelCreateEndpointButton() {
//     const navigate = useNavigate();

//     return (
//         <Button
//             disabled={true}
//             variant="primary"
//             onClick={() => navigate('/endpoints/endpoint-create')}
//         >
//             Create Endpoint
//         </Button>
//     );
// }

// function ModelCreateEndpointConfigurationButton(projectName: string) {
//     const navigate = useNavigate();

//     return (
//         <Button
//             disabled={true}
//             variant="primary"
//             onClick={() => navigate(`/project/${projectName}/endpoint-config/create`)}
//         >
//             Create Endpoint Configuration
//         </Button>
//     );
// }

function ModelActionButton (
    nav: any,
    projectName: string,
    dispatch: ThunkDispatch<any, undefined, Action>,
    props?: any
) {
    const selectedModel = props?.selectedItems[0];

    return (
        <ButtonDropdown
            items={[
                { text: 'Details', id: 'details' },
                { text: 'Delete', id: 'delete', disabled: selectedModel?.status === 'Deleted' },
            ]}
            variant='primary'
            disabled={selectedModel === undefined}
            onItemClick={(e) => ModelActionHandler(e, selectedModel, nav, projectName, dispatch)}
        >
            Actions
        </ButtonDropdown>
    );
}

function ModelCreateButton (projectName: string, createModelRef: RefObject<HTMLInputElement>) {
    const navigate = useNavigate();
    return (
        <Button
            variant='primary'
            ref={createModelRef}
            onClick={() => navigate(`/project/${projectName}/model/create`)}
        >
            Create model
        </Button>
    );
}

const ModelActionHandler = (
    e: any,
    model: ModelResourceMetadata,
    nav: any,
    projectName: string,
    dispatch: ThunkDispatch<any, undefined, Action>
) => {
    switch (e.detail.id) {
        case 'details':
            nav(`/project/${projectName}/model/${model.resourceId}`);
            break;
        case 'delete':
            dispatch(
                setDeleteModal({
                    resourceName: model.resourceId,
                    resourceType: 'model',
                    onConfirm: () => dispatch(deleteModelFromProject(model.resourceId)),
                    postConfirm: () => nav(`/project/${projectName}/model/`),
                    description: deletionDescription('Model'),
                })
            );
    }
};

export default ModelActions;
