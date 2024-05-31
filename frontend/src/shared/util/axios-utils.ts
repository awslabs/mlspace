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

import { default as Axios, AxiosRequestConfig, AxiosResponse } from 'axios';

export const setProjectHeader = (projectName: string): AxiosRequestConfig => {
    return {
        headers: {
            'x-mlspace-project': projectName,
        },
    };
};
class AxiosHelper {
    public static get<T = any, R = AxiosResponse<T>>(apiUrl: string): Promise<R> {
        return Axios.get(apiUrl, config());
    }

    public static post<T = any, R = AxiosResponse<T>, D = any>(
        apiUrl: string,
        data?: D,
        requestConfig?: AxiosRequestConfig
    ): Promise<R> {
        return Axios.post(apiUrl, data, config(requestConfig));
    }

    public static put<T = any, R = AxiosResponse<T>, D = any>(
        apiUrl: string,
        data?: D
    ): Promise<R> {
        return Axios.put(apiUrl, data, config());
    }

    public static delete<T = any, R = AxiosResponse<T>>(apiUrl: string): Promise<R> {
        return Axios.delete(apiUrl, config());
    }
}

const config = (requestConfig: AxiosRequestConfig = {}) => {
    requestConfig.baseURL = `${window.env.LAMBDA_ENDPOINT}`;
    const oidcString = sessionStorage.getItem(
        `oidc.user:${window.env.OIDC_URL}:${window.env.OIDC_CLIENT_NAME}`
    );
    const token = oidcString ? JSON.parse(oidcString).id_token : '';

    if (requestConfig.headers === undefined) {
        requestConfig.headers = {};
    }
    requestConfig.headers['Authorization'] = `Bearer ${token}`;

    return requestConfig;
};

const axios = {
    get: AxiosHelper.get,
    post: AxiosHelper.post,
    put: AxiosHelper.put,
    delete: AxiosHelper.delete,
};

export default axios;
