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

import React, { RefObject, useRef } from 'react';
import { useEffect } from 'react';
import { useAppDispatch } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import TrainingJobActions from './training-job.actions';
import { visibleColumns } from './training-job.columns';
import { useParams} from 'react-router-dom';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { focusOnCreateButton } from '../../../shared/util/url-utils';
import { TrainingJobsTable } from './training-jobs.table';

export const TrainingJobs = () => {
    const { projectName } = useParams();
    const createJobRef: RefObject<HTMLInputElement> = useRef(null);

    const dispatch = useAppDispatch();

    DocTitle(`${projectName} Training Jobs`);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Training Jobs', href: `#/project/${projectName}/jobs/training` },
            ])
        );

        if (focusOnCreateButton()) {
            createJobRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'Training jobs');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, projectName]);

    return (
        <TrainingJobsTable
            focusProps={{ createJobRef: createJobRef }}
            visibleColumns={visibleColumns}
            tableType='single'
            actions={TrainingJobActions}
        />
    );
};

export default TrainingJobs;
