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

import {
    Button,
    ButtonDropdown,
    Container,
    Form,
    FormField,
    Header,
    Icon,
    Multiselect,
    Select,
    SelectProps,
    SpaceBetween,
    Spinner,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DocTitle, scrollToPageHeader } from '../../../src/shared/doc';
import { useAppDispatch } from '../../config/store';
import Condition from '../../modules/condition';
import Table from '../../modules/table';
import { setBreadcrumbs } from '../../shared/layout/navigation/navigation.reducer';
import NotificationService from '../../shared/layout/notification/notification.service';
import { IProject } from '../../shared/model/project.model';
import { IReport } from '../../shared/model/report.model';
import { IUser } from '../../shared/model/user.model';
import { getBase } from '../../shared/util/breadcrumb-utils';
import Project from '../project/project';
import User from '../user/user';
import { ReportActionHandler } from './report.actions';
import { reportColumns, resourceTypeOptions, scopeOptions, visibleReportColumns } from './report.columns';
import { ReportScope, createReport, downloadReport, listReports } from './report.service';
import ContentLayout from '../../shared/layout/content-layout';

export function Report () {
    const dispatch = useAppDispatch();
    const [selectedResourceOptions, setSelectedResourceOptions] = useState([] as readonly SelectProps.Option[]);
    const [selectedScope, setSelectedScope] = useState({} as SelectProps.Option);
    const [creatingReport, setCreatingReport] = useState(false);
    const [loadingReports, setLoadingReports] = useState(false);
    const [reports, setReports] = useState([] as IReport[]);
    const [downloadReportUrl, setDownloadReportUrl] = useState('');
    const notificationService = NotificationService(dispatch);
    const { projectName } = useParams();
    const [selectedTargets, setSelectedTargets] = useState([] as string[]);

    const targetSelectionCallback = async (targets: IProject[] | IUser[]) => {
        if (targets.length === 1) {
            if (selectedScope.value === 'user') {
                setSelectedTargets(targets.map((t) => t.username));
            } else if (selectedScope.value === 'project') {
                setSelectedTargets(targets.map((t) => t.name));
            }
        }
    };

    DocTitle('Reports');

    useEffect(() => {
        dispatch(
            setBreadcrumbs([getBase(projectName), { text: 'Reports', href: '#/admin/reports' }])
        );

        setLoadingReports(true);
        listReports().then((result) => {
            setReports(result);
            setLoadingReports(false);
        });

        scrollToPageHeader('h1', `${window.env.APPLICATION_NAME} Reports`);
    }, [dispatch, projectName]);

    function ReportActions (props?: any) {
        return (
            <SpaceBetween direction='horizontal' size='xs'>
                <Button
                    onClick={() => {
                        setLoadingReports(true);
                        listReports().then((result) => {
                            setReports(result);
                            setLoadingReports(false);
                        });
                    }}
                    ariaLabel={'Refresh reports list'}
                >
                    <Icon name='refresh' />
                </Button>
                <ButtonDropdown
                    items={[
                        {
                            text: 'Download report',
                            id: 'downloadReport',
                            href: downloadReportUrl,
                            external: false,
                            disabled: downloadReportUrl === '',
                        },
                        {
                            text: 'Delete report',
                            id: 'deleteReport',
                        },
                    ]}
                    variant='primary'
                    disabled={!props?.selectedItems[0]}
                    onItemClick={(e) => {
                        ReportActionHandler(e, props?.selectedItems[0].Name, dispatch);
                        (async () => {
                            await listReports().then((result) => {
                                // The list_objects_v2 API has a delay before the deleted report
                                // is removed, so it sometimes will return the deleted report.
                                // If it is returned from the list call, remove it and update
                                // the table
                                const deletedIndex = result.findIndex((element) => {
                                    return element.Name === props?.selectedItems[0].Name;
                                });
                                if (deletedIndex !== -1) {
                                    result.splice(deletedIndex, 1);
                                }
                                setReports(result);
                            });
                        })();
                    }}
                >
                    Actions
                </ButtonDropdown>
            </SpaceBetween>
        );
    }

    return (
        <ContentLayout
            header={
                <Header
                    variant='h1'
                    description={`Generate reports of ${window.env.APPLICATION_NAME} resources and users`}
                >
                    {window.env.APPLICATION_NAME} Reports
                </Header>
            }
        >
            <SpaceBetween direction='vertical' size='xl'>
                <Form
                    actions={
                        <SpaceBetween direction='horizontal' size='s'>
                            <Button
                                formAction='none'
                                variant='link'
                                onClick={() => {
                                    setSelectedResourceOptions([]);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={creatingReport || selectedResourceOptions.length === 0}
                                variant='primary'
                                onClick={async () => {
                                    setCreatingReport(true);
                                    try {
                                        await createReport({
                                            resources: selectedResourceOptions.map((resource) => resource.label!),
                                            scope: selectedScope.value as ReportScope,
                                            targets: selectedScope.value !== 'system' ? selectedTargets : []
                                        });
                                        setCreatingReport(false);
                                        notificationService.generateNotification(
                                            'Report successfully generated.',
                                            'success'
                                        );
                                        const response = await listReports();
                                        setReports(response);
                                    } catch (error: any) {
                                        setCreatingReport(false);
                                        notificationService.generateNotification(
                                            `Failed to generate ${window.env.APPLICATION_NAME} report with error: ${error.response.data}`,
                                            'error'
                                        );
                                    }
                                }}
                            >
                                Generate report {creatingReport ? <Spinner></Spinner> : ''}
                            </Button>
                        </SpaceBetween>
                    }
                >
                    <Container header={<h2>Report configuration</h2>}>
                        <SpaceBetween size='l'>
                            <FormField
                                label='Report scope'
                                description='The scope of the report determines whether data is included for all resources in the system, resources associated with a subset of projects, or only those resources associated with a subset of users.'
                            >
                                <Select
                                    selectedOption={selectedScope}
                                    onChange={({ detail }) => setSelectedScope(detail.selectedOption)}
                                    options={scopeOptions}
                                    selectedAriaLabel='Selected'
                                />
                            </FormField>
                            <Condition condition={(selectedScope.value ? selectedScope.value !== 'system' : false)}>
                                <FormField
                                    label={`Report ${selectedScope.value}s`}
                                    description={`Report details will be generated for all resources associated with the selected ${selectedScope.value}.`}
                                >
                                    {
                                        selectedScope.value === 'user'
                                            ? <User header={<></>} tableType='multi' variant='embedded' selectItemsCallback={targetSelectionCallback} />
                                            : <Project selectItemsCallback={targetSelectionCallback} /> }
                                </FormField>
                            </Condition>
                            <FormField
                                label='Resources types'
                                description='Data for each of the selected resource types will be included in the generated CSV file.'
                            >
                                <Multiselect
                                    selectedOptions={selectedResourceOptions}
                                    onChange={({ detail }) => setSelectedResourceOptions(detail.selectedOptions)}
                                    deselectAriaLabel={(e) => `Remove ${e.label}`}
                                    options={resourceTypeOptions}
                                    filteringType='auto'
                                    placeholder='Choose options'
                                    selectedAriaLabel='Selected'
                                />
                            </FormField>
                        </SpaceBetween>
                    </Container>
                </Form>

                <div>
                    <Table
                        tableName='Report'
                        trackBy='Name'
                        tableType={'single'}
                        actions={ReportActions}
                        allItems={reports}
                        columnDefinitions={reportColumns}
                        visibleColumns={visibleReportColumns}
                        loadingItems={loadingReports}
                        loadingText='Loading reports'
                        selectItemsCallback={async (report: IReport[]) => {
                            setDownloadReportUrl('');
                            try {
                                const result = await downloadReport(report[0].Name!);
                                setDownloadReportUrl(result);
                            } catch (err) {
                                notificationService.generateNotification(
                                    `Error generating presigned URL for ${report[0].Name}`,
                                    'error'
                                );
                            }
                        }}
                    />
                </div>
            </SpaceBetween>
        </ContentLayout>
    );
}

export default Report;
