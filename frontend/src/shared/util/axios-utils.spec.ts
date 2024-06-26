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

/**
  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 
  Licensed under the Apache License, Version 2.0 (the 'License').
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at
 
      http://www.apache.org/licenses/LICENSE-2.0
 
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { describe, test, expect } from '@jest/globals';
import { default as Axios } from 'axios';
import { default as axios } from './axios-utils';

const dummyUrl = 'https://any.com';
const mockLambdaEndpoint = 'https://fake-endpoint.com';
const mockOidcUrl = 'https://fake-oidc.com';
const mockOidcClientName = 'fake-oidc-client-name';
const mockToken = 'token';
const mockOidcSessionStorageName = `oidc.user:${mockOidcUrl}:${mockOidcClientName}`;
const mockOidcSessionStorageValue = `{"id_token":"${mockToken}"}`;
const expectedRequestConfig = {
    baseURL: mockLambdaEndpoint,
    headers: {
        Authorization: `Bearer ${mockToken}`
    }
};

// When mocking with jest, target the library, not the class
jest.mock('axios');

// Allows for mocking the browser window - https://stackoverflow.com/questions/41885841/how-can-i-mock-the-javascript-window-object-using-jest
let windowSpy;

beforeEach(() => {
    // Mocks the window without altering it and affecting other tests
    windowSpy = jest.spyOn(window, 'window', 'get') as jest.Mock;
    windowSpy.mockImplementation(() => ({
        location: {
            origin: 'https://example.com'
        },
        env: {
            LAMBDA_ENDPOINT: mockLambdaEndpoint,
            OIDC_URL: mockOidcUrl,
            OIDC_CLIENT_NAME: mockOidcClientName
        },   
    }));
    sessionStorage.setItem(mockOidcSessionStorageName, mockOidcSessionStorageValue);
});

afterEach(() => {
    windowSpy.mockRestore();
    sessionStorage.removeItem(mockOidcSessionStorageName);

});

/**
 * Describe allows for specifying a test group associated with a particular function/class
 */
describe('Test AxiosHelper', () => {
    // Jest concurrency can't be used when using beforeEach and afterEach
    test('Test Get Request', () => {
        Axios.get.mockResolvedValue(Promise.resolve({data: {dummy: 'data'}}));

        expect(axios.get(dummyUrl)).toEqual(Promise.resolve({data: {dummy: 'data'}}));
        expect(Axios.get).toHaveBeenCalledWith(dummyUrl, expectedRequestConfig);
    });


    test('Test Post Request', () => {
        Axios.post.mockResolvedValue(Promise.resolve({data: {dummy: 'data'}}));

        expect(axios.post(dummyUrl, {dummyPostData: 'postValue'})).toEqual(Promise.resolve({data: {dummy: 'data'}}));
        expect(Axios.post).toHaveBeenCalledWith(dummyUrl, {dummyPostData: 'postValue'}, expectedRequestConfig);
    });

    test('Test Post Request With Config', () => {
        Axios.post.mockResolvedValue(Promise.resolve({data: {dummy: 'data'}}));

        expect(axios.post(dummyUrl, {dummyPostData: 'postValue'}, {headers:{}})).toEqual(Promise.resolve({data: {dummy: 'data'}}));
        expect(Axios.post).toHaveBeenCalledWith(dummyUrl, {dummyPostData: 'postValue'}, expectedRequestConfig);
    });

    test('Test Put Request', () => {
        Axios.put.mockResolvedValue(Promise.resolve({data: {dummy: 'data'}}));

        expect(axios.put(dummyUrl, {dummyPutData: 'putValue'})).toEqual(Promise.resolve({data: {dummy: 'data'}}));
        expect(Axios.put).toHaveBeenCalledWith(dummyUrl, {dummyPutData: 'putValue'}, expectedRequestConfig);
    });

    test('Test Delete Request', () => {
        Axios.delete.mockResolvedValue(Promise.resolve({data: {dummy: 'data'}}));

        expect(axios.delete(dummyUrl)).toEqual(Promise.resolve({data: {dummy: 'data'}}));
        expect(Axios.delete).toHaveBeenCalledWith(dummyUrl, expectedRequestConfig);
    });
});
