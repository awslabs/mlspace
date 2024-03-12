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

import { MultiselectProps, SelectProps, TableProps } from '@cloudscape-design/components';
import { IReport } from '../../shared/model/report.model';

const reportColumns: TableProps.ColumnDefinition<IReport>[] = [
    {
        id: 'Name',
        header: 'Report name',
        sortingField: 'Name',
        cell: (item) => item.Name,
    },
    {
        id: 'LastModified',
        header: 'Modified date',
        sortingField: 'LastModified',
        cell: (item) => item.LastModified,
    },
];

const visibleReportColumns: string[] = ['Name', 'LastModified'];

const scopeOptions: SelectProps.Option[] = [
    {
        label: 'System wide',
        value: 'system',
        description: 'Include all resources within MLSpace in the generated report',
    },
    {
        label: 'Project specific',
        value: 'project',
        description: 'Only include resources from the selected project(s) in the generated report',
    },
    {
        label: 'User level',
        value: 'user',
        description: 'Only include resources created by the selected user(s) in the generated report',
    },
];

const resourceTypeOptions: MultiselectProps.Option[] = [
    {
        label: 'Personnel',
        value: '1',
        description: `Export list of all ${window.env.APPLICATION_NAME} users`,
    },
    {
        label: 'Notebooks',
        value: '2',
        description:
            'Export list of all notebook instances including their name, status, creation date, last modified date, auto-stop time, and type',
    },
    {
        label: 'HPO Jobs',
        value: '3',
        description:
            'Export list of all HPO jobs including their name, status, creation date, last modified date, and total number of training jobs',
    },
    {
        label: 'Models',
        value: '4',
        description: 'Export list of all models including their name and creation date',
    },
    {
        label: 'Endpoint Configs',
        value: '5',
        description: 'Export list of all endpoint configs including their name and creation date',
    },
    {
        label: 'Endpoints',
        value: '6',
        description:
            'Export list of all endpoints including their name, status, creation date, last modified date, and auto-termination time',
    },
    {
        label: 'Transform Jobs',
        value: '7',
        description:
            'Export list of all transform jobs including their name, status, creation date, and last modified date',
    },
    {
        label: 'Training Jobs',
        value: '8',
        description:
            'Export list of all training jobs including their name, status, creation date, and last modified date',
    },
    {
        label: 'EMR Clusters',
        value: '9',
        description:
            'Export list of all EMR Clusters including their name, status, creation date, release label, and auto-termination time',
    },
    {
        label: 'Batch Translation Jobs',
        value: '10',
        description:
            'Export list of all batch translation jobs including their name, status, creation date, source language code, and target language codes',
    },
    {
        label: 'GroundTruth Labeling Jobs',
        value: '11',
        description:
            'Export list of all GroundTruth labeling jobs including their name, status, creation date, and task type',
    },
];

export { reportColumns, resourceTypeOptions, scopeOptions, visibleReportColumns };
