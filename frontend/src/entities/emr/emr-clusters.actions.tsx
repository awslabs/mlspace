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
import { terminateEMRCluster } from './emr.reducer';
import { ThunkDispatch, Action } from '@reduxjs/toolkit';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { EMRCluster } from './emr.model';
import { deletionDescription } from '../../shared/util/form-utils';

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
    const selectedCluster: EMRCluster = props?.selectedItems[0];
    return (
        <ButtonDropdown
            items={[{ text: 'Terminate', id: 'terminate' }]}
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

const EMRClusterActionHandler = (
    e: any,
    cluster: EMRCluster,
    nav: any,
    dispatch: ThunkDispatch<any, any, Action>,
    projectName: string
) => {
    switch (e.detail.id) {
        case 'terminate':
            dispatch(
                setDeleteModal({
                    resourceName: cluster.Name!,
                    resourceType: 'EMR Cluster',
                    onConfirm: () => dispatch(terminateEMRCluster(cluster.Id)),
                    postConfirm: () => nav(`/project/${projectName}/emr`),
                    description: deletionDescription('EMR Cluster'),
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
