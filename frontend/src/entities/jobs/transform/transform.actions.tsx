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
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { NavigateFunction, useNavigate, useParams } from 'react-router-dom';
import { stopTransformJob } from './transform.service';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { useAppDispatch } from '../../../config/store';
import NotificationService from '../../../shared/layout/notification/notification.service';
import { TransformJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

function BatchTransformJobActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const createJobRef = props?.focusProps?.createJobRef;
    const { projectName } = useParams();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {BatchTransformJobActionButton(dispatch, projectName!, navigate, props)}
            {BatchTransformJobCreateButton(createJobRef)}
        </SpaceBetween>
    );
}

function BatchTransformJobCreateButton (createJobRef: RefObject<HTMLInputElement>) {
    const navigate = useNavigate();

    return (
        <Button variant='primary' ref={createJobRef} onClick={() => navigate('create')}>
            Create batch transform job
        </Button>
    );
}

function BatchTransformJobActionButton (
    dispatch: ThunkDispatch<any, any, Action>,
    projectName: string,
    navigate: NavigateFunction,
    props?: any
) {
    const selectedJob = props?.selectedItems[0];

    return (
        <ButtonDropdown
            items={[
                { text: 'Details', id: 'detail' },
                {
                    text: 'Stop',
                    id: 'stop',
                    disabled: selectedJob?.TransformJobStatus !== 'InProgress',
                },
            ]}
            variant='primary'
            disabled={selectedJob === undefined}
            onItemClick={(e) =>
                BatchTransformJobActionHandler(e, selectedJob, projectName, dispatch, navigate)
            }
        >
            Actions
        </ButtonDropdown>
    );
}

const BatchTransformJobActionHandler = (
    e: any,
    transform: TransformJobResourceMetadata,
    projectName: string,
    dispatch: ThunkDispatch<any, any, Action>,
    navigate: NavigateFunction
) => {
    const notificationService = NotificationService(dispatch);
    switch (e.detail.id) {
        case 'stop':
            stopTransformJob({ jobName: transform.resourceId, projectName: projectName }).then(
                (response) => {
                    if (response.status === 200) {
                        notificationService.generateNotification(
                            'Successfully stopped job.',
                            'success'
                        );
                    } else {
                        notificationService.generateNotification('Failed to stop job.', 'error');
                    }
                }
            );
            break;
        case 'detail':
            navigate(`${transform.resourceId}`);
            break;
    }
};

export { BatchTransformJobActions };
