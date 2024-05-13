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

declare namespace Cypress {
    type Chainable = {
        loginByCognito(baseUrl: string, username: string, password: string): Chainable<Response>;
        loginByKeycloak(baseUrl: string, keyCloakUrl: string, username: string, password: string): Chainable<Response>;
        loginByMockIdP(baseUrl: string, username: string, password: string): Chainable<Response>;
        getAccessibilityDefects(): Chainable<Array<any>>;
        setValueCloudscapeInput(dataSelector: string, value: string): Chainable<Response>;
        setValueCloudscapeTextArea(dataSelector: string, value: string): Chainable<Response>;
        setValueCloudscapeAutoSuggest(dataSelector: string, value: string): Chainable<Response>;
        setValueCloudscapeSelect(dataSelector: string, value: string): Chainable<Response>;
        setValueCloudscapeMultiselect(dataSelector: string, values: string[]): Chainable<Response>;
        setValueCloudscapeTextFilter(dataSelector: string, value: string): Chainable<Response>;
        clearCloudscapeTextFilter(dataSelector: string);
        selectCloudscapeTableRow(dataSelector: string): Chainable<Response>;
        verifyCloudscapeInput(dataSelector: string, value: string): Chainable<Response>;
        verifyCloudscapeTextArea(dataSelector: string, value: string): Chainable<Response>;
        verifyCloudscapeAutoSuggest(dataSelector: string, value: string): Chainable<Response>;
        verifyCloudscapeSelect(dataSelector: string, value: string): Chainable<Response>;
        verifyCloudscapeMultiselect(dataSelector: string, values: string[]): Chainable<Response>;
        verifySelectCloudscapeTableRow(dataSelector: string): Chainable<Response>;
        initializeTest(props: TestProps): Chainable<Response>;
        teardownTest(props: TestProps): Chainable<Response>;
        createProject(props: ProjectProps): Chainable<Response>;
        deleteProject(projectName: string): Chainable<Response>;
        deleteProjectsWithPrefix(projectPrefix: string): Chainable<Response>;
        createDataset(props: DatasetProps): Chainable<Response>;
        deleteDataset(datasetName: string): Chainable<Response>;
    };
}