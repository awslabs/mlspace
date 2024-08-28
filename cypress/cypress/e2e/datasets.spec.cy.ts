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

import {
    BASE_URL,
    DEFAULT_USERNAME,
    login,
} from '../support/commands';
import createWrapper from '@cloudscape-design/components/test-utils/selectors';
import { TestProps } from '../support/test-initializer/types';

const testPrefix = 'Datasets';
const testTime = new Date().getTime();
const testProjectName = `${testPrefix}${testTime}`;

describe('Dataset Tests', () => {
    const testGroupName = `Group${testTime}`;

    const testProps: TestProps = {
        login: true,
        projectPrefix: testPrefix,
        projects: [{
            name: testProjectName,
            description: `Test project used for testing ${testPrefix}`
        }],
        groups: [{
            name: testGroupName,
            description: `Test group used for testing ${testPrefix}`
        }],
    };

    before(() => {
        cy.initializeTest(testProps);
    });

    beforeEach(() => {
        Cypress.session.clearAllSavedSessions();
        // Call login routine
        login();
        // Navigate to dataset page
        cy.visit(`${BASE_URL}#/project/${testProjectName}/dataset`);
        cy.url().should('include', `#/project/${testProjectName}/dataset`);
    });

    after(async () => {
        cy.teardownTest(testProps);
    });

    // === Global ===

    it('Create Global Dataset', () => {
        createDataset('Global', testProjectName);
    });

    it('Global Dataset Details', () => {
        getDatasetDetails('Global');
    });

    it('Delete Global Dataset File', () => {
        deleteDatasetFile('Global');
    });

    it('Update Global Dataset', () => {
        updateDataset('Global');
    });

    it('Delete Global Dataset', () => {
        deleteDataset('Global');
    });

    // === Private ===

    it('Create Private Dataset', () => {
        createDataset('Private', testProjectName);
    });

    it('Private Dataset Details', () => {
        getDatasetDetails('Private');
    });

    it('Delete Private Dataset File', () => {
        deleteDatasetFile('Private');
    });

    it('Update Private Dataset', () => {
        updateDataset('Private');
    });

    it('Delete Private Dataset', () => {
        deleteDataset('Private');
    });

    // === Project ===

    it('Create Project Dataset', () => {
        createDataset('Project', testProjectName);
    });

    it('Project Dataset Details', () => {
        getDatasetDetails('Project', testProjectName);
    });

    it('Delete Project Dataset File', () => {
        deleteDatasetFile('Project');
    });

    it('Update Project Dataset', () => {
        updateDataset('Project');
    });

    it('Delete Project Dataset', () => {
        deleteDataset('Project');
    });

    // === Group ===

    it('Create Group Dataset', () => {
        createDataset('Group', testGroupName);
    });

    it('Group Dataset Details', () => {
        getDatasetDetails('Group', testGroupName);
    });

    it('Delete Group Dataset File', () => {
        deleteDatasetFile('Group');
    });

    it('Update Group Dataset', () => {
        updateDataset('Group');
    });

    it('Delete Group Dataset', () => {
        deleteDataset('Group');
    });
});

// === Driver Functions ===
function createDataset (datasetType: string, testName: string) {
    const datasetName = generateDatasetName(datasetType);
    const datasetDescription = generateDatasetDescription(datasetType);
    cy.contains('Create dataset').click();
    cy.url().should('include', '/dataset/create');

    // Set dataset values
    cy.setValueCloudscapeInput('dataset-name-input', datasetName);
    cy.setValueCloudscapeTextArea('dataset-description-textarea', datasetDescription);
    cy.setValueCloudscapeSelect('dataset-type-select', datasetType.toLocaleLowerCase());

    uploadFile('test_upload_file.txt');

    // Verify expected values were input and retained by the form
    cy.verifyCloudscapeInput('dataset-name-input', datasetName);
    cy.verifyCloudscapeTextArea('dataset-description-textarea', datasetDescription);
    cy.verifyCloudscapeSelect('dataset-type-select', datasetType);

    if (datasetType === 'Group') {
        cy.setValueCloudscapeMultiselect('group-name-multiselect', [testName]);
    }
    


    cy.get('[data-cy="dataset-submit-button"]').click();
    cy.wait(3000);
    
    // Verify dataset creation redirected to main dataset page
    cy.url().should('include', `#/project/${testProjectName}/dataset`).should('include', datasetName);

    // Wait for the dataset to be populated and redirect to the datasets page
    // Occasional failures to load were observed at 5000ms wait time in development
    cy.visit(`${BASE_URL}#/project/${testProjectName}/dataset`);
    cy.wait(2000);
    cy.reload();

    filterDatasets(datasetName);
}

function getDatasetDetails (datasetType: string, testName?: string) {
    const datasetName = generateDatasetName(datasetType);
    const datasetDescription = generateDatasetDescription(datasetType);
    // Filter for the item so it is the only one in the list
    filterDatasets(datasetName);

    clickDataset();

    // Click the actions dropdown and click edit
    clickAndAction('details');

    cy.get('[data-cy="Name-value"]').should('have.text', datasetName);
    cy.get('[data-cy="Description-value"]').should('have.text',datasetDescription);
    cy.get('[data-cy="Access level-value"]').should('have.text', `${datasetType.toLowerCase()}${datasetType === 'Project' ? `: ${testName}` : ''}`);
    // Should not have the default empty text
    cy.get('[data-cy="Location-value"]').should('not.have.text', '-');
}

function deleteDatasetFile (datasetType: string) {
    const datasetName = generateDatasetName(datasetType);
    // Filter for the item so it is the only one in the list
    filterDatasets(datasetName);

    clickDataset();

    // Click the actions dropdown and click details
    clickAndAction('details');
    cy.wait(2000);

    // Filter for the uploaded file
    const datasetBrowserTableWrapper = createWrapper().findTable('[data-cy="Dataset Browser"]');
    cy.setValueCloudscapeInput('Filter files', 'test_upload_file.txt');
    cy.get(datasetBrowserTableWrapper.findRowSelectionArea(1).toSelector()).scrollIntoView().click();
    cy.contains('Delete').click();
    cy.get('[data-cy="modal-delete"]').click();
    cy.contains('No Entries exist');
}

function updateDataset (datasetType: string) {
    const datasetName = generateDatasetName(datasetType);
    const datasetDescription = generateDatasetDescription(datasetType);
    // Filter for the item so it is the only one in the list
    filterDatasets(datasetName);

    clickDataset();

    // Click the actions dropdown and click edit
    clickAndAction('edit');

    // Check that expected values are available
    cy.get(createWrapper().findInput('[data-cy="dataset-type"]').findNativeInput().toSelector()).should('have.value', datasetType.toLowerCase());
    cy.get(createWrapper().findInput('[data-cy="dataset-owner"]').findNativeInput().toSelector()).should('have.value', DEFAULT_USERNAME);
    cy.get(createWrapper().findTextarea('[data-cy="dataset-description"]').findNativeTextarea().toSelector()).should('have.value', datasetDescription);

    // Update description
    cy.get(createWrapper().findTextarea('[data-cy="dataset-description"]').findNativeTextarea().toSelector()).type(' Updated');

    // Save description change
    cy.contains('Update dataset').scrollIntoView().click();

    filterDatasets(datasetName);

    clickDataset();

    clickAndAction('details');

    cy.get('[data-cy="Description-value"]').should('have.text', `${datasetDescription} Updated`);

    uploadFile('test_second_upload_file.txt');
}

function deleteDataset (datasetType: string) {
    const datasetName = generateDatasetName(datasetType);
    // Filter for the item so it is the only one in the list
    filterDatasets(datasetName);

    clickDataset();

    // Click the actions dropdown and click delete
    clickAndAction('delete');
    cy.get('[data-cy="modal-delete"]').click();
    cy.intercept('GET', '**/datasets').as('getDatasets');
    cy.wait('@getDatasets', { timeout: 10000 });

    // Check that the dataset is deleted
    cy.contains('0 matches');
}

// === Helper Functions ===
function filterDatasets (datasetName: string) {
    // Verify dataset was created
    // Filter for the item so that it is the only one in the list
    cy.setValueCloudscapeInput('Filter Dataset', datasetName);
    cy.contains('1 match');
}

function uploadFile (fileName: string) {
    // Upload a new file
    cy.get('[data-cy="dataset-file-upload-input-Upload Files"]').as('fileInput');
    cy.fixture('test_upload_file.txt').then((fileContent) => {
        cy.get('@fileInput').attachFile({
            fileContent: fileContent.toString(),
            fileName: fileName,
            mimeType: 'text/plain'
        });
    });
    // Verify file was added
    cy.contains(fileName);
}

function clickDataset () {
    const datasetsTableWrapper = createWrapper().findTable('[data-cy="Dataset-table"]');        
    // Click on the first item's selection box
    cy.get(datasetsTableWrapper.findRowSelectionArea(1).toSelector()).scrollIntoView().click();
}

function clickAndAction (action: string) {
    // Click the actions dropdown and click the provided action button
    const actionsDropdownWrapper = createWrapper().findButtonDropdown('[data-cy="dataset-actions-dropdown"]');
    cy.get(actionsDropdownWrapper.toSelector()).scrollIntoView().click();
    cy.get(actionsDropdownWrapper.findItemById(action).toSelector()).click();
}

function generateDatasetName (datasetType: string) {
    return `e2eTest${datasetType}Dataset${testTime}`;
}

function generateDatasetDescription (datasetType: string) {
    return `${datasetType} dataset test`;
}