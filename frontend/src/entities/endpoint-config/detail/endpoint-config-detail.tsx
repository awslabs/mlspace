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

import React, { useEffect } from 'react';

import { EndpointConfigDetailsView } from '../common-components';
import { getEndpointConfig } from '../endpoint-config.reducer';
import { IEndpointConfig } from '../../../shared/model/endpoint-config.model';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Header, StatusIndicator } from '@cloudscape-design/components';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle } from '../../../../src/shared/doc';
import ContentLayout from '../../../shared/layout/content-layout';

function EndpointConfigDetail () {
    const { projectName, name } = useParams();
    const endpointConfig: IEndpointConfig = useAppSelector((state) => state.endpointConfig.entity);
    const endpointConfigDetailsLoading: IEndpointConfig = useAppSelector(
        (state) => state.endpointConfig.loading
    );
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    DocTitle('Endpoint Config Details: ', endpointConfig.EndpointConfigName);

    useEffect(() => {
        dispatch(getEndpointConfig(name!))
            .unwrap()
            .catch(() => {
                navigate('/404');
            });
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                {
                    text: 'Endpoint configs',
                    href: `#/project/${projectName}/endpoint-config`,
                },
                {
                    text: 'Details',
                    href: `#/project/${projectName}/endpoint-config/${name}`,
                },
            ])
        );
    }, [dispatch, navigate, name, projectName]);

    return (
        <ContentLayout headerVariant='high-contrast' header={<Header variant='h1'>{name}</Header>}>
            {endpointConfigDetailsLoading ? (
                <Container>
                    <StatusIndicator type='loading'>Loading details</StatusIndicator>
                </Container>
            ) : (
                <EndpointConfigDetailsView
                    endpointConfig={endpointConfig}
                    projectName={projectName}
                />
            )}
        </ContentLayout>
    );
}

export default EndpointConfigDetail;
