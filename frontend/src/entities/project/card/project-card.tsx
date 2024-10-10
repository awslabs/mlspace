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

import React, { RefObject, useEffect, useRef, useState } from 'react';
import {
    Cards,
    TextFilter,
    CollectionPreferences,
    Pagination,
    Header,
    Grid,
    Link,
    SpaceBetween,
    StatusIndicator,
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { IProject } from '../../../shared/model/project.model';
import { useAppSelector, useAppDispatch } from '../../../config/store';
import { EmptyState, paginationLabels } from '../../../modules/table';
import { ProjectCreateButton } from '../project.actions';
import { listProjectsForUser } from '../project.reducer';
import ProjectCardActions from './project-card.actions';
import {
    IProjectCardProps,
    cardsPerRow,
    pageSizePreference,
    visibleContentPreference,
} from './project-card.props';
import { DocTitle, scrollToPageHeader } from '../../../../src/shared/doc';
import { focusOnCreateButton } from '../../../shared/util/url-utils';
import { useParams } from 'react-router-dom';
import { getMatchesCountText } from '../../../shared/util/table-utils';

export function ProjectCards () {
    const projectList: IProject[] = useAppSelector((state) => state.project.projects);
    const projectListLoading = useAppSelector((state) => state.project.loading);
    const [preferences, setPreferences] = useState({
        pageSize: 6,
        visibleContent: ['description', 'status'],
    } as IProjectCardProps);
    const { items, filteredItemsCount, collectionProps, filterProps, paginationProps } =
        useCollection(projectList, {
            filtering: {
                empty: EmptyState('No projects exist'),
                noMatch: EmptyState('No matches found'),
            },
            pagination: { pageSize: preferences.pageSize },
            sorting: {},
            selection: {},
        });

    const { selectedItems } = collectionProps;

    const dispatch = useAppDispatch();

    const createProjectCardRef: RefObject<HTMLInputElement> = useRef(null);
    const { projectName } = useParams();

    DocTitle('Available Projects');

    useEffect(() => {
        dispatch(listProjectsForUser());

        if (focusOnCreateButton(projectName)) {
            createProjectCardRef.current?.focus();
        } else {
            scrollToPageHeader('h2', 'Available projects');
        }
    }, [dispatch, projectName]);

    return (
        <Cards
            variant='container'
            data-cy='project-cards'
            {...collectionProps}
            selectionType='single'
            cardDefinition={{
                header: (e) => (
                    <Link fontSize='heading-m' href={`#/project/${e.name}`}>
                        {e.name}
                    </Link>
                ),
                sections: [
                    {
                        id: 'description',
                        header: 'Description',
                        content: (p: IProject) => p.description,
                    },
                    {
                        id: 'status',
                        header: 'Status',
                        content: (p: IProject) =>
                            p.suspended ? (
                                <StatusIndicator type='stopped'>Suspended</StatusIndicator>
                            ) : (
                                <StatusIndicator>Active</StatusIndicator>
                            ),
                    },
                ],
            }}
            ariaLabels={{
                itemSelectionLabel: (e, n) => `select project ${n.name}`,
                selectionGroupLabel: 'Project selection',
            }}
            cardsPerRow={cardsPerRow}
            items={items}
            loading={projectListLoading}
            loadingText='Loading available projects'
            trackBy='name'
            key='cardList'
            visibleSections={preferences.visibleContent}
            header={
                <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                    <Header variant='h2'>Available projects</Header>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <SpaceBetween direction='horizontal' size='xs'>
                            {ProjectCardActions({ selectedItems: selectedItems })}
                            {ProjectCreateButton(createProjectCardRef)}
                        </SpaceBetween>
                    </div>
                </Grid>
            }
            filter={
                <TextFilter
                    {...filterProps}
                    countText={getMatchesCountText(filteredItemsCount || 0)}
                    filteringAriaLabel='Filter projects'
                    filteringClearAriaLabel='Clear text for filtering projects'
                />
            }
            pagination={<Pagination {...paginationProps} ariaLabels={paginationLabels} />}
            preferences={
                <CollectionPreferences
                    title='Preferences'
                    confirmLabel='Confirm'
                    cancelLabel='Cancel'
                    preferences={preferences}
                    pageSizePreference={pageSizePreference}
                    visibleContentPreference={visibleContentPreference}
                    onConfirm={({ detail }) =>
                        setPreferences({
                            ...preferences,
                            visibleContent: detail.visibleContent,
                            pageSize: detail.pageSize!,
                        })
                    }
                />
            }
        />
    );
}

export default ProjectCards;
