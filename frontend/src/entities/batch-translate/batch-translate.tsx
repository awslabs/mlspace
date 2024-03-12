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
import {
    defaultColumns,
    visibleColumns,
    visibleContentPreference,
} from './batch-translate.columns';
import { useAppDispatch, useAppSelector } from '../../config/store';
import Table from '../../modules/table';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import BatchTranslateActions from './batch-translate.actions';
import { useParams } from 'react-router-dom';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../src/shared/doc';
import { focusOnCreateButton } from '../../shared/util/url-utils';
import {
    batchTranslateJobList,
    clearBatchTranslateJobList,
    listBatchTranslateJobs,
    loadingBatchTranslateJob,
} from './batch-translate.reducer';
import { BatchTranslateResourceMetadata } from '../../shared/model/resource-metadata.model';

export const BatchTranslate = () => {
    const batchTranslateJobs: BatchTranslateResourceMetadata[] =
        useAppSelector(batchTranslateJobList);
    const loadingAction = useAppSelector(loadingBatchTranslateJob);
    const createBatchTranslateJobRef: RefObject<HTMLInputElement> = useRef(null);
    const { projectName } = useParams();

    const dispatch = useAppDispatch();

    DocTitle(`${projectName} Batch Translate Jobs`);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'Batch Translate Jobs',
                    href: `#/project/${projectName}/batch-translate`,
                },
            ])
        );
        if (focusOnCreateButton()) {
            createBatchTranslateJobRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'Batch Translate Jobs');
        }
    }, [dispatch, projectName]);

    return (
        <Table
            tableName='Batch Translate Job'
            tableType='single'
            itemNameProperty='metadata.JobName'
            trackBy='resourceId'
            actions={BatchTranslateActions}
            focusProps={{ createBatchTranslateJobRef: createBatchTranslateJobRef }}
            allItems={batchTranslateJobs}
            columnDefinitions={defaultColumns}
            visibleColumns={visibleColumns}
            visibleContentPreference={visibleContentPreference}
            loadingAction={loadingAction}
            serverFetch={listBatchTranslateJobs}
            storeClear={clearBatchTranslateJobList}
        />
    );
};

export default BatchTranslate;
