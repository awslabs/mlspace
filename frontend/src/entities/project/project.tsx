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
import { useAppSelector } from '../../config/store';
import Table from '../../modules/table';
import { IProject } from '../../shared/model/project.model';
import { CallbackFunction } from '../../types';
import { projectColumns, visibleColumns, visibleContentPreference } from './project.columns';
import { selectUserProjects } from './project.reducer';

export type ProjectTableProps = {
    selectItemsCallback?: CallbackFunction;
};

export function Project (props: ProjectTableProps) {
    const allProjects: IProject[] = useAppSelector(selectUserProjects);
    const loadingProjects = useAppSelector((state) => state.project.loading);

    return (
        <Table
            header={<></>}
            tableName='Project'
            trackBy='name'
            tableType='multi'
            variant='embedded'
            allItems={allProjects}
            columnDefinitions={projectColumns}
            visibleColumns={visibleColumns}
            visibleContentPreference={visibleContentPreference}
            selectItemsCallback={props.selectItemsCallback}
            loadingItems={loadingProjects}
            loadingText='Loading projects'
        />
    );
}

export default Project;
