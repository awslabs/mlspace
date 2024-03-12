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
import { batchTransformJobColumns, visibleColumns } from './transform.columns';
import { BatchTransformJobActions } from './transform.actions';
import {
    clearTransformJobs,
    getBatchTransformJobs,
    loadingTransformJobsList,
} from './transform.reducer';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import Table from '../../../modules/table';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { focusOnCreateButton } from '../../../shared/util/url-utils';
import { TransformJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

export function Transform () {
    const batchTransformJobs: TransformJobResourceMetadata[] = useAppSelector(
        (state) => state.jobs.transform.jobs
    );
    const loadingTransformJobs = useAppSelector(loadingTransformJobsList);
    const createJobRef: RefObject<HTMLInputElement> = useRef(null);
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    DocTitle(projectName!.concat(' Batch Transform Jobs'));

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Batch Transform', href: `#/project/${projectName}/jobs/transform` },
            ])
        );

        if (focusOnCreateButton()) {
            createJobRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'Batch Transform jobs');
        }
    }, [dispatch, projectName]);

    return (
        <Table
            tableName='Batch Transform job'
            tableType='single'
            trackBy='resourceId'
            actions={BatchTransformJobActions}
            focusProps={{ createJobRef: createJobRef }}
            allItems={batchTransformJobs}
            columnDefinitions={batchTransformJobColumns}
            visibleColumns={visibleColumns}
            loadingItems={loadingTransformJobs}
            loadingText='Loading resources'
            serverFetch={getBatchTransformJobs}
            storeClear={clearTransformJobs}
        />
    );
}

export default Transform;
