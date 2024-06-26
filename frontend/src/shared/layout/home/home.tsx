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
import {useAppDispatch} from '../../../config/store';
import {
    setActiveHref,
    setBreadcrumbs,
    setItemsForProjectName,
} from '../navigation/navigation.reducer';
import ProjectCards from '../../../entities/project/card';
import { selectProject } from '../../../entities/project/card/project-card.reducer';
import { Header } from '@cloudscape-design/components';
import { resetCurrentProject } from '../../../entities/project/project.reducer';
import ContentLayout from '../content-layout';

export const Home = () => {
    const dispatch = useAppDispatch();
    useEffect(() => {
        dispatch(selectProject());
        dispatch(setBreadcrumbs([]));
        dispatch(setActiveHref('/#'));
        dispatch(setItemsForProjectName());
        dispatch(resetCurrentProject());
    }, [dispatch]);

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description={`Select an existing ${window.env.APPLICATION_NAME} project or create a new project.`}
                >
                    {window.env.APPLICATION_NAME}
                </Header>
            }
        >
            <ProjectCards />
        </ContentLayout>
    );
};

export default Home;
