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
import { useAppDispatch, useAppSelector } from '../../config/store';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import {
    clearClustersList,
    listEMRClusters,
    loadingClustersList,
    selectEMRClusters,
} from './emr.reducer';
import Table from '../../modules/table';
import { defaultColumns, visibleContentPreference } from './emr-clusters.columns';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../shared/doc';
import EMRClusterActions from './emr-clusters.actions';
import { focusOnCreateButton } from '../../shared/util/url-utils';

export const EMRClusters = () => {
    const { projectName } = useParams();
    const dispatch = useAppDispatch();
    const emrClusters = useAppSelector(selectEMRClusters);
    const createEmrRef: RefObject<HTMLInputElement> = useRef(null);
    const loadingClusters = useAppSelector(loadingClustersList);

    DocTitle(projectName!.concat(' EMR Clusters'));

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'EMR Clusters', href: `#/project/${projectName}/emr` },
            ])
        );

        if (focusOnCreateButton()) {
            createEmrRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'EMR Clusters');
        }
    }, [dispatch, projectName]);

    return (
        <Table
            tableName='EMR Cluster'
            tableType='single'
            focusProps={{ createEmrRef: createEmrRef }}
            trackBy='Id'
            itemNameProperty='Name'
            allItems={emrClusters}
            actions={EMRClusterActions}
            columnDefinitions={defaultColumns}
            visibleColumns={['name', 'status', 'completed', 'created', 'duration']}
            visibleContentPreference={visibleContentPreference}
            loadingItems={loadingClusters}
            serverFetch={listEMRClusters}
            storeClear={clearClustersList}
        />
    );
};

export default EMRClusters;
