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

import { DatasetType, IDataset } from '../../shared/model/dataset.model';
import { IDatasetFile } from '../../shared/model/datasetfile.model';
import axios from '../../shared/util/axios-utils';
import { default as Axios } from 'axios';

export const getPresignedUrls = async (data: any) => {
    const requestUrl = '/dataset/presigned-url';
    const payload = {
        conditions: data.conditions,
        fields: data.fields,
        isUpload: true,
        key: data.key,
    };
    const [datasetType, datasetScope] = data.key.split('/');
    const headerConfig = {
        headers: {
            'x-mlspace-dataset-type': datasetType,
            'x-mlspace-dataset-scope': datasetScope,
        },
    };
    return axios.post(requestUrl, payload, headerConfig);
};

export const getDownloadUrl = async (objectKey: string) => {
    const requestUrl = '/dataset/presigned-url';
    const payload = {
        key: objectKey,
    };
    const [datasetType, datasetScope] = objectKey.split('/');
    const headerConfig = {
        headers: {
            'x-mlspace-dataset-type': datasetType,
            'x-mlspace-dataset-scope': datasetScope,
        },
    };
    const response = await axios.post(requestUrl, payload, headerConfig);
    if (response && response.data) {
        return response.data;
    }
    return undefined;
};

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

export const buildS3Keys = (
    files: IDatasetFile[],
    dataset: IDataset,
    projectName: string | undefined,
    username: string
) => {
    const s3Keys: string[] = [];
    for (let i = 0; i < files.length; i++) {
        switch (dataset.type) {
            case DatasetType.PROJECT:
                s3Keys.push(`project/${projectName}/datasets/${dataset.name}/${files[i].key}`);
                break;
            case DatasetType.GLOBAL:
                s3Keys.push(`global/datasets/${dataset.name}/${files[i].key}`);
                break;
            default:
                s3Keys.push(`private/${username}/datasets/${dataset.name}/${files[i].key}`);
                break;
        }
    }

    return s3Keys;
};

export const fetchPresignedURL = async (s3Key: string, dataset: IDataset) => {
    const metadata: Map<string, string> = new Map([
        ['dataset-description', dataset.description || ''],
        ['dataset-format', dataset.format || ''],
    ]);

    const conditions: Record<string, string>[] = [];
    const fields: Map<string, string> = new Map<string, string>();
    metadata.forEach((value, key) => {
        fields.set(`x-amz-meta-${key}`, value);
        conditions.push({ [`x-amz-meta-${key}`]: value });
    });

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
    dataset: IDataset,
    projectName: string | undefined,
    username: string
): string => {
    switch (dataset.type) {
        case DatasetType.GLOBAL:
            return DatasetType.GLOBAL;
        case DatasetType.PROJECT:
            return projectName!;
        default:
            // Default to private
            return username;
    }
};

export async function uploadFiles (
    s3Keys: string[],
    dataset: IDataset,
    notificationService: any,
    datasetFileList: IDatasetFile[]
) {
    let successCount = 0;
    const failedUploads: string[] = [];
    for (let i = 0; i < s3Keys.length; i++) {
        const presignedURL = await fetchPresignedURL(s3Keys[i], dataset);
        if (presignedURL && presignedURL.data) {
            const uploadResponse = await uploadToS3(presignedURL.data, datasetFileList[i]);
            if (uploadResponse.status === 204) {
                successCount++;
            } else {
                failedUploads.push(datasetFileList[i].key!);
            }
        } else {
            failedUploads.push(datasetFileList[i].key!);
        }
    }
    if (successCount > 0) {
        notificationService.generateNotification(
            `Successfully uploaded ${successCount} file(s).`,
            'success'
        );
    }
    if (failedUploads.length > 0) {
        notificationService.generateNotification(
            `Failed to upload file: ${failedUploads.pop()}` +
                (failedUploads.length > 0 ? ` and ${failedUploads.length} other files.` : '.'),
            'error'
        );
    }
}

export async function createDataset (dataset: IDataset) {
    const requestUrl = '/dataset/create';
    const payload = {
        datasetName: dataset.name,
        datasetType: dataset.type,
        datasetScope: dataset.scope,
        datasetDescription: dataset.description,
        datasetFormat: dataset.format,
    };
    const datasetType = dataset.type;
    const datasetScope = dataset.scope;
    // Scope and Type should always be set for this Dataset object as part of form validation
    if (datasetType && datasetScope){
        const headerConfig = {
            headers: {
                'x-mlspace-dataset-type': datasetType,
                'x-mlspace-dataset-scope': datasetScope,
            },
        };
        return axios.post(requestUrl, payload, headerConfig);
    }
}

export const listDatasetBucketAndLocations = async (scope: string, type: string) => {
    const response = await axios.get(`/dataset-locations/${type}/${scope}`);
    if (response.status === 200) {
        return response.data;
    }
    return [];
};

export const listDatasetFiles = async (scope: string, name: string) => {
    const response = await axios.get(`/dataset/${scope}/${name}/files`);
    if (response.status === 200) {
        return response.data;
    }
    return [];
};
