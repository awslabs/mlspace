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
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { stopBatchTranslateJob } from './batch-translate.reducer';
import { useAppDispatch } from '../../config/store';
import { BatchTranslateResourceMetadata } from '../../shared/model/resource-metadata.model';
import { useNotificationService } from '../../shared/util/hooks';
import { INotificationService } from '../../shared/layout/notification/notification.service';

function BatchTranslateActions (props?: any) {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const nav = (batchJob: string) => navigate(batchJob);
    const createBatchJobRef = props?.focusProps?.createBatchJobRef;
    const { projectName } = useParams();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {BatchTranslateActionButton(dispatch, nav, projectName!, props)}
            {BatchTranslateCreateButton(projectName!, createBatchJobRef)}
        </SpaceBetween>
    );
}

function BatchTranslateActionButton (
    dispatch: Dispatch,
    nav: any,
    projectName: string,
    props?: any
) {
    const selectedTranslateJob = props?.selectedItems[0];
    const notificationService = useNotificationService(dispatch);

    return (
        <ButtonDropdown
            items={[
                { text: 'Details', id: 'details' },
                { text: 'Stop', id: 'stop' },
            ]}
            variant='primary'
            disabled={selectedTranslateJob === undefined}
            onItemClick={(e) =>
                BatchTranslateActionHandler(e, selectedTranslateJob, nav, dispatch, projectName, notificationService)
            }
        >
            Actions
        </ButtonDropdown>
    );
}

function BatchTranslateCreateButton (
    projectName: string,
    createBatchJobRef: RefObject<HTMLInputElement>
) {
    const navigate = useNavigate();
    return (
        <Button
            variant='primary'
            ref={createBatchJobRef}
            onClick={() => navigate(`/project/${projectName}/batch-translate/create`)}
        >
            Create batch translate job
        </Button>
    );
}

const BatchTranslateActionHandler = async (
    e: any,
    batchJob: BatchTranslateResourceMetadata,
    nav: any,
    dispatch: ThunkDispatch<any, any, Action>,
    projectName: string,
    notificationService: INotificationService
) => {
    let response: any | undefined = undefined;
    switch (e.detail.id) {
        case 'details':
            nav(`/project/${projectName}/batch-translate/${batchJob.resourceId}`);
            break;
        case 'stop':
            response = await dispatch(stopBatchTranslateJob(batchJob.resourceId));
            break;
    }
    if (response) {
        const success = response.type.endsWith('/fulfilled');
        if (success) {
            notificationService.generateNotification('Successfully stopped job.', 'success');
        } else {
            notificationService.generateNotification('Failed to stop job.', 'error');
        }
    }
};

export default BatchTranslateActions;
