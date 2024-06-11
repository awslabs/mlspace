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

import React, { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { IAppConfiguration, defaultConfiguration } from '../../shared/model/app.configuration.model';
import { appConfig, appConfigList, getConfiguration, listConfigurations, loadingAppConfigList, updateConfiguration } from './configuration-reducer';
import { Box, Button, FormField, Header, Input, Modal, SpaceBetween } from '@cloudscape-design/components';
import Table from '../../modules/table';
import NotificationService from '../../shared/layout/notification/notification.service';

export function ConfigurationHistoryTable () {
    const configList: IAppConfiguration[] = useAppSelector(appConfigList);
    const applicationConfig: IAppConfiguration = useAppSelector(appConfig);
    const loadingConfigList: boolean = useAppSelector(loadingAppConfigList);
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const [modal, setModal] = React.useState<{ visible: boolean; prevConfig: IAppConfiguration, newConfig: IAppConfiguration }>({
        visible: false,
        prevConfig: defaultConfiguration,
        newConfig: defaultConfiguration,
    });

    useMemo(() => {
        dispatch(listConfigurations({configScope: 'global', numVersions: applicationConfig.versionId + 1}));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applicationConfig, dispatch]);

    const columnDefinition = [
        {
            header: 'Version',
            sortingField: 'versionId',
            cell: (item) => item.versionId,
        },
        {
            header: 'Changed by',
            sortingField: 'changedBy',
            cell: (item) => item.changedBy,
        },
        {
            header: 'Change reason',
            sortingField: 'changeReason',
            cell: (item) => item.changeReason,
        },
        {
            header: 'Rollback',
            cell: (item) => (
                <Button variant={'inline-link'} onClick={() => setModal({...modal, visible: true, newConfig: {...item, versionId: applicationConfig.versionId, changeReason: `Rolled back to version ${item.versionId}`}, prevConfig: item})}>Rollback</Button>),
        },
    ];
    return (
        <>
            <Table
                tableName='Configuration history'
                tableType='single'
                itemNameProperty='versionId'
                trackBy='versionId'
                allItems={configList}
                columnDefinitions={columnDefinition}
            />

            <Modal 
                visible={modal.visible}
                onDismiss={() => setModal({...modal, visible: false})}
                header={<Header>Rollback</Header>}
                footer={
                    <Box float='right'>
                        <SpaceBetween direction='horizontal' size='xs'>
                            <Button onClick={() => setModal({...modal, visible: false})}>Cancel</Button>
                            <Button 
                                variant='primary'
                                loading={loadingConfigList}
                                onClick={async () => {
                                    const resp = await dispatch(updateConfiguration({appConfiguration: modal.newConfig}));
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
                                        dispatch(getConfiguration({configScope: 'global'}));
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
                <SpaceBetween size={'xxs'}>
                    <p>Are you sure you want to rollback to version {modal.prevConfig.versionId}?</p>
                    <FormField
                        label='Change reason'
                    >
                        <Input
                            value={modal.newConfig.changeReason}
                            onChange={(event) => {
                                if (event.detail.value) {
                                    setModal({...modal, newConfig: {...modal.newConfig, changeReason: event.detail.value}});
                                }
                            }}
                        />
                    </FormField>

                </SpaceBetween>
                
            </Modal>
        </>
        
    );
}