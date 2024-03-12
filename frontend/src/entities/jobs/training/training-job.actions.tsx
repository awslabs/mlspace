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

import React from 'react';
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { NavigateFunction, useNavigate, useParams } from 'react-router-dom';
import { CreateFocus } from '../types';
import { Dispatch } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import axios from '../../../shared/util/axios-utils';
import { TrainingJobResourceMetadata } from '../../../shared/model/resource-metadata.model';
import { ITrainingJob } from './training-job.model';
import { defaultModelContainer } from '../../../shared/model/container.model';

export const createModelFromTrainingJob = (trainingJob : ITrainingJob, navigate: NavigateFunction, projectName: string) => {
    const presetModel = defaultModelContainer();

    presetModel.Image =
        trainingJob.AlgorithmSpecification?.TrainingImage;
    presetModel.ModelDataUrl =
        trainingJob.OutputDataConfig?.S3OutputPath;
    navigate(`/project/${projectName}/model/create`, {
        state: {
            presetModel: presetModel,
        },
    });
};


export default function TrainingJobActions (props?: any) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const createJobRef = props?.focusProps?.createJobRef;

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {TrainingJobsActionButton(navigate, dispatch, props)}
            <CreateTrainingJob createJobRef={createJobRef} />
        </SpaceBetween>
    );
}

function TrainingJobsActionButton (nav: NavigateFunction, dispatch: Dispatch, props?: any) {
    const selectedTrainingJob = props?.selectedItems[0];
    const { projectName } = useParams();

    return (
        <ButtonDropdown
            data-cy='dataset-actions-dropdown'
            items={[
                { text: 'Clone', id: 'clone' },
                { text: 'Create model', id: 'model' },
            ]}
            variant='primary'
            disabled={selectedTrainingJob === undefined}
            onItemClick={(e) => {
                TrainingJobsActionHandler(e, selectedTrainingJob, nav, projectName);
            }}
        >
            Actions
        </ButtonDropdown>
    );
}

function CreateTrainingJob ({ createJobRef }: CreateFocus) {
    const navigate = useNavigate();
    const { projectName } = useParams();

    return (
        <Button
            variant='primary'
            ref={createJobRef}
            onClick={() => {
                navigate(`/project/${projectName}/jobs/training/create`);
            }}
        >
            Create new training job
        </Button>
    );
}

const TrainingJobsActionHandler = async (
    event: any,
    selectedTrainingJob: TrainingJobResourceMetadata,
    nav: NavigateFunction,
    projectName?: string
) => {
    const basePath = `/project/${projectName}`;

    axios.get(`job/training/${selectedTrainingJob.resourceId}`)
        .then((response) => {
            switch (event.detail.id) {
                case 'clone':
                    nav(`${basePath}/jobs/training/create`, {state: {trainingJob: response.data}});
                    break;
                case 'model':
                    createModelFromTrainingJob(response.data, nav, projectName);
                    break;
            }
        });
};
