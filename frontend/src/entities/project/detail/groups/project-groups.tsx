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
import { generateGroupColumns, visibleColumns } from '../../../group/group.columns';
import { getProject, getProjectGroups } from '../../project.reducer';
import { isFulfilled } from '@reduxjs/toolkit';
import { useNotificationService } from '../../../../shared/util/hooks';
import { IGroup } from '../../../../shared/model/group.model';
import { linkify } from '../../../../shared/util/table-utils';

export function ProjectGroups () {
    const { projectName } = useParams();
    const [projectGroups, setProjectGroups] = useState<IGroup[]>();
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const [needsLoading, setNeedsLoading] = useState<boolean>(true);

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
    }, [dispatch, projectName, refreshHandler]);

    if (needsLoading) {
        if (projectName) {
            setNeedsLoading(false);
            refreshHandler();
        }
    }

    const groupColumns = generateGroupColumns((item) => {
        return linkify('personal/group', item.name, undefined, undefined, true);
    });

    return (
        <div>
            <Table
                tableName='Project group'
                tableType={'multi'}
                actions={(e: any) => ProjectGroupActions({ ...e, projectName, refreshHandler })}
                trackBy='name'
                keepSelection={false}
                allItems={projectGroups || []}
                columnDefinitions={groupColumns}
                visibleColumns={visibleColumns}
                loadingItems={projectGroups === undefined}
                loadingText='Loading Project groups'
            />
        </div>
    );
}

export default ProjectGroups;
