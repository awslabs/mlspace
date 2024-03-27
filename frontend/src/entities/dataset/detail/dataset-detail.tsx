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
    ContentLayout,
    SpaceBetween,
    Header,
    Button,
    ExpandableSection,
    StatusIndicator,
} from '@cloudscape-design/components';
import {
    datasetBinding,
    getDatasetByScopeAndName,
    getFileEntities,
    loadingDataset,
} from '../../../entities/dataset/dataset.reducer';
import { IDataset } from '../../../shared/model/dataset.model';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { useNavigate, useParams } from 'react-router-dom';
import { ManageFiles } from '../manage/dataset.files';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { showAccessLevel } from '../dataset.utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import DetailsContainer from '../../../modules/details-container';

function DatasetDetail () {
    const { projectName, scope, name } = useParams();
    const basePath = projectName ? `/project/${projectName}` : '/personal';

    const dataset: IDataset = useAppSelector(datasetBinding);
    const datasetLoading = useAppSelector(loadingDataset);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const datasetDetails = new Map<string, ReactNode>();
    datasetDetails.set('Name', dataset.name);
    datasetDetails.set('Description', dataset.description);
    datasetDetails.set('Access level', showAccessLevel(dataset));
    datasetDetails.set('Location', dataset.location);

    scrollToPageHeader();
    DocTitle('Dataset Details: ', dataset.name);

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Datasets', href: `#${basePath}/dataset` },
                { text: `${name}`, href: `#${basePath}/dataset/${scope}/${name}` },
            ])
        );
        dispatch(getDatasetByScopeAndName({ scope: scope, name: name }))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
    }, [dispatch, navigate, basePath, name, projectName, scope]);

    return (
        <ContentLayout header={<Header variant='h1'>{dataset.name}</Header>}>
            <SpaceBetween direction='vertical' size='xxl'>
                <DetailsContainer
                    header='Dataset details'
                    columns={3}
                    info={datasetDetails}
                    actions={
                        <Button
                            onClick={() =>
                                navigate(
                                    `${basePath}/dataset/${dataset.scope}/${dataset.name}/edit`
                                )
                            }
                        >
                            Edit
                        </Button>
                    }
                    loading={datasetLoading}
                />
                <Container>
                    {datasetLoading ? (
                        <StatusIndicator type='loading'>Loading files</StatusIndicator>
                    ) : (
                        <ExpandableSection
                            onChange={() => dispatch(getFileEntities(dataset))}
                            headerText='View files'
                        >
                            <ManageFiles dataset={dataset} readOnly={true} />
                        </ExpandableSection>
                    )}
                </Container>
            </SpaceBetween>
        </ContentLayout>
    );
}

export default DatasetDetail;
