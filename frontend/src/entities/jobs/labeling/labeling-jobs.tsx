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
import Table from '../../../modules/table';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import LabelingJobActions from './labeling-job.actions';
import { clearLabelingJobs, listLabelingJobs, loadingLabelingJobs } from './labeling-job.reducer';
import { defaultColumns, visibleColumns, visibleContentPreference } from './labeling-job.columns';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { focusOnCreateButton } from '../../../shared/util/url-utils';
import { LabelingJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

export const LabelingJobs = () => {
    const { projectName } = useParams();
    const labelingJobs: LabelingJobResourceMetadata[] = useAppSelector(
        (state) => state.jobs.labeling.jobs
    );
    const loadingLabelingJobsList = useAppSelector(loadingLabelingJobs);
    const createJobRef: RefObject<HTMLInputElement> = useRef(null);

    const dispatch = useAppDispatch();

    DocTitle(`${projectName} Labeling Jobs`);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Labeling jobs', href: `#/project/${projectName}/jobs/labeling` },
            ])
        );

        if (focusOnCreateButton()) {
            createJobRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'Labeling jobs');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, projectName]);

    return (
        <Table
            tableName='Labeling job'
            tableType='single'
            trackBy='resourceId'
            itemNameProperty='resourceId'
            allItems={labelingJobs}
            actions={LabelingJobActions}
            focusProps={{ createJobRef: createJobRef }}
            columnDefinitions={defaultColumns}
            visibleColumns={visibleColumns}
            visibleContentPreference={visibleContentPreference}
            loadingItems={loadingLabelingJobsList}
            loadingText='Loading resources'
            serverFetch={listLabelingJobs}
            storeClear={clearLabelingJobs}
        />
    );
};

export default LabelingJobs;
