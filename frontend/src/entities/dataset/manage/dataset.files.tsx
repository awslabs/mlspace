/*
 * Your use of this service is governed by the terms of the AWS Customer Agreement
 * (https://aws.amazon.com/agreement/) or other agreement with AWS governing your use of
 * AWS services. Each license to use the service, including any related source code component,
 * is valid for use associated with the related specific task-order contract as defined by
 * 10 U.S.C. 3401 and 41 U.S.C. 4101.
 *
 * Copyright 2023 Amazon.com, Inc. or its affiliates. All Rights Reserved. This is AWS Content
 * subject to the terms of the AWS Customer Agreement.
 */

import Table from '../../../modules/table/table';
import { useAppDispatch, useAppSelector } from '../../../config/store';
import { DatasetFileActions } from '../dataset.actions';
import {
    createDatasetVisibleColumns,
    defaultFileColumns,
    visibleFileColumns,
    visibleFileContentPreference,
} from '../dataset.columns';
import { IDatasetFile } from '../../../shared/model/datasetfile.model';
import { IDataset } from '../../../shared/model/dataset.model';
import { getFileEntities, loadingFiles } from '../dataset.reducer';
import React, { RefObject, useEffect, useRef, useState } from 'react';
import { CallbackFunction } from '../../../types';
import { Box } from '@cloudscape-design/components';

export type DatasetFileProps = {
    dataset: IDataset;
    filesOverride?: IDatasetFile[];
    setFilesOverride?: CallbackFunction;
    readOnly: boolean;
};

export function ManageFiles ({
    dataset,
    filesOverride,
    setFilesOverride,
    readOnly,
}: DatasetFileProps) {
    const datasetFiles = useAppSelector((state) => state.dataset.allFiles);
    const shouldFocusUploadButton = datasetFiles ? true : false;
    const fileList = filesOverride ? filesOverride : datasetFiles;
    const loadingDatasetFiles = useAppSelector(loadingFiles);
    const dispatch = useAppDispatch();
    const focusFileUploadProps: RefObject<HTMLInputElement> = useRef(null);
    const [displayedFiles, setDisplayedFiles] = useState([] as IDatasetFile[]);
    const isCreate = window.location.href.endsWith('dataset/create');
    const visibleColumns = isCreate ? createDatasetVisibleColumns : visibleFileColumns;
    useEffect(() => {
        if (!filesOverride) {
            dispatch(getFileEntities(dataset));
        }
        if (shouldFocusUploadButton) {
            focusFileUploadProps.current?.focus();
        }
    }, [dispatch, dataset, filesOverride, shouldFocusUploadButton]);

    useEffect(() => {
        if (fileList) {
            const bucket =
                dataset && dataset.location
                    ? dataset.location.replace('s3://', '').split('/')[0]
                    : undefined;
            setDisplayedFiles(
                fileList.map((file) => {
                    return { ...file, bucket };
                })
            );
        }
    }, [fileList, dataset]);

    return (
        <Table
            tableName='File'
            tableType={readOnly ? undefined : 'multi'}
            actions={DatasetFileActions}
            allItems={displayedFiles}
            setItemsOverride={setFilesOverride}
            columnDefinitions={defaultFileColumns}
            visibleColumns={visibleColumns}
            visibleContentPreference={visibleFileContentPreference}
            trackBy='key'
            variant='embedded'
            loadingItems={loadingDatasetFiles}
            focusFileUploadProps={{ focusFileUploadProps: focusFileUploadProps }}
            empty={
                isCreate ? (
                    <Box textAlign='center' color='inherit'>
                        <b>No files uploaded</b>
                    </Box>
                ) : undefined
            }
        />
    );
}

export default ManageFiles;
