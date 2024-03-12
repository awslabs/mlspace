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

import React, { RefObject, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { clearHPOJobs, listHPOJobs, loadingJobs, selectHPOJobs } from './hpo-job.reducer';
import Table from '../../../modules/table';
import { defaultColumns, visibleContentPreference } from './hpo-job.columns';
import HPOJobActions from './hpo-job.actions';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { focusOnCreateButton } from '../../../shared/util/url-utils';

export const HPOJobs = () => {
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const hpoJobs = useAppSelector(selectHPOJobs);
    const loadingHpoJobs = useAppSelector(loadingJobs);
    const createJobRef: RefObject<HTMLInputElement> = useRef(null);

    DocTitle(projectName!.concat(' HPO Jobs'));

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'HPO Jobs', href: `#/project/${projectName}/jobs/hpo` },
            ])
        );

        if (focusOnCreateButton()) {
            createJobRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'HPO Jobs');
        }
    }, [dispatch, projectName]);

    return (
        <Table
            tableName='HPO Job'
            tableType='single'
            trackBy='resourceId'
            itemNameProperty='resourceId'
            allItems={hpoJobs}
            actions={HPOJobActions}
            focusProps={{ createJobRef: createJobRef }}
            columnDefinitions={defaultColumns}
            visibleColumns={['name', 'status', 'completed', 'created', 'duration']}
            visibleContentPreference={visibleContentPreference}
            loadingItems={loadingHpoJobs}
            loadingText='Loading resources'
            serverFetch={listHPOJobs}
            storeClear={clearHPOJobs}
        />
    );
};
