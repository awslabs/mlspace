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
    Header,
    SpaceBetween,
    StatusIndicator,
} from '@cloudscape-design/components';
import { getModelByName, loadingModel, modelBinding } from '../model.reducer';
import { IModel } from '../../../shared/model/model.model';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { useNavigate, useParams } from 'react-router-dom';
import DetailsContainer from '../../../modules/details-container';
import { IModelContainer } from '../../../shared/model/container.model';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { formatDate } from '../../../shared/util/date-utils';
import { formatDisplayBoolean } from '../../../shared/util/form-utils';
import ContentLayout from '../../../shared/layout/content-layout';

function ModelDetail () {
    const { projectName, modelName } = useParams();

    const model: IModel = useAppSelector(modelBinding);
    const modelLoading = useAppSelector(loadingModel);

    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    scrollToPageHeader();
    DocTitle('Model Details: ', modelName);

    useEffect(() => {
        dispatch(getModelByName(modelName!))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Models', href: `#/project/${projectName}/model` },
                { text: 'Details', href: `#/project/${projectName}/model/${modelName}` },
            ])
        );
    }, [dispatch, navigate, projectName, modelName]);

    const modelSettings = new Map<string, string>();
    const modelNetwork = new Map<string, ReactNode>();
    if (model) {
        modelSettings.set('Name', model.ModelName!);
        modelSettings.set('ARN', model.ModelArn!);
        modelSettings.set('Creation time', formatDate(model.CreationTime));
        modelSettings.set('IAM role ARN', model.ExecutionRoleArn!);

        modelNetwork.set('Network isolation', formatDisplayBoolean(model.EnableNetworkIsolation));
        modelNetwork.set('Subnet(s)', model.VpcConfig?.Subnets);
    }

    return (
        model && (
            <ContentLayout headerVariant='high-contrast' header={<Header variant='h1'>{modelName}</Header>}>
                {modelLoading ? (
                    <Container>
                        <StatusIndicator type='loading'>Loading details</StatusIndicator>
                    </Container>
                ) : (
                    <SpaceBetween size='l'>
                        <DetailsContainer
                            key={'model-settings'}
                            columns={4}
                            header='Model settings'
                            info={modelSettings}
                        />
                        <DetailsContainer
                            key={'model-network'}
                            columns={2}
                            header='Network'
                            info={modelNetwork}
                        />
                        {model.Containers?.map((container: IModelContainer, index: number) => {
                            const modelContainerSettings = new Map<string, string>();
                            const environmentVariables: string | any = [];
                            modelContainerSettings.set(
                                'Container name',
                                container.ContainerHostName!
                            );
                            modelContainerSettings.set('Image', container.Image!);
                            modelContainerSettings.set('Mode', container.Mode!);
                            modelContainerSettings.set(
                                'Model data location',
                                container.ModelDataUrl!
                            );
                            if (container.Environment !== undefined) {
                                Object.entries(container.Environment!).forEach(([key, value]) => {
                                    environmentVariables.push(` | ${key} : ${value} | `);
                                });
                                modelContainerSettings.set(
                                    'Environment variables',
                                    environmentVariables
                                );
                            }
                            return (
                                <DetailsContainer
                                    key={`container-${index}-settings`}
                                    columns={4}
                                    header='Container settings'
                                    info={modelContainerSettings}
                                    loading={modelLoading}
                                />
                            );
                        })}
                    </SpaceBetween>
                )}
            </ContentLayout>
        )
    );
}

export default ModelDetail;
