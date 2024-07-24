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

import React, { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../config/store';
import Table from '../../../../modules/table';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { ProjectGroupActions } from './project.groups.actions';
import { useParams } from 'react-router-dom';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import { DocTitle } from '../../../../shared/doc';
import { groupColumns, visibleColumns } from '../../../group/group.columns';
import { getProject, getProjectGroups, selectProject } from '../../project.reducer';
import { isFulfilled } from '@reduxjs/toolkit';
import { useNotificationService } from '../../../../shared/util/hooks';
import { IGroup } from '../../../../shared/model/group.model';

export function ProjectGroups () {
    const { projectName } = useParams();
    const [groups, setGroups] = useState<IGroup[]>();
    const project = useAppSelector(selectProject);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);

    DocTitle(`${projectName} Project Groups`);

    const refreshHandler = useCallback(() => {
        setIsLoading(true);
        if (projectName) {
            dispatch(getProject({projectName}));
            dispatch(getProjectGroups(projectName)).then((response) => {
                setIsLoading(false);
                if (isFulfilled(response)) {
                    setGroups(response.payload.data);
                } else {
                    notificationService.showAxiosRejectedActionNotification('get project groups', response);
                }
            });
        }
    }, [dispatch, notificationService, projectName]);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Groups', href: `#/project/${projectName}/groups` },
            ])
        );

        if (projectName && !project) {
            dispatch(getProject({projectName}));
        }

        if (projectName && !groups) {
            refreshHandler();
        }
    }, [dispatch, projectName, project, groups, refreshHandler]);


    return (
        <div>
            <Table
                tableName='Project group'
                tableType={'multi'}
                actions={(e: any) => ProjectGroupActions({ ...e, projectName, refreshHandler })}
                trackBy='name'
                allItems={groups || []}
                columnDefinitions={groupColumns}
                visibleColumns={visibleColumns}
                loadingItems={isLoading}
                loadingText='Loading Project groups'
            />
        </div>
    );
}

export default ProjectGroups;
