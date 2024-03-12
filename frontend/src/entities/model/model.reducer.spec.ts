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

import reducer, {
    getProjectModels,
    getModelByName,
    deleteModelFromProject,
    getImageURIs,
} from './model.reducer';
import { IModel } from '../../shared/model/model.model';
import { SelectProps } from '@cloudscape-design/components';
import { ModelResourceMetadata, ResourceType } from '../../shared/model/resource-metadata.model';

const initialState = {
    loadingModelsList: false,
    loadingModel: false,
    loadingImageURIs: false,
    loadingURLs: false,
    selectTrainingJobModalVisible: false,
    modelsList: [],
    model: {} as IModel,
    imageURIs: [] as SelectProps.Option[],
    modelDataUrls: [] as SelectProps.Option[],
    responseText: undefined,
};

function generateTestModelResourceMetadata (uid: string): ModelResourceMetadata {
    return {
        resourceId: `${uid}-Model`,
        resourceType: ResourceType.MODEL,
        project: 'TestProject',
        user: 'Jeff',
        metadata: {
            CreationTime: '2023-01-04T12:00:00Z',
            ModelArn: `arn:aws:us-east-1:123456789012:sagemaker:model/${uid}-Model`,
        },
    };
}
function generateTestModel (uid: string) {
    return {
        ModelName: `${uid}-Model`,
        ModelArn: `arn:aws:us-east-1:123456789012:sagemaker:model/${uid}-Model`,
        CreationTime: '2023-01-01T12:00:00Z',
        ExecutionRoleArn: 'testRole',
        PrimaryContainer: {
            Image: 'primaryContainer',
            Mode: 'PRIMARY',
            ContainerHostName: 'someHost',
            ModelDataUrl: 'https://s3.amazonaws.com/mybucket/mydata.xml',
            Environment: undefined,
        },
        ProjectName: 'testProject',
    };
}

function generateTestModelWithContainers (uid: string) {
    return {
        ModelName: `${uid}-Model`,
        ModelArn: `arn:aws:us-east-1:123456789012:sagemaker:model/${uid}-Model`,
        CreationTime: '2023-01-01T12:00:00Z',
        ExecutionRoleArn: 'testRole',
        PrimaryContainer: {
            Image: 'primaryContainer',
            Mode: 'PRIMARY',
            ContainerHostName: 'someHost',
            ModelDataUrl: 'https://s3.amazonaws.com/mybucket/mydata.xml',
            Environment: undefined,
        },
        Containers: [
            {
                Image: 'primaryContainer',
                Mode: 'PRIMARY',
                ContainerHostName: 'someHost',
                ModelDataUrl: 'https://s3.amazonaws.com/mybucket/mydata.xml',
                Environment: undefined,
            },
        ],
        ProjectName: 'testProject',
    };
}

describe('Model Reducer Tests', () => {
    function testInitialState (state: any) {
        expect(state).toMatchObject({});
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
                    type: getProjectModels.pending.type,
                    payload,
                })
            ).toMatchObject({ loadingModelsList: true });
            expect(
                reducer(undefined, {
                    type: getModelByName.pending.type,
                    payload,
                })
            ).toMatchObject({ loadingModel: true });
            expect(
                reducer(undefined, {
                    type: getImageURIs.pending.type,
                    payload,
                })
            ).toMatchObject({ loadingImageURIs: true });
        });
    });

    describe('Failures', () => {
        it('error message', () => {
            testMultipleTypes(
                [
                    getProjectModels.rejected.type,
                    getModelByName.rejected.type,
                    deleteModelFromProject.rejected.type,
                    getImageURIs.rejected.type,
                ],
                'error message',
                (state: any) => {
                    expect(state).toMatchObject({
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
        it('getProjectModels', () => {
            const payload = {
                data: {
                    records: [
                        generateTestModelResourceMetadata('first'),
                        generateTestModelResourceMetadata('second'),
                    ],
                },
            };
            expect(
                reducer(undefined, {
                    type: getProjectModels.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
                modelsList: [payload.data.records[0], payload.data.records[1]],
            });
        });

        it('getModelByName', () => {
            const payload = { data: generateTestModel('test') };
            expect(
                reducer(undefined, {
                    type: getModelByName.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
                model: generateTestModelWithContainers('test'),
            });
        });

        it('deleteModelFromProject', () => {
            const payload = { data: generateTestModel('test') };
            expect(
                reducer(undefined, {
                    type: deleteModelFromProject.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
                model: {},
            });
        });

        it('getImageURIs', () => {
            const payload = { data: { test: 'Value' } };
            expect(
                reducer(undefined, {
                    type: getImageURIs.fulfilled.type,
                    payload,
                })
            ).toEqual({
                ...initialState,
                imageURIs: [{ value: 'Value' }],
            });
        });
    });
});
