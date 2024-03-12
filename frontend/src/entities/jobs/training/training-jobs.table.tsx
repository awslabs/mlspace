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

import React, { ReactElement } from 'react';
import { useAppSelector } from '../../../config/store';
import Table from '../../../modules/table';
import { clearTrainingJobs, listTrainingJobs, loadingTrainingJobs } from './training-job.reducer';
import { defaultColumns, visibleContentPreference } from './training-job.columns';
import { TrainingJobResourceMetadata } from '../../../shared/model/resource-metadata.model';

export type TrainingJobsTableProps = {
    serverRequestProps?: object;
    focusProps?: object;
    header?: ReactElement;
    tableType: 'single' | 'multi';
    visibleColumns: string[];
    variant?: 'embedded' | 'container' | 'borderless' | 'stacked' | 'full-page';
    actions?: (props?: any) => ReactElement;
    selectItemsCallback?: (selectedItems: any[]) => void;
};

export const TrainingJobsTable = (props: TrainingJobsTableProps) => {
    const trainingJobs: TrainingJobResourceMetadata[] = useAppSelector(
        (state) => state.jobs.training.jobs
    );
    const loadingTrainingJobsList = useAppSelector(loadingTrainingJobs);

    return (
        <Table
            {...props}
            tableName='Training job'
            trackBy='resourceId'
            itemNameProperty='resourceId'
            allItems={trainingJobs}
            columnDefinitions={defaultColumns}
            visibleContentPreference={visibleContentPreference}
            loadingItems={loadingTrainingJobsList}
            loadingText='Loading resources'
            serverFetch={listTrainingJobs}
            storeClear={clearTrainingJobs}
        />
    );
};
