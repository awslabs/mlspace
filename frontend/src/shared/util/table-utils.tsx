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

import React, { useEffect, useState } from 'react';
import {
    Link,
    StatusIndicator,
    StatusIndicatorProps,
    Popover,
    PaginationProps,
    Pagination,
    TableProps,
} from '@cloudscape-design/components';
import { JobStatus } from '../../entities/jobs/job.model';
import { ConditionalWrapper } from '../../modules/condition/condition';
import { EMRStatusState } from '../../entities/emr/emr.model';
import { useAppDispatch } from '../../config/store';
import { ActionCreatorWithoutPayload, AsyncThunk } from '@reduxjs/toolkit';
import { useParams } from 'react-router-dom';
import { ILogRequestParams } from '../model/log.model';
import { TranslateJobStatus } from '../model/translate.model';
import _ from 'lodash';
import { useBackgroundRefresh } from './hooks';

export const linkify = (
    resource: string,
    id: string,
    prefix?: string,
    displayText?: string,
    cypressTag = `${resource}-${id}`
) => {
    const location = window.location.href;
    const splits = location.split('#');
    let href = '#' + splits[1] + '/';

    if (!href.includes(resource!)) {
        const spliceHref = href.split('/');
        let newHref = '';
        spliceHref.slice(0, 3).map((i) => (newHref += i + '/'));
        newHref += resource + '/';
        href = newHref;
    }
    if (prefix) {
        href += prefix + '/';
    }
    href += id;

    return (
        <Link variant='primary' fontSize='body-m' href={href} data-cy={cypressTag}>
            {displayText ? displayText : id}
        </Link>
    );
};

export const createColumnAriaLabel = (column: TableProps.ColumnDefinition<any>) => {
    return ({ sorted, descending }: any) => {
        return `${column.header}, ${
            sorted ? `sorted ${descending ? 'descending' : 'ascending'}` : 'not sorted'
        }.`;
    };
};

export const getMatchesCountText = (count: number): string => {
    return count === 1 ? '1 match' : `${count} matches`;
};

export const sortStringValue = (key: string) => {
    return (a: any, b: any): number => {
        const left = _.get(a, key);
        const right = _.get(b, key);
        if (left < right) {
            return -1;
        }
        if (left > right) {
            return 1;
        }
        return 0;
    };
};

export const prettyStatus = (
    status?: string,
    failureReason?: string,
    inTable = false
): JSX.Element => {
    if (!status) {
        return <span>-</span>;
    }
    const indicatorType: StatusIndicatorProps.Type = getIndicatorType(status);
    const embeddedWrapper = (condition: boolean, children: any) => {
        if (condition) {
            return (
                <Popover
                    dismissButton={true}
                    position='bottom'
                    size='small'
                    fixedWidth
                    triggerType='custom'
                    content={
                        <p>
                            {failureReason ? (
                                truncateStatusMessage(failureReason)
                            ) : (
                                <StatusIndicator type={indicatorType}>{status}</StatusIndicator>
                            )}
                        </p>
                    }
                >
                    <span style={{ cursor: failureReason ? 'pointer' : 'default' }}>
                        {children}
                    </span>
                </Popover>
            );
        }
        return children;
    };
    return (
        <ConditionalWrapper condition={!!failureReason && inTable} wrapper={embeddedWrapper}>
            <StatusIndicator type={indicatorType}>{status}</StatusIndicator>
        </ConditionalWrapper>
    );
};

export const getIndicatorType = (status?: string) => {
    let indicatorType: StatusIndicatorProps.Type = 'pending';
    switch (status) {
        case 'InService':
        case EMRStatusState.RUNNING:
        case EMRStatusState.WAITING:
        case TranslateJobStatus.Completed:
        case JobStatus.Completed:
            indicatorType = 'success';
            break;
        case EMRStatusState.TERMINATED_WITH_ERRORS:
        case TranslateJobStatus.CompletedWithError:
        case TranslateJobStatus.Failed:
        case JobStatus.Failed:
            indicatorType = 'error';
            break;
        case 'OutOfService':
            indicatorType = 'info';
            break;
        case 'Creating':
        case 'RollingBack':
        case 'SystemUpdating':
        case 'Updating':
        case 'Deleting':
        case EMRStatusState.BOOTSTRAPPING:
        case EMRStatusState.STARTING:
        case EMRStatusState.TERMINATING:
        case TranslateJobStatus.InProgress:
        case TranslateJobStatus.Submitted:
        case TranslateJobStatus.StopRequested:
        case JobStatus.InProgress:
        case JobStatus.Stopping:
            indicatorType = 'in-progress';
            break;
        case EMRStatusState.TERMINATED:
        case TranslateJobStatus.Stopped:
        case JobStatus.Stopped:
            indicatorType = 'stopped';
            break;
    }

    return indicatorType;
};

export const truncateStatusMessage = (status: string) => {
    return status.substring(0, Math.min(100, status.length)) + (status.length > 100 ? '...' : '');
};

export type PaginationLoadingState = {
    /**
     * Whether resources are being clean state without pagination.
     */
    loadingEmpty: boolean;

    /**
     * Whether additional resources are being loaded with a pagination token.
     */
    loadingAdditional: boolean;

    /**
     * Whether additional resources are being loaded in the background.
     */
    loadingInBackground: boolean;
};

export enum TableSortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
}

export type PagedResponsePayload<T> = {
    records: T[];
    nextToken?: string;
};

export type ServerRequestProps = {
    projectName?: string;
    sortOrder?: TableSortOrder;
    sortBy?: string;
    pageSize?: number;
    nextToken?: string;
    logRequestParameters?: ILogRequestParams;
    resourceStatus?: string;
};

export type ServerSidePaginatorProps<T extends ServerRequestProps> = {
    paginationProps: PaginationProps;
    loading: PaginationLoadingState;
    requestProps?: T;
    setLoading: React.Dispatch<React.SetStateAction<PaginationLoadingState>>;
    fetchDataThunk: AsyncThunk<any, T, any>;
    ariaLabels: PaginationProps.Labels;
    storeClear: ActionCreatorWithoutPayload;
};

export const ServerSidePaginator = <T extends ServerRequestProps>(props: ServerSidePaginatorProps<T>): JSX.Element => {
    const dispatch = useAppDispatch();
    const { projectName } = useParams();
    const [disabled, setDisabled] = useState<boolean>();
    const [nextToken, setNextToken] = useState<string | undefined>();

    const loading = props.loading;
    const setLoading = props.setLoading;

    const fetchData = async (usePagination: boolean, callback?: () => void) => {
        // Disable pagination user input until loading completes
        setDisabled(true);

        const params = {
            nextToken: usePagination ? nextToken : undefined,
            projectName,
            ...props.requestProps,
        } as T;

        const result = await dispatch(props.fetchDataThunk(params));
        setLoading({ ...loading, loadingAdditional: false, loadingEmpty: false });
        // Store the latest pagination token from the API response
        if (result.payload) {
            setNextToken(result.payload.data.nextToken);
        }
        callback?.();
        setDisabled(false);
    };

    useEffect(() => {
        if (loading.loadingEmpty) {
            // Clear the item store and load without pagination when the user refreshes the table
            dispatch(props.storeClear());
            fetchData(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading.loadingEmpty]);

    // Refresh data in the background to keep state fresh
    const isBackgroundRefreshing = useBackgroundRefresh(async () => {
        await fetchData(false);
        setLoading({ loadingAdditional: false, loadingEmpty: false, loadingInBackground: true });
    }, [fetchData, setLoading]);
    
    useEffect(() => {
        setLoading({ ...loading, loadingInBackground: isBackgroundRefreshing });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isBackgroundRefreshing]);

    useEffect(() => {
        setLoading({ ...loading, loadingEmpty: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    const hasAdditionalRecords = nextToken !== undefined;

    return (
        <Pagination
            onChange={(event) => {
                if (
                    hasAdditionalRecords &&
                    event.detail.currentPageIndex > props.paginationProps.pagesCount
                ) {
                    setLoading({ ...loading, loadingAdditional: true });
                    fetchData(true, () => {
                        props.paginationProps.onChange?.(event);
                    });
                } else {
                    props.paginationProps.onChange?.(event);
                }
            }}
            openEnd={hasAdditionalRecords}
            disabled={disabled}
            pagesCount={props.paginationProps.pagesCount}
            currentPageIndex={props.paginationProps.currentPageIndex}
            ariaLabels={props.ariaLabels}
        />
    );
};

export const setTableAnnouncement = (announcement: string) => {
    const announcementDiv: HTMLElement = document.getElementById('tableAnnouncementDiv')!;
    // Add timestamp to announcement so that it is always announced, even with identical consecutive messages
    announcementDiv.innerHTML = '';
    announcementDiv.innerHTML = `<span data-timestamp="${Date.now()}">${announcement}</span>`;
};
