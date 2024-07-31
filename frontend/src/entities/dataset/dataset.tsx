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
import { adminDatasetColumns, defaultColumns, visibleAdminColumns, visibleColumns, visibleContentPreference } from './dataset.columns';
import { getDatasetsList, loadingDatasetsList, loadingDatasetAction, clearDatasetList, getAllDatasets } from './dataset.reducer';
import { useAppDispatch, useAppSelector } from '../../config/store';
import Table from '../../modules/table';
import { IDataset } from '../../shared/model/dataset.model';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import { DatasetActions } from './dataset.actions';
import { useParams } from 'react-router-dom';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../src/shared/doc';
import { focusOnCreateButton } from '../../shared/util/url-utils';

export type DatasetProperties = {
    isAdmin?: boolean;
};

export const Dataset = ({isAdmin}: DatasetProperties) => {
    const datasetList: IDataset[] = useAppSelector((state) => state.dataset.datasetsList);
    const loadingDatasets = useAppSelector(loadingDatasetsList);
    const loadingAction = useAppSelector(loadingDatasetAction);
    const createDatasetRef: RefObject<HTMLInputElement> = useRef(null);
    const { projectName } = useParams();

    const dispatch = useAppDispatch();

    if (isAdmin) {
        DocTitle('All Datasets');
    } else {
        !projectName ? DocTitle('Datasets') : DocTitle(projectName!.concat(' Datasets'));
    }

    useEffect(() => {
        let href = '#/personal/dataset';
        if (isAdmin) {
            href = '#/admin/datasets';
        } else if (projectName) {
            href = `#/project/${projectName}/dataset`;
        }
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'Datasets',
                    href: href,
                },
            ])
        );

        if (focusOnCreateButton()) {
            createDatasetRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'Dataset');
        }
    }, [dispatch, projectName, isAdmin]);

    useEffect(() => {
        if (isAdmin) {
            dispatch(getAllDatasets());
        } else {
            dispatch(getDatasetsList({projectName}));
        }
    }, [dispatch, isAdmin, projectName]);

    return (
        datasetList && (
            <div>
                <Table
                    tableName='Dataset'
                    tableType='single'
                    actions={DatasetActions}
                    focusProps={{ createDatasetRef: createDatasetRef }}
                    allItems={datasetList}
                    columnDefinitions={isAdmin ? adminDatasetColumns : defaultColumns }
                    visibleColumns={isAdmin ? visibleAdminColumns : visibleColumns}
                    visibleContentPreference={visibleContentPreference}
                    trackBy='location'
                    itemNameProperty='name'
                    loadingItems={loadingDatasets}
                    loadingAction={loadingAction}
                    //serverFetch={isAdmin ? getAllDatasets : getDatasetsList}
                    //AsyncThunk<AxiosResponse<IDataset[], any>, void, AsyncThunkConfig>
                    //AsyncThunk<AxiosResponse<IDataset[], any>, ServerRequestProps, AsyncThunkConfig>
                    storeClear={clearDatasetList}
                />
            </div>
        )
    );
};

export default Dataset;
