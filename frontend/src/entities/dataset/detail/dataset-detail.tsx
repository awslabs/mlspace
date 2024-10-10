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

import React, { ReactNode, useEffect } from 'react';
import {
    Container,
    SpaceBetween,
    Header,
    Button,
    StatusIndicator,
} from '@cloudscape-design/components';
import {
    datasetBinding,
    getDataset,
    loadingDataset,
} from '../../../entities/dataset/dataset.reducer';
import { DatasetType, IDataset } from '../../../shared/model/dataset.model';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { useNavigate, useParams } from 'react-router-dom';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { showAccessLevel } from '../dataset.utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import DetailsContainer from '../../../modules/details-container';
import DatasetBrowser from '../../../modules/dataset/dataset-browser';
import { DatasetBrowserActions } from '../dataset.actions';
import { DatasetBrowserManageMode } from '../../../modules/dataset/dataset-browser.types';
import ContentLayout from '../../../shared/layout/content-layout';
import { DatasetProperties } from '../dataset';

function DatasetDetail ({isAdmin}: DatasetProperties) {
    const { projectName, type, scope, name } = useParams();
    let basePath = '';
    if (isAdmin) {
        basePath = '/admin/datasets';
    } else {
        basePath = `${projectName ? `/project/${projectName}` : '/personal'}/dataset`;
    }
    

    const dataset: IDataset = useAppSelector(datasetBinding);
    const datasetLoading = useAppSelector(loadingDataset);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const datasetDetails = new Map<string, ReactNode>();
    datasetDetails.set('Name', dataset.name);
    datasetDetails.set('Description', dataset.description);
    datasetDetails.set('Access level', showAccessLevel(dataset));
    datasetDetails.set('Location', dataset.location);
    if (dataset.type === DatasetType.GROUP) {
        datasetDetails.set(`Group${dataset.groups && dataset.groups.length > 1 ? 's' : ''}`, dataset.groups?.length ? dataset.groups : 'None');
    }
   

    // Make sure the existing Dataset matches the Dataset we're trying to view. If a Dataset was previously
    // loaded then datasetLoading will be false even though we haven't fetched the new Dataset. That would
    // cause the DatasetBrowser to momentarily render with the old Dataset.
    const isLoading = datasetLoading || (dataset.name !== name || dataset.scope !== scope);

    scrollToPageHeader();
    DocTitle('Dataset Details: ', dataset.name);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Datasets', href: `#${basePath}`},
                { text: `${name}`, href: `#${basePath}/${type}/${scope}/${name}` },
            ])
        );
        dispatch(getDataset({ type: type, scope: scope, name: name }))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
    }, [dispatch, navigate, basePath, name, projectName, scope, type, isAdmin]);

    return (
        <ContentLayout headerVariant='high-contrast' header={<Header variant='h1'>{dataset.name}</Header>}>
            <SpaceBetween direction='vertical' size='xxl'>
                <DetailsContainer
                    header='Dataset details'
                    columns={3}
                    info={datasetDetails}
                    actions={
                        <Button
                            onClick={() =>
                                navigate(
                                    `${basePath}/${dataset.type}/${dataset.scope}/${dataset.name}/edit`
                                )
                            }
                        >
                            Edit
                        </Button>
                    }
                    loading={isLoading}
                />
                <Container header={<Header variant='h2'>Dataset files</Header>}>
                    {isLoading ? (
                        <StatusIndicator type='loading'>Loading files</StatusIndicator>
                    ) : (
                        <DatasetBrowser
                            resource={dataset.location || ''}
                            key={dataset.location}
                            isPinned={true}
                            actions={DatasetBrowserActions}
                            selectableItemsTypes={['objects', 'prefixes']}
                            manageMode={DatasetBrowserManageMode.Edit}
                        />
                    )}
                </Container>
            </SpaceBetween>
        </ContentLayout>
    );
}

export default DatasetDetail;
