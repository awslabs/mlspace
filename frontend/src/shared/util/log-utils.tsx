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

import React, { useState } from 'react';
import Table from '../../modules/table';
import { ILogMessage, ILogsComponentOptions } from '../../shared/model/log.model';
import {
    TableProps,
    Button,
    SpaceBetween,
    DateRangePicker,
    DateRangePickerProps,
    Select,
} from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { IEndpointConfig, IProductionVariant } from '../../shared/model/endpoint-config.model';
import {
    clearLogMessages,
    getLogMessages,
    loadingLogMessages,
    logMessages,
} from '../logs/logs.reducer';
import { ServerRequestProps } from './table-utils';
import { formatDate } from './date-utils';
import { selectCurrentUser } from '../../entities/user/user.reducer';
import { Timezone } from '../model/user.model';

export function LogsComponent (props: ILogsComponentOptions) {
    const dispatch = useAppDispatch();
    const logs: ILogMessage[] = useAppSelector(logMessages);
    const loadingLogs = useAppSelector(loadingLogMessages);
    const currentUser = useAppSelector(selectCurrentUser);

    // Get the user preference if it exists or default to local
    const timezonePreference = currentUser.preferences?.timezone || Timezone.LOCAL;
    const userPreference = timezonePreference === Timezone.LOCAL;

    // Default start time to 3 days ago but if we have a resource creation date
    // use that instead.
    let initialStartTime = getRelativeStartTime(3, 'day');
    let initialDateRangeValue;
    if (props.resourceCreationTime) {
        const createDate = new Date(props.resourceCreationTime);
        initialStartTime = createDate.getTime();
        initialDateRangeValue = {
            startDate: createDate.toISOString(),
            endDate: new Date(initialStartTime + 24 * 60 * 60 * 1000).toISOString(),
            type: 'absolute',
        };
    } else {
        initialDateRangeValue = {
            amount: 3,
            unit: 'day',
            type: 'relative',
        };
    }

    const [dateRangeValue, setDateRangeValue] = useState<any>(
        initialDateRangeValue as DateRangePickerProps.Value | null
    );
    const [startTimeFromDatePicker, setStartTimeFromDatePicker] = useState(initialStartTime);
    const [endTimeFromDatePicker, setEndTimeFromDatePicker] = useState(new Date().getTime());

    const endpointConfig: IEndpointConfig = useAppSelector(
        (state) => state.endpoint.endpointConfig
    );
    const [endpointVariant, setEndpointVariant] = useState<IProductionVariant>(
        endpointConfig.ProductionVariants![0] || null
    );

    function getLogRequestParams (
        startTime?: number,
        endTime?: number,
        variantName?: string
    ): ServerRequestProps {
        return {
            logRequestParameters: {
                endpointVariant: variantName || endpointVariant?.VariantName,
                startTime: startTime || startTimeFromDatePicker,
                // Only set end time if it's been explicitly set
                endTime:
                    endTime ||
                    (dateRangeValue?.type === 'absolute' ? endTimeFromDatePicker : undefined),
                ...props,
            },
        };
    }

    function LogActions () {
        return (
            <SpaceBetween direction='horizontal' size='xs'>
                <Button
                    disabled={logs.length === 0}
                    ariaLabel='Export logs to CSV'
                    onClick={() => {
                        const keys = 'EventId,Timestamp,Log stream name,Message\n';
                        const csvContent =
                            keys +
                            logs
                                .map((message: ILogMessage) => {
                                    return `${message.eventId},${message.timestamp},${message.logStreamName},${message.message}`;
                                })
                                .join('\n');
                        const exportFile = new Blob([csvContent], { type: 'text/csv' });

                        const tempLink = document.createElement('a');
                        tempLink.download = `${props.resourceName}-${new Date().toISOString()}.csv`;
                        tempLink.href = window.URL.createObjectURL(exportFile);
                        tempLink.style.display = 'none';
                        document.body.appendChild(tempLink);

                        tempLink.click();
                        document.body.removeChild(tempLink);
                    }}
                >
                    Export Logs to CSV
                </Button>
                {props.resourceType === 'Endpoints' ? (
                    <Select
                        selectedOption={{
                            label: endpointVariant?.VariantName,
                            value: endpointVariant?.VariantName,
                        }}
                        ariaLabel='Select production variant for logs'
                        disabled={endpointConfig.ProductionVariants?.length === 1}
                        onChange={async ({ detail }: any) => {
                            const variant = endpointConfig.ProductionVariants?.find(
                                (v) => v.VariantName === detail.selectedOption.value
                            );
                            if (variant) {
                                setEndpointVariant(variant);
                                await dispatch(clearLogMessages());
                                await dispatch(
                                    getLogMessages(
                                        getLogRequestParams(
                                            undefined,
                                            undefined,
                                            variant.VariantName
                                        )
                                    )
                                );
                            }
                        }}
                        options={(endpointConfig.ProductionVariants || []).map(
                            (variant: IProductionVariant) => ({
                                value: variant.VariantName,
                                label: variant.VariantName,
                            })
                        )}
                    />
                ) : null}
                <DateRangePicker
                    onChange={({ detail }: any) => {
                        setDateRangeValue(detail.value!);
                        let datePickerStartTime: number;
                        let datePickerEndTime: number | undefined;

                        if (detail.value!.type === 'absolute') {
                            datePickerStartTime = new Date(detail.value!.startDate).getTime();
                            datePickerEndTime = new Date(detail.value!.endDate).getTime();
                            setEndTimeFromDatePicker(datePickerEndTime);
                        } else {
                            datePickerStartTime = getRelativeStartTime(
                                detail.value!.amount,
                                detail.value!.unit
                            );
                            datePickerEndTime = undefined;
                        }

                        setStartTimeFromDatePicker(datePickerStartTime);
                        dispatch(clearLogMessages());
                        dispatch(
                            getLogMessages(
                                getLogRequestParams(datePickerStartTime, datePickerEndTime)
                            )
                        );
                    }}
                    value={dateRangeValue!}
                    relativeOptions={[
                        {
                            key: 'previous-5-minutes',
                            amount: 5,
                            unit: 'minute',
                            type: 'relative',
                        },
                        {
                            key: 'previous-30-minutes',
                            amount: 30,
                            unit: 'minute',
                            type: 'relative',
                        },
                        {
                            key: 'previous-1-hour',
                            amount: 1,
                            unit: 'hour',
                            type: 'relative',
                        },
                        {
                            key: 'previous-6-hours',
                            amount: 6,
                            unit: 'hour',
                            type: 'relative',
                        },
                    ]}
                    isValidRange={(range: any) => {
                        if (range!.type === 'absolute') {
                            const [startDateWithoutTime] = range!.startDate.split('T');
                            const [endDateWithoutTime] = range!.endDate.split('T');
                            if (!startDateWithoutTime || !endDateWithoutTime) {
                                return {
                                    valid: false,
                                    errorMessage:
                                        'The selected date range is incomplete. Select a start and end date for the date range.',
                                };
                            }
                            if (
                                new Date(range!.startDate).getTime() -
                                    new Date(range!.endDate).getTime() >
                                0
                            ) {
                                return {
                                    valid: false,
                                    errorMessage:
                                        'The selected date range is invalid. The start date must be before the end date.',
                                };
                            }
                        }
                        return { valid: true };
                    }}
                    getTimeOffset={
                        userPreference
                            ? undefined
                            : () => {
                                return 0;
                            }
                    }
                    i18nStrings={{
                        ariaLabel: 'Filter by date and time range',
                        todayAriaLabel: 'Today',
                        nextMonthAriaLabel: 'Next month',
                        previousMonthAriaLabel: 'Previous month',
                        customRelativeRangeDurationLabel: 'Duration',
                        customRelativeRangeDurationPlaceholder: 'Enter duration',
                        customRelativeRangeOptionLabel: 'Custom range',
                        customRelativeRangeOptionDescription: 'Set a custom range in the past',
                        customRelativeRangeUnitLabel: 'Unit of time',
                        formatRelativeRange: (e) => {
                            const n = 1 === e.amount ? e.unit : `${e.unit}s`;
                            return `Last ${e.amount} ${n}`;
                        },
                        formatUnit: (e, n) => (1 === n ? e : `${e}s`),
                        dateTimeConstraintText:
                            'For date, use YYYY/MM/DD. For time, use 24 hr format.',
                        relativeModeTitle: 'Relative range',
                        absoluteModeTitle: 'Absolute range',
                        relativeRangeSelectionHeading: 'Choose a range',
                        startDateLabel: 'Start date',
                        endDateLabel: 'End date',
                        startTimeLabel: 'Start time',
                        endTimeLabel: 'End time',
                        clearButtonLabel: 'Clear and dismiss',
                        cancelButtonLabel: 'Cancel',
                        applyButtonLabel: 'Apply',
                    }}
                    placeholder='Filter by a date and time range'
                    showClearButton={false}
                />
            </SpaceBetween>
        );
    }

    return (
        <Table
            tableName='Log'
            headerVariant='h2'
            trackBy='eventId'
            actions={LogActions}
            allItems={logs}
            columnDefinitions={logColumns}
            visibleColumns={visibleLogColumns}
            pageSize={100}
            stickyHeader={true}
            loadingItems={loadingLogs}
            serverFetch={getLogMessages}
            storeClear={clearLogMessages}
            serverRequestProps={getLogRequestParams()}
            loadingText='Loading logs'
            empty='No logs available.'
        />
    );
}

const logColumns: TableProps.ColumnDefinition<ILogMessage>[] = [
    {
        id: 'timestamp',
        header: 'Timestamp',
        sortingField: 'timestamp',
        cell: (item) => formatDate(new Date(item.timestamp!).toISOString()),
        sortingComparator: (item1, item2) => item1.timestamp! - item2.timestamp! - 1,
    },
    {
        id: 'logStreamName',
        header: 'Log stream name',
        sortingField: 'logStreamName',
        cell: (item) => item.logStreamName,
    },
    {
        id: 'message',
        header: 'Message',
        sortingField: 'message',
        cell: (item) => item.message,
    },
    {
        id: 'eventId',
        header: 'Event Id',
        sortingField: 'eventId',
        cell: (item) => item.eventId,
    },
];

const visibleLogColumns: string[] = ['timestamp', 'logStreamName', 'message'];

export function getRelativeStartTime (amount: number, unit: string): number {
    const currentTimestamp = new Date().getTime();
    switch (unit) {
        case 'second':
            return currentTimestamp - amount * 1000;
        case 'minute':
            return currentTimestamp - amount * 1000 * 60;
        case 'hour':
            return currentTimestamp - amount * 1000 * 60 * 60;
        case 'day':
            return currentTimestamp - amount * 1000 * 60 * 60 * 24;
        case 'week':
            return currentTimestamp - amount * 1000 * 60 * 60 * 24 * 7;
        case 'month':
            return currentTimestamp - amount * 1000 * 60 * 60 * 24 * 30;
        case 'year':
            return currentTimestamp - amount * 1000 * 60 * 60 * 24 * 365;
        default:
            return currentTimestamp;
    }
}
