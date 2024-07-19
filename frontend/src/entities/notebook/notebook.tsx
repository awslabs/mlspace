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
import { DocTitle, scrollToPageHeader } from '../../../src/shared/doc';
import { useAppDispatch, useAppSelector } from '../../config/store';
import Table from '../../modules/table';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import { getBase } from '../../shared/util/breadcrumb-utils';
import { focusOnCreateButton } from '../../shared/util/url-utils';
import NotebookActions from './notebook.actions';
import { defaultColumns, visibleColumns, visibleContentPreference } from './notebook.columns';
import {
    listNotebookInstances,
    loadingNotebookAction,
    notebookList,
    clearNotebookList,
} from './notebook.reducer';
import { NotebookResourceMetadata } from '../../shared/model/resource-metadata.model';
import { useParams } from 'react-router-dom';

export const Notebook = () => {
    const notebooks: NotebookResourceMetadata[] = useAppSelector(notebookList);
    const loadingAction = useAppSelector(loadingNotebookAction);
    const createNotebookRef: RefObject<HTMLInputElement> = useRef(null);
    const { projectName } = useParams();
    const isProjectPage = !!projectName;

    const dispatch = useAppDispatch();
    // const
    isProjectPage
        ? DocTitle(`${projectName} Notebook Instances`)
        : DocTitle('Notebook Instances');

    useEffect(() => {
        let breadcrumbHref;
        if (isProjectPage) {
            breadcrumbHref = `#/project/${projectName}/notebooks`;
        } else {
            breadcrumbHref = '#/personal/notebook';
        }

        dispatch(
            setBreadcrumbs([
                getBase(projectName),
                { text: 'Notebook instances', href: breadcrumbHref },
            ])
        );

        if (focusOnCreateButton()) {
            createNotebookRef.current?.focus();
        } else {
            scrollToPageHeader('h1', 'Notebook instances');
        }
    }, [dispatch, projectName, isProjectPage]);

    // remove unnecessary columns
    const tableVisibleColumns = visibleColumns.filter((columnId) => {
        if (isProjectPage && columnId === 'project') {
            // if displaying on a project page there is no use in showing the project column
            return false;
        } else if (!isProjectPage && columnId === 'createdBy') {
            // if displaying on a personal page there is no use in showing the createdBy column
            return false;
        }

        return true;
    });

    return (
        <Table
            key={isProjectPage ? `${projectName}-notebooks` : 'my-notebooks'}
            tableName='Notebook instance'
            tableType='single'
            itemNameProperty='resourceId'
            trackBy='resourceId'
            actions={NotebookActions}
            focusProps={{ createNotebookRef: createNotebookRef }}
            allItems={notebooks}
            columnDefinitions={defaultColumns}
            visibleColumns={tableVisibleColumns}
            visibleContentPreference={visibleContentPreference}
            loadingAction={loadingAction}
            serverFetch={listNotebookInstances}
            storeClear={clearNotebookList}
        />
    );
};

export default Notebook;
