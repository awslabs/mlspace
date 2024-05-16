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
import { useEffect } from 'react';
import { DatasetActionType, DatasetResourceObject } from '../../modules/dataset/dataset-browser.reducer';
import { useAppDispatch } from '../../config/store';
import NotificationService from '../../shared/layout/notification/notification.service';
import { DatasetBrowserManageMode } from '../../modules/dataset/dataset-browser.types';
import { prefixForPath } from '../../modules/dataset/dataset-browser.utils';
import { uploadResources } from './dataset.service';
import { DatasetContext } from '../../shared/util/dataset-utils';

export const FullScreenDragAndDrop = ({state, setState, updateDatasetContext, setDisableUpload}): React.ReactNode => {
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const {manageMode} = state;

    function handleDrop (event) {
        // Prevent default behavior (Prevent file from being opened)
        event.preventDefault();
        document.getElementsByClassName('dropzone')[0].classList.add('display-none');
        fileHandler(event);
    }

    function dragEnterHandler (event) {
        document.getElementsByClassName('dropzone')[0].classList.add('drag-over');
        if (event.target.classList.contains('dropzone')) {
            event.target.classList.add('drag-over');
        }
    }

    function dragOverHandler (event) {
        // Prevent default behavior (Prevent file from being opened)
        event.preventDefault();
    }

    function dragLeaveHandler () {
        document.getElementsByClassName('dropzone')[0].classList.remove('drag-over');
        document.getElementsByClassName('dropzone')[0].classList.add('display-none');
    }

    function dragWindowEnterHandler (event) {
        if (event.dataTransfer.types && (event.dataTransfer.types.indexOf ? event.dataTransfer.types.indexOf('Files') !== -1 : event.dataTransfer.types.contains('Files'))) {
            document.getElementsByClassName('dropzone')[0].classList.remove('display-none');
        }
    }

    useEffect(() => {
        document.addEventListener('dragenter', dragWindowEnterHandler);

        return () => {
            document.removeEventListener('dragenter', dragWindowEnterHandler);
        };
    }, []);
    
    /**
     * Asynchronously retrieves the files from the provided DataTransfer object.
     * It handles both individual files and directories, reading the
     * content of directories and returning all the files in the directory hierarchy.
     *
     * @param dataTransfer - The DataTransfer object containing the dragged files.
     * @returns A Promise that resolves to an array of File objects.
     */
    async function getFilesAsync (dataTransfer: DataTransfer) {
        const files: File[] = [];
        for (let i = 0; i < dataTransfer.items.length; i++) {
            const item = dataTransfer.items[i];
            if (item.kind === 'file') {
                if (typeof item.webkitGetAsEntry === 'function') {
                    const entry = item.webkitGetAsEntry();
                    const entryContent = await readEntryContentAsync(entry);
                    files.push(...entryContent);
                    continue;
                }
    
                const file = item.getAsFile();
                if (file) {
                    files.push(file);
                }
            }
        }
        return files;
    }

    // Returns a promise with all the files of the directory hierarchy
    function readEntryContentAsync (entry: FileSystemEntry) {
        return new Promise<File[]>((resolve) => {
            let reading = 0;
            const contents: File[] = [];

            readEntry(entry);

            function readEntry (entry: FileSystemEntry) {
                if (isFile(entry)) {
                    reading++;
                    entry.file((file) => {
                        reading--;
                        contents.push(file);

                        if (reading === 0) {
                            resolve(contents);
                        }
                    });
                } else if (isDirectory(entry)) {
                    readReaderContent(entry.createReader());
                }
            }

            function readReaderContent (reader: FileSystemDirectoryReader) {
                reading++;

                reader.readEntries(function (entries) {
                    reading--;
                    for (const entry of entries) {
                        readEntry(entry);
                    }

                    if (reading === 0) {
                        resolve(contents);
                    }
                });
            }
        });
    }

    // Helps with explicit typing
    function isDirectory (entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
        return entry.isDirectory;
    }

    // Helps with explicit typing
    function isFile (entry: FileSystemEntry): entry is FileSystemFileEntry {
        return entry.isFile;
    }

    async function fileHandler (event) {
        const arrayOfFiles = await getFilesAsync(event.dataTransfer);
        const filesToUpload = arrayOfFiles.map((file: File): DatasetResourceObject => ({
            bucket: '',
            type: 'object',
            key: `${state.datasetContext?.location || ''}${file.webkitRelativePath ? file.webkitRelativePath : file.name}`,
            size: file.size,
            file,
            name: `${file.webkitRelativePath ? file.webkitRelativePath : file.name}`,
        }));
        switch (manageMode) {
            case DatasetBrowserManageMode.Create:
                setState({
                    type: DatasetActionType.State,
                    payload: {
                        items: [...state.items, ...filesToUpload]
                    }
                });
                break;
            case DatasetBrowserManageMode.Edit:
                if (state.datasetContext) {
                    const filteringTextPrefix = prefixForPath(state.filteringText);
                    if (filteringTextPrefix) {
                        filesToUpload.forEach((file) => {
                            file.key = [filteringTextPrefix, file.key].join('');
                        });
                    }
                    
                    setDisableUpload(true);
                    // ensure cast to DatasetContext is valid
                    if (state.datasetContext.name && state.datasetContext.type) {
                        await uploadResources(state.datasetContext as DatasetContext, filesToUpload, notificationService);
                    }
                    setDisableUpload(false);

                    // if the filter contains a prefix append that to the Location
                    const effectiveContext = {...state.datasetContext, location: [state.datasetContext.location, filteringTextPrefix].join('')};
                    updateDatasetContext(effectiveContext, '', false);
                }
                break;
        }
    }

    return (
        <>
            <div className='dropzone display-none' onDrop={handleDrop} onDragOver={dragOverHandler} onDragEnter={dragEnterHandler} onDragLeave={dragLeaveHandler}/>
        </>
    );
};