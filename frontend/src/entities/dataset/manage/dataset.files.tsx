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
