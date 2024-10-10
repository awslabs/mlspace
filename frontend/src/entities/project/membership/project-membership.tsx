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
import { useAppDispatch } from '../../../config/store';
import { setBreadcrumbs } from '../../../shared/layout/navigation/navigation.reducer';
import { useParams } from 'react-router-dom';
import { getBase } from '../../../shared/util/breadcrumb-utils';
import { DocTitle } from '../../../shared/doc';
import { ContentLayout, Header, Tabs } from '@cloudscape-design/components';
import ProjectUser from '../users/project-user';
import ProjectGroups from '../detail/groups';

export function ProjectMembership () {
    const { projectName } = useParams();

    const dispatch = useAppDispatch();

    DocTitle(projectName!.concat(' Project Membership'));

    useEffect(() => {
        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Membership', href: `#/project/${projectName}/membership` },
            ])
        );
    }, [dispatch, projectName]);

    return (
        <ContentLayout headerVariant='high-contrast' header={<Header
            variant='h1'
            description={'Administer group and user memberships for this project, including designating who can serve as owners.'}>
            Project membership
        </Header>}>
            <Tabs variant='container' tabs={[{
                id: 'users',
                label: 'Users',
                content: (<ProjectUser key='project-users' />)
            }, {
                id: 'groups',
                label: 'Groups',
                content: (<ProjectGroups key='project-groups' />)
            }]} />
        </ContentLayout>
    );
}

export default ProjectMembership;
