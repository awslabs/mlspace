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

import { DatasetResourceObject } from '../../modules/dataset/dataset-browser.reducer';
import { DatasetType, IDataset } from '../../shared/model/dataset.model';
import axios from '../../shared/util/axios-utils';
import { default as Axios } from 'axios';
import { DatasetContext } from '../../shared/util/dataset-utils';
import { Box, Button, ColumnLayout, ProgressBar } from '@cloudscape-design/components';
import React from 'react';

export const getPresignedUrls = async (data: any) => {
    const requestUrl = '/dataset/presigned-url';
    const payload = {
        conditions: data.conditions,
        fields: data.fields,
        isUpload: true,
        key: data.key,
    };
    const headerConfig = generateDatasetHeaders(data.key);
    return axios.post(requestUrl, payload, headerConfig);
};

export const getDownloadUrl = async (objectKey: string) => {
    const requestUrl = '/dataset/presigned-url';
    const payload = {
        key: objectKey,
    };
    const headerConfig = generateDatasetHeaders(objectKey);
    const response = await axios.post(requestUrl, payload, headerConfig);
    if (response && response.data) {
        return response.data;
    }
    return undefined;
};

function generateDatasetHeaders (key: string) {
    const datasetType = key.split('/')[0];
    let datasetScope = key.split('/')[1];
    if (datasetType === DatasetType.GROUP) {
        // for groups, set the scope to the dataset name
        datasetScope = key.split('/')[2];
    }
    const headerConfig = {
        headers: {
            'x-mlspace-dataset-type': datasetType,
            'x-mlspace-dataset-scope': datasetScope,
        },
    };
    return headerConfig;
}

export const uploadToS3 = async (presignedUrl: any, file: any) => {
    //This method uploads a file to S3 using a pre-signed post
    const url = presignedUrl.url;
    /*
        The S3 PutObject API accepts form data, and an attached binary file.
        Here, we add the form fields returned by the API, build a form
        and attach the file. Finally, we send the request to S3.
    */
    const formData = new FormData();
    for (const key in presignedUrl.fields) {
        formData.append(key, presignedUrl.fields[key]);
    }

    formData.append('file', file.file); // The binary file must be appended last

    //Request AWS-KMS encryption
    const headers = {
        headers: {
            'x-amz-server-side-encryption': 'aws:kms',
        },
    };
    // Upload the dataset, return response. Use a new axios instance to bypass
    // the interceptor because the presigned urls shouldn't include our auth
    // header
    const basicAxios = Axios.create();
    return basicAxios.post(url, formData, headers);
};

export const buildS3KeysForResourceObjects = (
    resourceObjects: DatasetResourceObject[],
    datasetContext: DatasetContext,
): [string, DatasetResourceObject][] => {
    return resourceObjects.map((resourceObject) => {
        console.log(`Scope: ${datasetContext.scope}, Name: ${datasetContext.name}, Key: ${resourceObject.key}`);
        switch (datasetContext.type!) {
            case DatasetType.PROJECT:
                return [`project/${datasetContext.scope}/datasets/${datasetContext.name}/${resourceObject.key}`, resourceObject];
            case DatasetType.PRIVATE:
                return [`private/${datasetContext.scope}/datasets/${datasetContext.name}/${resourceObject.key}`, resourceObject];
            case DatasetType.GLOBAL:
                return [`global/datasets/${datasetContext.name}/${resourceObject.key}`, resourceObject];
            case DatasetType.GROUP:
                return [`group/datasets/${datasetContext.name}/${resourceObject.key}`, resourceObject];
        }
    });
};

export const fetchPresignedURL = async (s3Key: string) => {
    const conditions: Record<string, string>[] = [];
    const fields: Map<string, string> = new Map<string, string>();

    // This method gets a presigned s3 post from Lambda. The Lambda's IAM Role will be used for the upload.
    const data = {
        key: s3Key,
        isUpload: true,
        fields: Object.fromEntries(fields),
        conditions,
    };

    return await getPresignedUrls(data);
};

export const determineScope = (
    type: DatasetType | undefined,
    projectName: string | undefined,
    groupName: string | undefined,
    username: string
): string => {
    switch (type) {
        case DatasetType.GLOBAL:
            return DatasetType.GLOBAL;
        case DatasetType.PROJECT:
            return projectName!;
        case DatasetType.GROUP:
            return groupName!;
        default:
            // Default to private
            return username;
    }
};

export async function uploadResources (datasetContext: DatasetContext, resourceObjects: DatasetResourceObject[], notificationService: any) {
    let successCount = 0;
    const failedUploads: string[] = [];
    let stopUpload = false;

    console.log(`Uploading ${resourceObjects.length} resources`);
    for (const [s3Uri, resourceObject] of buildS3KeysForResourceObjects(resourceObjects, datasetContext)) {
        if (stopUpload) {
            break;
        }
        const presignedUrl = await fetchPresignedURL(s3Uri);

        if (presignedUrl?.data) {
            const uploadResponse = await uploadToS3(presignedUrl.data, resourceObject);

            if (uploadResponse.status === 204) {
                successCount++;
                notificationService.generateNotification(
                    `Successfully uploaded ${successCount}/${resourceObjects.length} file(s).`,
                    'in-progress',
                    'upload-notification',
                    (<ColumnLayout columns={2}>
                        <ProgressBar
                            label='Uploading files to dataset'
                            description={`Uploading ${resourceObject.name}`}
                            value={successCount / resourceObjects.length * 100}
                            variant='flash'
                        />
                        <Box float='right'>
                            <Button onClick={() => stopUpload = true}>Stop</Button>
                        </Box>
                        
                    </ColumnLayout>
                    ),
                    false
                );
                continue;
            }
        }

        failedUploads.push(resourceObject.key);
    }

    if (successCount > 0) {
        notificationService.generateNotification(
            `Successfully uploaded ${successCount} file(s).`,
            'success',
            'upload-notification',
            (<ProgressBar
                label='Uploading files to dataset'
                value={successCount / resourceObjects.length * 100}
                variant='flash'
            />)
        );
    }
    
    if (failedUploads.length > 0) {
        notificationService.generateNotification(
            `Failed to upload file: ${failedUploads.pop()}` +
                (failedUploads.length > 0 ? ` and ${failedUploads.length} other files.` : '.'),
            'error',
        );
    }
}

export async function createDataset (dataset: IDataset) {
    // Scope and Type should always be set for this Dataset object as part of form validation
    if (dataset.type && dataset.scope){
        const requestUrl = '/dataset/create';
        const payload = {
            datasetName: dataset.name,
            datasetType: dataset.type,
            datasetScope: dataset.scope,
            datasetDescription: dataset.description,
            datasetFormat: dataset.format,
        };
        const headerConfig = {
            headers: {
                'x-mlspace-dataset-type': dataset.type,
                'x-mlspace-dataset-scope': dataset.scope,
            },
        };
        return axios.post(requestUrl, payload, headerConfig);
    }
}

export const tryCreateDataset = (dataset: IDataset) => {
    createDataset(dataset).catch((error) => {
        const expectedError = `Bad Request: Dataset ${dataset.name} already exists.`;
        // Any error that the dataset already existing is unexpected
        if (expectedError !== error.response.data) {
            throw error;
        }
    });
};