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
import React, { RefObject, useRef, useState } from 'react';
import { IDataset } from '../../shared/model/dataset.model';
import {
    getDatasetsList,
    getFileEntities,
    deleteDatasetFromProject,
    deleteFileFromDataset,
    updateFileList,
    updateEntity,
} from '../../entities/dataset/dataset.reducer';
import { Action, Dispatch, ThunkDispatch } from '@reduxjs/toolkit';
import { Button, ButtonDropdown, Icon, SpaceBetween } from '@cloudscape-design/components';
import { useAppDispatch, useAppSelector } from '../../config/store';
import { mapFilesToDatasetFiles, deleteButtonAriaLabel } from './dataset.utils';
import { IDatasetFile } from '../../shared/model/datasetfile.model';
import Condition from '../../modules/condition';
import { buildS3Keys, uploadFiles } from './dataset.service';
import { useAuth } from 'react-oidc-context';
import NotificationService from '../../shared/layout/notification/notification.service';
import { setDeleteModal } from '../../modules/modal/modal.reducer';
import { setTableAnnouncement } from '../../shared/util/table-utils';
import { deletionDescription } from '../../shared/util/form-utils';
import { selectCurrentUser } from '../user/user.reducer';
import { hasPermission } from '../../shared/util/permission-utils';
import { Permission } from '../../shared/model/user.model';

function DatasetActions (props?: any) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const nav = (endpoint: string) => navigate(endpoint);
    const createDatasetRef = props?.focusProps?.createDatasetRef;
    const { projectName } = useParams();

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <Button
                onClick={() => dispatch(getDatasetsList(projectName))}
                ariaLabel={'Refresh dataset list'}
            >
                <Icon name='refresh' />
            </Button>
            {DatasetActionButton(nav, dispatch, props)}
            {DatasetCreateButton(projectName, createDatasetRef)}
        </SpaceBetween>
    );
}

function DatasetFileActions (props: any) {
    const dispatch = useAppDispatch();
    const notificationService = NotificationService(dispatch);
    const dataset: IDataset = useAppSelector((state) => state.dataset.dataset);
    const { projectName } = useParams();
    const [chooseFileLoading, setChooseFileLoading] = useState(false);
    const auth = useAuth();
    const username = auth.user!.profile.preferred_username;
    const uploadFile: RefObject<HTMLInputElement> = useRef(null);
    const datasetFileList = props.allItems;
    const setFilesOverride = props.setItemsOverride;
    const uploadFileRef = props?.focusFileUploadProps?.focusFileUploadProps;

    const handleUploadFile = () => {
        if (uploadFile.current) {
            uploadFile.current.click();
        }
    };

    const handleFileChange = async (e: any) => {
        setChooseFileLoading(true);
        if (e.target.files) {
            const filesToUpload: File[] = Array.from(e.target.files);
            const mappedFilesToUpload = filesToUpload.map((file: File) =>
                mapFilesToDatasetFiles(file)
            );
            setTableAnnouncement('Selected files added to table');
            if (!setFilesOverride) {
                const s3Keys = buildS3Keys(mappedFilesToUpload, dataset, projectName, username!);
                await uploadFiles(s3Keys, dataset, notificationService, mappedFilesToUpload);
                dispatch(getFileEntities(dataset));
            } else {
                setFilesOverride([
                    ...datasetFileList.concat(
                        filesToUpload.map((file: File) => mapFilesToDatasetFiles(file))
                    ),
                ]);
            }
        }
        setChooseFileLoading(false);
    };

    const removeFileFromFilesToUpload = () => {
        if (datasetFileList.length === 0) {
            return;
        }
        const filesToRemove = props?.selectedItems;
        const currentFiles = [...datasetFileList];
        const fileListFiltered: IDatasetFile[] = currentFiles.filter((element) => {
            return !filesToRemove.some((innerElement: any) => {
                return innerElement.key === element.key;
            });
        });
        if (!setFilesOverride) {
            dispatch(updateFileList(fileListFiltered));
        } else {
            setFilesOverride(fileListFiltered);
        }
        setTableAnnouncement('Selected files removed from table');
    };

    const ManageFilesButtons = () => (
        <div>
            <Button
                disabled={props.selectedItems.length === 0}
                onClick={(e) => {
                    e.preventDefault();
                    window.location.href.endsWith('/create')
                        ? removeFileFromFilesToUpload()
                        : DatasetDeleteFileActionHandler(dispatch, dataset, props);
                }}
                ariaLabel={deleteButtonAriaLabel}
            >
                Delete
            </Button>
            <Button
                data-cy='dataset-file-upload-button'
                iconName='upload'
                ref={uploadFileRef}
                variant='normal'
                formAction='none'
                onClick={handleUploadFile}
                loading={chooseFileLoading}
            >
                Upload file
            </Button>
            <input
                data-cy='dataset-file-upload-input'
                type='file'
                ref={uploadFile}
                style={{ display: 'none' }}
                onChange={(e: any) => {
                    handleFileChange(e);
                }}
                onBlur={() => {
                    //This remains empty to regain keyboard focus
                    //to the button after user closes the input window
                    //for accessibility purposes
                }}
                multiple
            />
        </div>
    );

    return (
        <SpaceBetween direction='horizontal' size='xs'>
            <Condition condition={!setFilesOverride}>
                <Button
                    onClick={() => dispatch(getFileEntities(dataset))}
                    ariaLabel={'Refresh dataset list'}
                >
                    <Icon name='refresh' />
                </Button>
            </Condition>
            {window.location.href.endsWith('/edit') || window.location.href.endsWith('/create') ? (
                <ManageFilesButtons />
            ) : null}
        </SpaceBetween>
    );
}

async function DatasetDeleteFileActionHandler (
    dispatch: ThunkDispatch<any, any, Action>,
    dataset: IDataset,
    props?: any
) {
    const parsedKeys = props?.selectedItems.map((value: any) => value['key'].split('/').slice(-1));
    const selectedFiles = parsedKeys.join(', ');
    const newFileList = parsedKeys.map((f: any) => encodeURIComponent(f));

    dispatch(
        setDeleteModal({
            resourceName: selectedFiles,
            resourceType: 'dataset file(s)',
            onConfirm: async () =>
                await dispatch(
                    deleteFileFromDataset({
                        scope: dataset.scope,
                        datasetName: dataset.name,
                        files: newFileList,
                    })
                ),
            postConfirm: () => dispatch(getFileEntities(dataset)),
            description: deletionDescription('Dataset file(s)'),
        })
    );
}

function IsAdminOrDatasetOwner (dataset: IDataset): boolean {
    const currentUser = useAppSelector(selectCurrentUser);
    return (
        hasPermission(Permission.ADMIN, currentUser.permissions) ||
        dataset?.createdBy === currentUser.username
    );
}

function DatasetActionButton (nav: (endpoint: string) => void, dispatch: Dispatch, props?: any) {
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

export { DatasetActions, DatasetFileActions };
