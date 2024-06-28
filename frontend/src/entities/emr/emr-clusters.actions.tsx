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
import { useAppDispatch } from '../../config/store';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, SpaceBetween, ButtonDropdown } from '@cloudscape-design/components';
import { listEMRClusters, removeEMRCluster, terminateEMRCluster } from './emr.reducer';
import { ThunkDispatch, Action } from '@reduxjs/toolkit';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { deletionDescription } from '../../shared/util/form-utils';
import { EMRResourceMetadata } from '../../shared/model/resource-metadata.model';
import { EMRStatusState } from './emr.model';

export default function EMRClusterActions (props?: any) {
    const createEmrRef = props?.focusProps?.createEmrRef;

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {EMRActionButton(props)}
            {CreateEMRCluster(createEmrRef)}
        </SpaceBetween>
    );
}

function EMRActionButton (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { projectName } = useParams();
    const selectedCluster: EMRResourceMetadata = props?.selectedItems[0];
    return (
        <ButtonDropdown
            items={[
                { text: 'Terminate', id: 'terminate' },
                { text: 'Remove', id: 'remove', disabled: isTerminatedCluster(selectedCluster) }, 
            ]}
            variant='primary'
            disabled={!selectedCluster}
            onItemClick={(e) =>
                EMRClusterActionHandler(e, selectedCluster, navigate, dispatch, projectName!)
            }
        >
            Actions
        </ButtonDropdown>
    );
}

function isTerminatedCluster (cluster: EMRResourceMetadata) {
    if (cluster && cluster.metadata) {
        return (cluster.metadata.Status !== EMRStatusState.TERMINATED && cluster.metadata.Status !== EMRStatusState.TERMINATED_WITH_ERRORS);
    } else {
        return true;
    }
}

const EMRClusterActionHandler = (
    e: any,
    cluster: EMRResourceMetadata,
    nav: any,
    dispatch: ThunkDispatch<any, any, Action>,
    projectName: string
) => {
    switch (e.detail.id) {
        case 'terminate':
            dispatch(
                setDeleteModal({
                    resourceName: cluster.metadata.Name,
                    resourceType: 'EMR Cluster',
                    onConfirm: () => dispatch(terminateEMRCluster(cluster.resourceId)),
                    postConfirm: () => {
                        dispatch(listEMRClusters({}));
                        nav(`/project/${projectName}/emr`);
                    },
                    description: deletionDescription('EMR Cluster'),
                })
            );
            break;
        case 'remove':
            dispatch(
                setDeleteModal({
                    resourceName: cluster.metadata.Name,
                    resourceType: 'EMR Cluster',
                    onConfirm: () => dispatch(removeEMRCluster(cluster.resourceId)),
                    postConfirm: () => nav(`/project/${projectName}/emr`),
                    description: `This will permanently remove the cluster "${cluster.metadata.Name}". After this operation it can no longer be viewed.`,
                })
            );
            break;
    }
};

function CreateEMRCluster (createEmrRef?: RefObject<HTMLInputElement>) {
    const navigate = useNavigate();
    const { projectName } = useParams();

    return (
        <Button
            variant='primary'
            onClick={() => {
                navigate(`/project/${projectName}/emr/create`);
            }}
            ref={createEmrRef}
        >
            Create New EMR Cluster
        </Button>
    );
}
