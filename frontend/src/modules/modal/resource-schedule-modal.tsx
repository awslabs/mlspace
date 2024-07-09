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
    Modal as CloudscapeModal,
    Box,
    SpaceBetween,
    Button,
    FormField,
    Grid,
    DatePicker,
    TimeInput,
} from '@cloudscape-design/components';
import { PayloadAction } from '@reduxjs/toolkit';
import { AxiosResponse } from 'axios';
import React, { useState } from 'react';
import { useAppDispatch } from '../../config/store';
import { dismissModal } from './modal.reducer';
import { formatTerminationTimestamp, timezoneDisplayString } from '../../shared/util/date-utils';
import { CallbackFunction } from '../../types';
import { initCap } from '../../shared/util/enum-utils';
import { getTerminationHourDate } from '../../shared/util/resource-schedule.service';
import { Timezone } from '../../shared/model/user.model';
import { useNotificationService } from '../../shared/util/hooks';

export const editScheduleButtonAriaLabel = 'Edit resource auto-termination schedule';

export type ResourceScheduleModalProps = {
    resourceName: string;
    resourceTerminationTime?: number;
    resourceType: 'EMR Cluster' | 'SageMaker Endpoint' | 'SageMaker Notebook';
    onConfirm: (
        terminationTime?: Date
    ) => Promise<PayloadAction<any, string>> | Promise<AxiosResponse<any, any>>;
    postConfirm?: CallbackFunction;
    timezone?: Timezone;
};

function focusEditButton () {
    const editResourceButton = document.querySelector(
        `[aria-label='${editScheduleButtonAriaLabel}']`
    );
    if (editResourceButton) {
        if (editResourceButton instanceof HTMLButtonElement) {
            editResourceButton.focus();
        }
    }
}

function ResourceScheduleModal ({
    resourceName,
    resourceTerminationTime,
    resourceType,
    onConfirm,
    postConfirm,
    timezone,
}: ResourceScheduleModalProps) {
    const [processing, setProcessing] = useState(false);
    const dispatch = useAppDispatch();
    const notificationService = useNotificationService(dispatch);
    const existingTerminationTimestamp =
        resourceTerminationTime && new Date(resourceTerminationTime * 1000);
    const responseHandler = (
        response: PayloadAction<any, string> | AxiosResponse<any, any> | undefined
    ) => {
        if (response) {
            let success = false;
            if ((response as PayloadAction).type !== undefined) {
                success = (response as PayloadAction).type.endsWith('/fulfilled');
            } else {
                success = (response as AxiosResponse).status === 200;
            }

            notificationService.generateNotification(
                `${
                    success ? 'Successfully modified' : 'Failed to modify'
                } auto-termination configuration for ${resourceName}.`,
                success ? 'success' : 'error'
            );
        }
    };

    const [terminationDate, setTerminationDate] = useState(
        existingTerminationTimestamp
            ? [
                existingTerminationTimestamp.getFullYear(),
                String(existingTerminationTimestamp.getMonth() + 1).padStart(2, '0'),
                String(existingTerminationTimestamp.getDate()).padStart(2, '0'),
            ].join('-')
            : ''
    );
    const [terminationTime, setTerminationTime] = useState(
        existingTerminationTimestamp
            ? existingTerminationTimestamp.toTimeString().substring(0, 5)
            : ''
    );
    const [errorText, setErrorText] = useState('');
    const isNotebook = resourceType === 'SageMaker Notebook';
    const terminateLabel = isNotebook ? 'stop' : 'terminate';
    const terminationLabel = isNotebook ? 'stop' : 'termination';

    return (
        <CloudscapeModal
            onDismiss={() => [dispatch(dismissModal()), focusEditButton()]}
            visible={true}
            closeAriaLabel='Close modal'
            footer={
                <Box float='right'>
                    <SpaceBetween direction='horizontal' size='xs'>
                        <Button onClick={() => [dispatch(dismissModal()), focusEditButton()]}>
                            Cancel
                        </Button>
                        <Button
                            data-cy='save-termination-update'
                            variant='primary'
                            onClick={async () => {
                                let updatedTerminationDate: Date | undefined;
                                if (terminationTime) {
                                    if (terminationDate && !isNotebook) {
                                        updatedTerminationDate = new Date(
                                            Number(terminationDate.split('-')[0]),
                                            Number(terminationDate.split('-')[1]) - 1,
                                            Number(terminationDate.split('-')[2])
                                        );
                                        const hour = Number(terminationTime.split(':')[0]);
                                        const min = Number(terminationTime.split(':')[1]);
                                        if (timezone === Timezone.UTC) {
                                            updatedTerminationDate.setUTCHours(hour);
                                            updatedTerminationDate.setUTCMinutes(min);
                                        } else {
                                            updatedTerminationDate.setHours(hour);
                                            updatedTerminationDate.setMinutes(min);
                                        }
                                    } else {
                                        // For notebooks, always check to see if the date should be set for tomorrow
                                        updatedTerminationDate = getTerminationHourDate(
                                            terminationTime,
                                            timezone
                                        );
                                    }

                                    if (!isNotebook && updatedTerminationDate < new Date()) {
                                        setErrorText('Termination time must be in the future.');
                                        return;
                                    }
                                }
                                setErrorText('');
                                setProcessing(true);

                                const response = await onConfirm(updatedTerminationDate);
                                responseHandler(response);
                                dispatch(dismissModal());
                                if (postConfirm) {
                                    postConfirm();
                                }
                            }}
                            loading={processing}
                        >
                            Update
                        </Button>
                    </SpaceBetween>
                </Box>
            }
            header={`Modify auto-${terminationLabel} schedule`}
        >
            <SpaceBetween size='m'>
                <div>
                    This {resourceType} is currently configured{' '}
                    {resourceTerminationTime
                        ? `to ${terminateLabel} at ${formatTerminationTimestamp(
                            resourceTerminationTime,
                            isNotebook
                        )}`
                        : `without a set ${terminationLabel} time`}
                    . You can set a new {terminationLabel} time or disable auto-{terminationLabel}{' '}
                    (by clearing the values) using the form below.
                </div>
                <FormField
                    stretch={true}
                    label={`${initCap(terminationLabel)} time`}
                    errorText={errorText}
                >
                    <Grid
                        gridDefinition={[
                            { colspan: isNotebook ? 12 : 6 },
                            { colspan: isNotebook ? 0 : 6 },
                        ]}
                    >
                        {!isNotebook && (
                            <FormField
                                stretch={true}
                                description={`Specify the date when the ${resourceType} should ${terminateLabel}.`}
                                constraintText='Use YYYY/MM/DD format.'
                            >
                                <DatePicker
                                    onChange={({ detail }) => setTerminationDate(detail.value)}
                                    value={terminationDate}
                                    openCalendarAriaLabel={(selectedDate) =>
                                        `Choose ${resourceType} ${terminationLabel} date` +
                                        (selectedDate ? `, selected date is ${selectedDate}` : '')
                                    }
                                    placeholder='YYYY/MM/DD'
                                />
                            </FormField>
                        )}
                        <FormField
                            stretch={true}
                            description={`Specify the time when the ${resourceType} should ${terminateLabel}`}
                            constraintText={`Use 24-hour format (${timezoneDisplayString(
                                timezone
                            )}).`}
                        >
                            <TimeInput
                                onChange={({ detail }) => setTerminationTime(detail.value)}
                                value={terminationTime}
                                format='hh:mm'
                                placeholder='hh:mm'
                                use24Hour={true}
                            />
                        </FormField>
                    </Grid>
                </FormField>
            </SpaceBetween>
        </CloudscapeModal>
    );
}

export default ResourceScheduleModal;
