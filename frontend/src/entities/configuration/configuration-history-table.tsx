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

import React from 'react';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { IAppConfiguration, defaultConfiguration } from '../../shared/model/app.configuration.model';
import { appConfig, appConfigList, getConfiguration, loadingAppConfig, updateConfiguration } from './configuration-reducer';
import { Box, Button, Header, Modal, SpaceBetween, Table } from '@cloudscape-design/components';
import NotificationService from '../../shared/layout/notification/notification.service';

export function ConfigurationHistoryTable () {
    const configList: IAppConfiguration[] = useAppSelector(appConfigList);
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const loadingConfig: boolean = useAppSelector(loadingAppConfig);
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const [modal, setModal] = React.useState<{ visible: boolean; appConfig: IAppConfiguration }>({
        visible: false,
        appConfig: defaultConfiguration,
    });

    const columnDefinition = [
        {
            header: 'Version',
            cell: (item) => item.versionId,
        },
        {
            header: 'Changed by',
            cell: (item) => item.changedBy,
        },
        {
            header: 'Change reason',
            cell: (item) => item.changeReason,
        },
        {
            header: 'Rollback',
            cell: (item) => (
                <Button variant={'inline-link'} onClick={() => setModal({...modal, visible: true, appConfig: {...item, versionId: applicationConfig.versionId}})}>Rollback</Button>),
        },
    ];
    return (
        <>
            <Table
                header={<Header> Configuration history </Header>}
                columnDefinitions={columnDefinition}
                items={configList}
                loading={loadingConfig}
                loadingText='Loading configurations'
            />

            <Modal 
                visible={modal.visible}
                onDismiss={() => setModal({...modal, visible: false})}
                header={<Header>Rollback</Header>}
                footer={
                    <Box float='right'>
                        <SpaceBetween direction='horizontal' size='xs'>
                            <Button onClick={() => setModal({...modal, visible: false})}>Cancel</Button>
                            <Button onClick={async () => {
                                const resp = await dispatch(updateConfiguration({appConfiguration: modal.appConfig}));
                                setModal({...modal, visible: false});
                                const responseStatus = resp.payload.status;
                                if (responseStatus >= 400) {
                                    if (responseStatus === 429) {
                                        notificationService.generateNotification(
                                            'Outdated configuration - please refresh to get the latest configuration, then try again.',
                                            'error'
                                        );
                                    } else {
                                        notificationService.generateNotification(
                                            'Something went wrong while uploading the configuration. Please try again or check system logs.',
                                            'error'
                                        );
                                    }
                                } else {
                                    dispatch(getConfiguration('global'));
                                    notificationService.generateNotification(
                                        'Successfully updated configuration.',
                                        'success'
                                    );
                                }
                            }
                            }>Rollback</Button>
                        </SpaceBetween>
                    </Box>
                }
            >
                Are you sure you want to rollback to this version?
            </Modal>
        </>
        
    );
}