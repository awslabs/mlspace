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
import { useAppDispatch } from '../../../../config/store';
import Table from '../../../../modules/table';
import { setBreadcrumbs } from '../../../../shared/layout/navigation/navigation.reducer';
import { ProjectGroupActions } from './project.groups.actions';
import { useParams } from 'react-router-dom';
import { getBase } from '../../../../shared/util/breadcrumb-utils';
import { DocTitle } from '../../../../shared/doc';
import { getProject, getProjectGroups } from '../../project.reducer';
import { isFulfilled } from '@reduxjs/toolkit';
import { useNotificationService } from '../../../../shared/util/hooks';
import { projectGroupColumns } from '../../../project/project.columns';
import { IProjectGroup } from '../../../../shared/model/projectGroup.model';

export function ProjectGroups () {
    const { projectName } = useParams();
    const [projectGroups, setProjectGroups] = useState<IProjectGroup[]>();
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);

    DocTitle(`${projectName} Project Groups`);

    const refreshHandler = useCallback(() => {
        dispatch(getProject({projectName: String(projectName)}));
        setProjectGroups(undefined);
        dispatch(getProjectGroups(String(projectName))).then((response) => {
            if (isFulfilled(response)) {
                setProjectGroups(response.payload.data);
            } else {
                notificationService.showAxiosRejectedActionNotification('get project groups', response);
            }
        });
    }, [dispatch, notificationService, projectName]);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Groups', href: `#/project/${projectName}/groups` },
            ])
        );

        refreshHandler();
    }, [dispatch, projectName, refreshHandler]);

    return (
        <div>
            <Table
                tableName='Project group'
                tableType={'multi'}
                actions={(e: any) => ProjectGroupActions({ ...e, projectName, refreshHandler, projectGroups })}
                trackBy='group'
                keepSelection={false}
                allItems={projectGroups || []}
                columnDefinitions={projectGroupColumns}
                loadingItems={projectGroups === undefined}
                loadingText='Loading Project groups'
            />
        </div>
    );
}

export default ProjectGroups;
