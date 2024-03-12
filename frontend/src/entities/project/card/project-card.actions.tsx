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
import { ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../config/store';
import { IProject } from '../../../shared/model/project.model';
import { removeUserFromProject } from '../../user/user.reducer';
import { listProjectsForUser } from '../project.reducer';
import { selectProject } from './project-card.reducer';

function ProjectCardActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const nav = (endpoint: string) => navigate(endpoint);

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {ProjectCardActionButton(dispatch, nav, props)}
        </SpaceBetween>
    );
}

function ProjectCardActionButton (
    dispatch: ThunkDispatch<any, any, Action>,
    nav: (endpoint: string) => void,
    props?: any
) {
    const selectedProject = props?.selectedItems[0];
    const username = props?.selectedItems[1];

    const items = [
        { text: 'Switch to project scope', id: 'scope' },
        { text: 'Leave Project', id: 'leave_project' },
    ];

    return (
        <ButtonDropdown
            items={items}
            variant='primary'
            disabled={selectedProject === undefined}
            onItemClick={(e) =>
                ProjectCardActionHandler(e, selectedProject, username, dispatch, nav)
            }
        >
            Actions
        </ButtonDropdown>
    );
}

const ProjectCardActionHandler = (
    e: any,
    project: IProject,
    username: string,
    dispatch: ThunkDispatch<any, any, Action>,
    nav: (endpoint: string) => void
) => {
    switch (e.detail.id) {
        case 'scope':
            dispatch(selectProject(project));
            nav(`/project/${project.name}`);
            break;
        case 'leave_project':
            dispatch(removeUserFromProject({ user: username, project: project.name! })).then(() => {
                dispatch(selectProject(undefined));
                dispatch(listProjectsForUser());
            });
            break;
    }
};

export default ProjectCardActions;
