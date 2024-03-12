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

import mockAxios from 'jest-mock-axios';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { INotebook, defaultNotebook } from '../../shared/model/notebook.model';
import { NotebookResourceMetadata, ResourceType } from '../../shared/model/resource-metadata.model';
import reducer, {
    createNotebookInstance,
    deleteNotebookInstance,
    describeNotebookInstance,
    getNotebookOptions,
    listNotebookInstances,
    startNotebookInstance,
    stopNotebookInstance,
    updateNotebookInstance,
} from './notebook.reducer';

describe('Entities reducer tests', () => {
    const initialState = {
        loadingNotebookInstance: false,
        loadingNotebookList: false,
        notebookList: [],
        notebook: defaultNotebook,
        responseText: undefined,
        lifecycleConfigs: [] as string[],
        loadingNotebookOptions: false,
        loadingAction: false,
    };

    function generateNotebookResourceMetadata (uid: string): NotebookResourceMetadata {
        return {
            resourceId: `${uid}-Notebook`,
            resourceType: ResourceType.NOTEBOOK,
            project: 'TestProject',
            user: 'Jeff',
            metadata: {
                CreationTime: '2023-01-04T12:00:00Z',
                InstanceType: 'ml.m4.xlarge',
                NotebookInstanceArn: `arn:aws:us-east-1:123456789012:sagemaker:notebook/${uid}-Notebook`,
                NotebookInstanceLifecycleConfigName: 'configTest',
                NotebookInstanceStatus: 'InService',
            },
        };
    }

    function generateNotebook (uid: string): INotebook {
        return {
            NotebookInstanceName: `${uid}-Notebook`,
            NotebookInstanceStatus: 'InService',
            InstanceType: 'ml.m4.xlarge',
            CreationTime: '2023-01-04T12:00:00Z',
            LastModifiedTime: '2023-01-04T13:30:00Z',
            VolumeSizeInGB: 100,
            NotebookInstanceLifecycleConfigName: 'configTest',
            RootAccess: false,
            Owner: 'Jeff',
            NotebookInstanceArn: `arn:aws:us-east-1:123456789012:sagemaker:notebook/${uid}-Notebook`,
            RoleArn: 'arn:aws:us-east-1:123456789012:iam:role/testRole',
            KmsKeyId: 'fakeKey',
            SubnetId: 'fakeSubnet',
            Url: 'fakeUrl',
            SecurityGroups: 'fake,groups',
            NetworkInterfaceId: 'fakeNetworkInterfaceId',
            DirectInternetAccess: 'None',
            PlatformIdentifier: 'AL2',
        };
    }

    function testInitialState (state: any) {
        expect(state).toMatchObject({
            lifecycleConfigs: [],
            loadingAction: false,
            loadingNotebookInstance: false,
            loadingNotebookList: false,
            loadingNotebookOptions: false,
            notebook: {},
            notebookList: [],
            responseText: undefined,
        });
    }

    function testMultipleTypes (types: any, payload: any, testFunction: any, error?: any) {
        types.forEach((e: any) => {
            testFunction(reducer(undefined, { type: e, payload, error }));
        });
    }

    describe('Common', () => {
        it('should return the initial state', () => {
            testInitialState(reducer(undefined, { type: '' }));
        });
    });

    describe('Requests', () => {
        const payload = {};
        it('should set state to loading', () => {
            expect(
                reducer(undefined, {
                    type: listNotebookInstances.pending.type,
                    payload,
                })
            ).toMatchObject({
                lifecycleConfigs: [],
                loadingAction: false,
                loadingNotebookInstance: false,
                loadingNotebookList: true,
                loadingNotebookOptions: false,
                notebook: {},
                notebookList: [],
                responseText: undefined,
            });
            expect(
                reducer(undefined, {
                    type: describeNotebookInstance.pending.type,
                    payload,
                })
            ).toMatchObject({
                lifecycleConfigs: [],
                loadingAction: false,
                loadingNotebookInstance: true,
                loadingNotebookList: false,
                loadingNotebookOptions: false,
                notebook: {},
                notebookList: [],
                responseText: undefined,
            });
            expect(
                reducer(undefined, {
                    type: getNotebookOptions.pending.type,
                    payload,
                })
            ).toMatchObject({
                lifecycleConfigs: [],
                loadingAction: false,
                loadingNotebookInstance: false,
                loadingNotebookList: false,
                loadingNotebookOptions: true,
                notebook: {},
                notebookList: [],
                responseText: undefined,
            });
            testMultipleTypes(
                [
                    startNotebookInstance.pending.type,
                    stopNotebookInstance.pending.type,
                    createNotebookInstance.pending.type,
                    deleteNotebookInstance.pending.type,
                ],
                payload,
                (state: any) => {
                    expect(state).toMatchObject({
                        lifecycleConfigs: [],
                        loadingAction: true,
                        loadingNotebookInstance: false,
                        loadingNotebookList: false,
                        loadingNotebookOptions: false,
                        notebook: {},
                        notebookList: [],
                        responseText: undefined,
                    });
                }
            );
        });
    });

    describe('Failures', () => {
        it('should set a message in errorMessage', () => {
            testMultipleTypes(
                [
                    listNotebookInstances.rejected.type,
                    describeNotebookInstance.rejected.type,
                    startNotebookInstance.rejected.type,
                    stopNotebookInstance.rejected.type,
                    createNotebookInstance.rejected.type,
                    deleteNotebookInstance.rejected.type,
                    getNotebookOptions.rejected.type,
                ],
                'error message',
                (state: any) => {
                    expect(state).toMatchObject({
                        lifecycleConfigs: [],
                        loadingAction: false,
                        loadingNotebookInstance: false,
                        loadingNotebookList: false,
                        loadingNotebookOptions: false,
                        notebook: {},
                        notebookList: [],
                        responseText: 'error message',
                    });
                },
                {
                    message: 'error message',
                }
            );
        });
    });

    describe('Successes', () => {
        it('should fetch all entities', () => {
            const payload = {
                data: {
                    records: [
                        generateNotebookResourceMetadata('first'),
                        generateNotebookResourceMetadata('second'),
                    ],
                },
            };
            expect(
                reducer(undefined, {
                    type: listNotebookInstances.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
                notebookList: [payload.data.records[0], payload.data.records[1]],
            });
        });

        it('should fetch a single entity', () => {
            const payload = { data: generateNotebook('test') };
            expect(
                reducer(undefined, {
                    type: describeNotebookInstance.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
                notebook: payload.data,
            });
        });
        it('should start successfully', () => {
            const payload = { data: generateNotebook('test') };
            expect(
                reducer(undefined, {
                    type: startNotebookInstance.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
            });
        });
        it('should stop successfully', () => {
            const payload = { data: generateNotebook('test') };
            expect(
                reducer(undefined, {
                    type: stopNotebookInstance.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
            });
        });
        it('should create successfully', () => {
            const payload = { data: generateNotebook('test') };
            expect(
                reducer(undefined, {
                    type: createNotebookInstance.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
            });
        });
        it('should update successfully', () => {
            const payload = { data: generateNotebook('test') };
            expect(
                reducer(undefined, {
                    type: updateNotebookInstance.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
            });
        });
        it('should delete successfully', () => {
            const payload = { data: generateNotebook('test') };
            expect(
                reducer(undefined, {
                    type: deleteNotebookInstance.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
            });
        });
    });

    describe('Actions', () => {
        let store: any;

        const resolvedObject = { data: [{ id: 1 }, { id: 2 }] };
        afterEach(() => {
            mockAxios.reset();
        });
        beforeEach(() => {
            window.env = {
                LAMBDA_ENDPOINT: 'fake',
                OIDC_URL: 'test',
                OIDC_CLIENT_NAME: 'web-client',
                OIDC_REDIRECT_URI: '',
            };
            const mockStore = configureStore([thunk]);
            store = mockStore({});
            mockAxios.get.mockResolvedValueOnce(resolvedObject);
            mockAxios.post.mockResolvedValueOnce(resolvedObject);
            mockAxios.delete.mockResolvedValueOnce({});
            mockAxios.put.mockResolvedValueOnce({
                NotebookInstanceName: 'firstNotebook',
                ProjectName: 'testProject',
                NotebookInstanceLifecycleConfigName: 'configTest',
                InstanceType: 'ml.m4.xlarge',
                VolumeSizeInGB: '100GB',
            });
        });

        it('dispatches fetch_entity_list action with project name', async () => {
            const expectedActions = [
                {
                    type: listNotebookInstances.pending.type,
                },
                {
                    type: listNotebookInstances.fulfilled.type,
                    payload: resolvedObject,
                },
            ];
            await store.dispatch(listNotebookInstances({ projectName: 'project' }));
            expect(mockAxios.get).toHaveBeenCalledWith('/project/project/notebooks', {
                baseURL: 'fake',
            });
            expect(store.getActions()[0]).toMatchObject(expectedActions[0]);
            expect(store.getActions()[1]).toMatchObject(expectedActions[1]);
        });

        it('dispatches fetch_entity_list without project name', async () => {
            const expectedActions = [
                {
                    type: listNotebookInstances.pending.type,
                },
                {
                    type: listNotebookInstances.fulfilled.type,
                    payload: resolvedObject,
                },
            ];
            await store.dispatch(listNotebookInstances({}));
            expect(mockAxios.get).toHaveBeenCalledWith('/notebook', { baseURL: 'fake' });
            expect(store.getActions()[0]).toMatchObject(expectedActions[0]);
            expect(store.getActions()[1]).toMatchObject(expectedActions[1]);
        });

        it('dispatches fetch_notebook action', async () => {
            const expectedActions = [
                {
                    type: describeNotebookInstance.pending.type,
                },
                {
                    type: describeNotebookInstance.fulfilled.type,
                    payload: resolvedObject,
                },
            ];
            await store.dispatch(describeNotebookInstance('42666'));
            expect(mockAxios.get).toHaveBeenCalledWith('/notebook/42666', {
                baseURL: 'fake',
            });
            expect(store.getActions()[0]).toMatchObject(expectedActions[0]);
            expect(store.getActions()[1]).toMatchObject(expectedActions[1]);
        });

        it('dispatches start_notebook action', async () => {
            const expectedActions = [
                {
                    type: startNotebookInstance.pending.type,
                },
                {
                    type: startNotebookInstance.fulfilled.type,
                },
            ];
            await store.dispatch(
                startNotebookInstance({ notebookName: '42666', projectName: 'testProject' })
            );
            expect(mockAxios.post).toHaveBeenCalledWith('/notebook/42666/start', undefined, {
                baseURL: 'fake',
                headers: { 'x-mlspace-project': 'testProject' },
            });
            expect(store.getActions()[0]).toMatchObject(expectedActions[0]);
            expect(store.getActions()[1]).toMatchObject(expectedActions[1]);
        });

        it('dispatches stop_notebook action', async () => {
            const expectedActions = [
                {
                    type: stopNotebookInstance.pending.type,
                },
                {
                    type: stopNotebookInstance.fulfilled.type,
                },
            ];
            await store.dispatch(
                stopNotebookInstance({ notebookName: '42666', projectName: 'testProject' })
            );
            expect(mockAxios.post).toHaveBeenCalledWith('/notebook/42666/stop', undefined, {
                baseURL: 'fake',
                headers: { 'x-mlspace-project': 'testProject' },
            });
            expect(store.getActions()[0]).toMatchObject(expectedActions[0]);
            expect(store.getActions()[1]).toMatchObject(expectedActions[1]);
        });

        it('dispatches delete_notebook action', async () => {
            const expectedActions = [
                {
                    type: deleteNotebookInstance.pending.type,
                },
                {
                    type: deleteNotebookInstance.fulfilled.type,
                },
            ];
            await store.dispatch(deleteNotebookInstance('42666'));
            expect(mockAxios.delete).toHaveBeenCalledWith('/notebook/42666', { baseURL: 'fake' });
            expect(store.getActions()[0]).toMatchObject(expectedActions[0]);
            expect(store.getActions()[1]).toMatchObject(expectedActions[1]);
        });

        it('dispatches create_notebook action', async () => {
            const createdNotebook = {
                NotebookInstanceName: 'firstNotebook',
                ProjectName: 'testProject',
                NotebookInstanceLifecycleConfigName: 'configTest',
                InstanceType: 'ml.m4.xlarge',
                VolumeSizeInGB: 100,
            };
            const addNotebook: INotebook = {
                NotebookInstanceName: 'firstNotebook',
                NotebookInstanceLifecycleConfigName: 'configTest',
                InstanceType: 'ml.m4.xlarge',
                VolumeSizeInGB: 100,
            };
            const expectedActions = [
                {
                    type: createNotebookInstance.pending.type,
                },
                {
                    type: createNotebookInstance.fulfilled.type,
                },
            ];
            await store.dispatch(
                createNotebookInstance({
                    notebookInstance: addNotebook,
                    projectName: 'testProject',
                })
            );
            expect(mockAxios.post).toHaveBeenCalledWith('/notebook', createdNotebook, {
                baseURL: 'fake',
                headers: { 'x-mlspace-project': 'testProject' },
            });
            expect(store.getActions()[0]).toMatchObject(expectedActions[0]);
            expect(store.getActions()[1]).toMatchObject(expectedActions[1]);
        });

        it('dispatches update_notebook action', async () => {
            const updatedNotebook = {
                NotebookInstanceName: 'firstNotebook',
                NotebookInstanceLifecycleConfigName: 'configTest',
                InstanceType: 'ml.m4.xlarge',
                VolumeSizeInGB: 100,
            };
            const newNotebook = {
                InstanceType: 'ml.m4.xlarge',
                NotebookInstanceLifecycleConfigName: 'configTest',
                NotebookInstanceName: 'firstNotebook',
                VolumeSizeInGB: 100,
            };
            const expectedActions = [
                {
                    type: updateNotebookInstance.pending.type,
                },
                {
                    type: updateNotebookInstance.fulfilled.type,
                },
            ];
            await store.dispatch(updateNotebookInstance(updatedNotebook));
            expect(mockAxios.put).toHaveBeenCalledWith('/notebook/firstNotebook', newNotebook, {
                baseURL: 'fake',
            });
            expect(store.getActions()[0]).toMatchObject(expectedActions[0]);
            expect(store.getActions()[1]).toMatchObject(expectedActions[1]);
        });
    });
});
