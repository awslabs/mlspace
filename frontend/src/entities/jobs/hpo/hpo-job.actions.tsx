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
import { NavigateFunction, useNavigate, useParams } from 'react-router-dom';
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { CreateFocus } from '../types';
import { Dispatch } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import { HPOJobResourceMetadata } from '../../../shared/model/resource-metadata.model';
import axios from '../../../shared/util/axios-utils';

export default function HPOJobActions (props?: any) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const createJobRef = props?.focusProps?.createJobRef;

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {HpoJobsActionButton(navigate, dispatch, props)}
            {<CreateHPOJob createJobRef={createJobRef} />}
        </SpaceBetween>
    );
}

function HpoJobsActionButton (nav: NavigateFunction, dispatch: Dispatch, props?: any) {
    const selectedHpoJob = props?.selectedItems[0];
    const { projectName } = useParams();

    return (
        <ButtonDropdown
            data-cy='dataset-actions-dropdown'
            items={[
                { text: 'Clone', id: 'clone' },
            ]}
            variant='primary'
            disabled={selectedHpoJob === undefined}
            onItemClick={(e) => {
                HpoJobsActionHandler(e, selectedHpoJob, nav, projectName);
            }}
        >
            Actions
        </ButtonDropdown>
    );
}

function CreateHPOJob ({ createJobRef }: CreateFocus) {
    const navigate = useNavigate();
    const { projectName } = useParams();

    return (
        <Button
            variant='primary'
            ref={createJobRef}
            onClick={() => {
                navigate(`/project/${projectName}/jobs/hpo/create`);
            }}
        >
            Create new HPO job
        </Button>
    );
}

const HpoJobsActionHandler = async (
    event: any,
    selectedHpoJob: HPOJobResourceMetadata,
    nav: NavigateFunction,
    projectName?: string
) => {
    const basePath = `/project/${projectName}`;

    switch (event.detail.id) {
        case 'clone': {
            const response = await axios.get(`job/hpo/${selectedHpoJob.resourceId}`);
            nav(`${basePath}/jobs/hpo/create`, {state: {hpoTrainingJob: response.data}});
            break;
        }
    }
};
