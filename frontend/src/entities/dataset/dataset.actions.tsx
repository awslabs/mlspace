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

import { useNavigate, useParams } from 'react-router-dom';
import React, { RefObject, useEffect, useRef, useState } from 'react';
import { IDataset } from '../../shared/model/dataset.model';
import {
    getDatasetsList,
    deleteDatasetFromProject,
    updateEntity,
    deleteFileFromDataset,
} from '../../entities/dataset/dataset.reducer';
import { Action, ThunkDispatch } from '@reduxjs/toolkit';
import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { copyButtonAriaLabel, deleteButtonAriaLabel, downloadButtonAriaLabel } from './dataset.utils';
import Condition from '../../modules/condition';
import { determineScope, getDownloadUrl, uploadResources } from './dataset.service';
import NotificationService from '../../shared/layout/notification/notification.service';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { deletionDescription } from '../../shared/util/form-utils';
import { selectCurrentUser } from '../user/user.reducer';
import { hasPermission } from '../../shared/util/permission-utils';
import { Permission } from '../../shared/model/user.model';
import { DatasetActionType, DatasetBrowserAction, DatasetBrowserState, DatasetResourceObject } from '../../modules/dataset/dataset-browser.reducer';
import { DatasetBrowserManageMode, UpdateDatasetContextFunction } from '../../modules/dataset/dataset-browser.types';
import { useUsername } from '../../shared/util/auth-utils';
import { prefixForPath, stripDatasetPrefix } from '../../modules/dataset/dataset-browser.utils';
import { Dispatch as ReduxDispatch } from '@reduxjs/toolkit';
import { Dispatch as ReactDispatch } from 'react';
import { DatasetContext } from '../../shared/util/dataset-utils';
import './dataset.css';

function DatasetActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const nav = (endpoint: string) => navigate(endpoint);
    const createDatasetRef = props?.focusProps?.createDatasetRef;
    const { projectName } = useParams();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            {DatasetActionButton(nav, dispatch, props)}
            {DatasetCreateButton(projectName, createDatasetRef)}
        </SpaceBetween>
    );
}

type UploadButtonProperties = {
    isFileUpload: boolean;
    children: string;
    state: Pick<DatasetBrowserState, 'selectedItems' | 'items' | 'datasetContext' | 'manageMode' | 'filteringText'>;
    setState: ReduxDispatch<DatasetBrowserAction> | ReactDispatch<DatasetBrowserAction>;
    updateDatasetContext: UpdateDatasetContextFunction;
};

const UploadButton = ({state, setState, updateDatasetContext, isFileUpload, children}: UploadButtonProperties): React.ReactNode => {
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const {manageMode} = state;
    const uploadFile: RefObject<HTMLInputElement> = useRef(null);
    const [disableUpload, setDisableUpload] = useState(false);

    function handleDrop (event) {
        // Prevent default behavior (Prevent file from being opened)
        event.preventDefault();
        document.getElementsByClassName('dropzone')[0].classList.add('display-none');
        console.log('drop');
        console.log(event);
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

    function dragWindowEnterHandler () {
        document.getElementsByClassName('dropzone')[0].classList.remove('display-none');
    }

    useEffect(() => {
        document.addEventListener('dragenter', dragWindowEnterHandler);

        return () => {
            document.removeEventListener('dragenter', dragWindowEnterHandler);
        };
    }, []);
    
    

    async function fileHandler (event) {
        const filesToUpload = Array.from(event.target?.files || event.dataTransfer?.files || []).map((file: File): DatasetResourceObject => ({
            bucket: '',
            type: 'object',
            key: `${state.datasetContext?.location || ''}${isFileUpload ? file.webkitRelativePath : file.name}`,
            size: file.size,
            file,
            name: isFileUpload ? file.webkitRelativePath : file.name,
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

    return <>
        <div className='dropzone display-none' onDrop={handleDrop} onDragOver={dragOverHandler} onDragEnter={dragEnterHandler} onDragLeave={dragLeaveHandler}/>
        <Button
            data-cy={`dataset-upload-button-${children}`}
            iconName='upload'
            variant='normal'
            formAction='none'
            onClick={() => uploadFile?.current?.click()}
            loading={disableUpload}
        >
            {children}
        </Button>
        <input
            data-cy={`dataset-file-upload-input-${children}`}
            type='file'
            {...(isFileUpload ? {directory: '', webkitdirectory: ''} : {})}
            ref={uploadFile}
            style={{ display: 'none' }}
            onChange={fileHandler}
            onBlur={() => {
                //This remains empty to regain keyboard focus
                //to the button after user closes the input window
                //for accessibility purposes
            }}
            multiple
        />
    </>;
};

export const DatasetBrowserActions = (state: Pick<DatasetBrowserState, 'selectedItems' | 'items' | 'datasetContext' | 'manageMode' | 'filteringText'>, setState: ReduxDispatch<DatasetBrowserAction> | ReactDispatch<DatasetBrowserAction>, updateDatasetContext: UpdateDatasetContextFunction): React.ReactNode => {
    const dispatch = useAppDispatch();
    const username = useUsername();
    const { projectName } = useParams();
    const {selectedItems, manageMode} = state;
    const showDeleteButton = manageMode ? [DatasetBrowserManageMode.Create, DatasetBrowserManageMode.Edit].includes(manageMode) : false;
    const showUploadButton = manageMode ? [DatasetBrowserManageMode.Create, DatasetBrowserManageMode.Edit].includes(manageMode) : false;

    return (
        <SpaceBetween size='xs' direction='horizontal'>
            <Condition condition={manageMode !== DatasetBrowserManageMode.Create}>
                <Button
                    iconName='download'
                    disabled={selectedItems.length !== 1 || selectedItems[0].type !== 'object'}
                    onClick={async () => {
                        const item = selectedItems[0];
                        if (item.type === 'object') {
                            const downloadUrl = await getDownloadUrl(item.key);
                            window.open(downloadUrl, '_blank');
                        }
                    }}
                    ariaLabel={downloadButtonAriaLabel}>
                    Download
                </Button>
            </Condition>

            <Condition condition={manageMode !== DatasetBrowserManageMode.Create}>
                <Button
                    iconName='copy'
                    disabled={selectedItems.length !== 1}
                    onClick={async () => {
                        const item = selectedItems[0];
                        switch (item.type) {
                            case 'object':
                                navigator.clipboard.writeText(`s3://${item.bucket}/${item.key}`);
                                break;
                            case 'prefix':
                                navigator.clipboard.writeText(`s3://${item.bucket}/${item.prefix}`);
                                break;
                        }
                    }}
                    ariaLabel={copyButtonAriaLabel}>
                    Copy S3 URI
                </Button>
            </Condition>

            <Condition condition={showDeleteButton}>
                <Button
                    iconName='delete-marker'
                    disabled={selectedItems.length === 0 || !!state.selectedItems.find((resource) => resource.type === 'prefix')}
                    onClick={(e) => {
                        e.preventDefault();
                        
                        switch (manageMode) {
                            case DatasetBrowserManageMode.Create:
                                setState({
                                    type: DatasetActionType.State,
                                    payload: {
                                        items: state.items.filter((item) => !selectedItems.includes(item)),
                                        selectedItems: []
                                    }
                                });
                                break;
                            default:
                                dispatch(
                                    setDeleteModal({
                                        resourceName: state.selectedItems.length === 1 ? (state.selectedItems[0].name || '1 file') : `${state.selectedItems.length} file(s)`,
                                        resourceType: 'dataset file(s)',
                                        onConfirm: async () => {
                                            const scope = determineScope(state.datasetContext?.type, projectName!, username);
                                            const selectedItems = state.selectedItems?.filter((item): item is DatasetResourceObject => item.type === 'object')
                                                .map((item) => {
                                                    return stripDatasetPrefix(item.key);
                                                })
                                                .filter((item) => item);

                                            return await dispatch(
                                                deleteFileFromDataset({
                                                    scope,
                                                    datasetName: state.datasetContext?.name,
                                                    files: selectedItems,
                                                })
                                            );
                                        },
                                        postConfirm: () => {
                                            const effectiveContext = {...state.datasetContext, location: [state.datasetContext?.location, prefixForPath(state.filteringText)].join('')};
                                            updateDatasetContext(effectiveContext, '', false);
                                        },
                                        description: deletionDescription('Dataset file(s)'),
                                    })
                                );
                                break;
                        }
                    }}
                    ariaLabel={deleteButtonAriaLabel}>
                    Delete
                </Button>
            </Condition>

            <Condition condition={showUploadButton}>
                <SpaceBetween size='xs' direction='horizontal'>
                    {/* <UploadButton state={state} setState={setState} updateDatasetContext={updateDatasetContext} isFileUpload={false}>
                        Upload Files
                    </UploadButton> */}
                    <UploadButton state={state} setState={setState} updateDatasetContext={updateDatasetContext} isFileUpload={true}>
                        Upload Folder
                    </UploadButton>
                </SpaceBetween>
            </Condition>
        </SpaceBetween>
    );
};

function IsAdminOrDatasetOwner (dataset: IDataset): boolean {
    const currentUser = useAppSelector(selectCurrentUser);
    return (
        hasPermission(Permission.ADMIN, currentUser.permissions) ||
        dataset?.createdBy === currentUser.username
    );
}

function DatasetActionButton (nav: (endpoint: string) => void, dispatch: ReduxDispatch, props?: any) {
    const selectedDataset = props?.selectedItems[0];
    const { projectName } = useParams();

    return (
        <ButtonDropdown
            data-cy='dataset-actions-dropdown'
            items={[
                { text: 'Details', id: 'details' },
                { text: 'Edit', id: 'edit' },
                { text: 'Delete', id: 'delete', disabled: !IsAdminOrDatasetOwner(selectedDataset) },
            ]}
            variant='primary'
            disabled={selectedDataset === undefined}
            onItemClick={(e) =>
                DatasetActionHandler(e, selectedDataset, nav, dispatch, projectName)
            }
        >
            Actions
        </ButtonDropdown>
    );
}

function DatasetCreateButton (projectName?: string, createDatasetRef?: RefObject<HTMLInputElement>) {
    const navigate = useNavigate();
    const basePath = projectName ? `/project/${projectName}` : '/personal';
    return (
        <Button
            variant='primary'
            ref={createDatasetRef}
            onClick={() => navigate(`${basePath}/dataset/create`)}
        >
            Create dataset
        </Button>
    );
}

const DatasetActionHandler = (
    e: any,
    dataset: IDataset,
    nav: (endpoint: string) => void,
    dispatch: ThunkDispatch<any, any, Action>,
    projectName?: string
) => {
    const basePath = projectName ? `/project/${projectName}` : '/personal';

    switch (e.detail.id) {
        case 'open':
            nav(`${basePath}/dataset/${dataset.scope}/${dataset.name}`);
            break;
        case 'delete':
            dispatch(
                setDeleteModal({
                    resourceName: dataset.name!,
                    resourceType: 'dataset',
                    onConfirm: async () => await dispatch(deleteDatasetFromProject(dataset)),
                    postConfirm: () => dispatch(getDatasetsList(projectName)),
                    description: deletionDescription('Dataset'),
                })
            );
            break;
        case 'edit':
            dispatch(updateEntity(dataset));
            nav(`${basePath}/dataset/${dataset.scope}/${dataset.name}/edit`);
            break;
        case 'details':
            dispatch(updateEntity(dataset));
            nav(`${basePath}/dataset/${dataset.scope}/${dataset.name}`);
            break;
    }
};

export { DatasetActions };
