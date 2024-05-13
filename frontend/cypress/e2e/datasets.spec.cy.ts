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

import { dataset } from './resources';
import {
    BASE_URL,
    DEFAULT_USERNAME,
    login,
} from '../support/commands';
import createWrapper from '@cloudscape-design/components/test-utils/selectors';
import { TestProps } from '../support/test-initializer/types';

describe('Dataset Tests', () => {
    const testTime = new Date().getTime();
    const testProjectPrefix = 'Datasets';
    const testProjectName = `${testProjectPrefix}${testTime}`;
    const datasetName = `e2eTestDataset${testTime}`;
    const testDataset = { ...dataset, DatasetName: `${datasetName}`, ProjectName: `${testProjectName}` };

    const testProps: TestProps = {
        login: true,
        projectPrefix: testProjectPrefix,
        projects: [{
            name: `${testProjectPrefix}${testTime}`,
            description: `Test project used for testing ${testProjectPrefix}`
        }],
    };

    before(() => {
        cy.initializeTest(testProps);
    });

    beforeEach(() => {
        Cypress.session.clearAllSavedSessions();
        // Call login routine
        login();
        // Navigate to notebook instances page
        cy.visit(`${BASE_URL}#/project/${testProjectName}/dataset`);
        cy.url().should('include', `#/project/${testProjectName}/dataset`);
    });

    after(async () => {
        cy.teardownTest(testProps);
    });

    it('Create Dataset', () => {
        cy.contains('Create dataset').click();
        cy.url().should('include', '/dataset/create');

        // Set dataset values
        cy.setValueCloudscapeInput('dataset-name-input', datasetName);
        cy.setValueCloudscapeTextArea('dataset-description-textarea', testDataset.DatasetDescription);
        cy.setValueCloudscapeSelect('dataset-type-select', testDataset.DatasetType.toLocaleLowerCase());
        cy.get('[data-cy="dataset-file-upload-input"]').as('fileInput');
        cy.fixture('test_upload_file.txt').then((fileContent) => {
            cy.get('@fileInput').attachFile({
                fileContent: fileContent.toString(),
                fileName: 'test_upload_file.txt',
                mimeType: testDataset.DatasetFormat
            });
        });

        // Verify expected values were input and retained by the form
        cy.verifyCloudscapeInput('dataset-name-input', datasetName);
        cy.verifyCloudscapeTextArea('dataset-description-textarea', testDataset.DatasetDescription);
        cy.verifyCloudscapeSelect('dataset-type-select', testDataset.DatasetType);
        cy.get('[data-cy="dataset-submit-button"]').click();
        cy.wait(2000);
        
        // Verify dataset creation redirected to main dataset page
        cy.url().should('include', `#/project/${testProjectName}/dataset`).should('include', datasetName);

        // Wait for the dataset to be populated and redirect to the datasets page
        // Occasional failures to load were observed at 5000ms wait time in development
        cy.visit(`${BASE_URL}#/project/${testProjectName}/dataset`);
        cy.wait(2000);
        cy.reload();

        // Verify dataset was created
        // Filter for the item so that it is the only one in the list
        const datasetsTableWrapper = createWrapper().findTable('[data-cy="Dataset-table"]');
        cy.get(datasetsTableWrapper.findFilterSlot().toSelector()).type(testDataset.DatasetName);
        cy.get(`[data-cy="${datasetName}"]`);
    });

    it('Dataset Details', () => {
        // Filter for the item so it is the only one in the list
        const datasetsTableWrapper = createWrapper().findTable('[data-cy="Dataset-table"]');
        cy.get(datasetsTableWrapper.findFilterSlot().toSelector()).type(testDataset.DatasetName);
        // Click on the first item's selection box
        cy.get(datasetsTableWrapper.findRowSelectionArea(1).toSelector()).click();

        // Click the actions dropdown and click edit
        const actionsDropdownWrapper = createWrapper().findButtonDropdown('[data-cy="dataset-actions-dropdown"]');
        cy.get(actionsDropdownWrapper.toSelector()).click();
        cy.get(actionsDropdownWrapper.findItemById('details').toSelector()).click();

        cy.get('[data-cy="Name-value"]').should('have.text', testDataset.DatasetName);
        cy.get('[data-cy="Description-value"]').should('have.text', testDataset.DatasetDescription);
        cy.get('[data-cy="Access level-value"]').should('have.text', testDataset.DatasetType.toLowerCase());
        // Should not have the default empty text
        cy.get('[data-cy="Location-value"]').should('not.have.text', '-');
    });

    it('Delete Dataset File', () => {
        // Filter for the item so it is the only one in the list
        const datasetsTableWrapper = createWrapper().findTable('[data-cy="Dataset-table"]');
        cy.get(datasetsTableWrapper.findFilterSlot().toSelector()).type(testDataset.DatasetName);
        // Click on the first item's selection box
        cy.get(datasetsTableWrapper.findRowSelectionArea(1).toSelector()).scrollIntoView().click();

        // Click the actions dropdown and click edit
        const actionsDropdownWrapper = createWrapper().findButtonDropdown('[data-cy="dataset-actions-dropdown"]');
        cy.get(actionsDropdownWrapper.toSelector()).scrollIntoView().click();
        cy.get(actionsDropdownWrapper.findItemById('edit').toSelector()).scrollIntoView().click();

        // Open the files tab and select the one and only uploaded file
        cy.get(createWrapper().findExpandableSection('[data-cy="dataset-manage-files-expand"]').toSelector()).scrollIntoView().click();
        const tableItem = `${testDataset.DatasetType.toLowerCase()}/datasets/${testDataset.DatasetName}/test_upload_file.txt`;
        cy.selectCloudscapeTableRow(tableItem);
        cy.verifySelectCloudscapeTableRow(tableItem);
        cy.contains('Delete').click();
        cy.get('[data-cy="modal-delete"]').click();
        cy.contains('No Files exist');
    });

    it('Update Dataset', () => {
        // Filter for the item so it is the only one in the list
        const datasetsTableWrapper = createWrapper().findTable('[data-cy="Dataset-table"]');
        cy.get(datasetsTableWrapper.findFilterSlot().toSelector()).type(testDataset.DatasetName);
        // Click on the first item's selection box
        cy.get(datasetsTableWrapper.findRowSelectionArea(1).toSelector()).scrollIntoView().click();

        // Click the actions dropdown and click edit
        const actionsDropdownWrapper = createWrapper().findButtonDropdown('[data-cy="dataset-actions-dropdown"]');
        cy.get(actionsDropdownWrapper.toSelector()).scrollIntoView().click();
        cy.get(actionsDropdownWrapper.findItemById('edit').toSelector()).click();

        // Check that expected values are available
        cy.get(createWrapper().findInput('[data-cy="dataset-type"]').findNativeInput().toSelector()).should('have.value', testDataset.DatasetType.toLowerCase());
        cy.get(createWrapper().findInput('[data-cy="dataset-owner"]').findNativeInput().toSelector()).should('have.value', DEFAULT_USERNAME);
        cy.get(createWrapper().findTextarea('[data-cy="dataset-description"]').findNativeTextarea().toSelector()).should('have.value', testDataset.DatasetDescription);

        // Update description
        cy.get(createWrapper().findTextarea('[data-cy="dataset-description"]').findNativeTextarea().toSelector()).type(' Updated');

        // Open the Manage Files expandable section
        cy.get(createWrapper().findExpandableSection('[data-cy="dataset-manage-files-expand"]').toSelector()).scrollIntoView().click();

        cy.get('[data-cy="dataset-file-upload-input"]').as('fileInput');
        cy.fixture('test_upload_file.txt').then((fileContent) => {
            cy.get('@fileInput').attachFile({
                fileContent: fileContent.toString(),
                fileName: 'test_second_upload_file.txt',
                mimeType: testDataset.DatasetFormat
            });
        });

        // Verify file was added
        cy.contains('test_second_upload_file.txt');

        cy.contains('Update dataset').scrollIntoView().click();

        // Check that the description was actually updated on the details page
        cy.get(datasetsTableWrapper.findFilterSlot().toSelector()).type(testDataset.DatasetName);
        cy.get(datasetsTableWrapper.findRowSelectionArea(1).toSelector()).scrollIntoView().click();
        cy.get(actionsDropdownWrapper.toSelector()).click();
        cy.get(actionsDropdownWrapper.findItemById('details').toSelector()).click();
        cy.get('[data-cy="Description-value"]').should('have.text', `${testDataset.DatasetDescription} Updated`);
    });

    it('Delete Dataset', () => {
        // Filter for the item so it is the only one in the list
        const datasetsTableWrapper = createWrapper().findTable('[data-cy="Dataset-table"]');
        cy.get(datasetsTableWrapper.findFilterSlot().toSelector()).type(testDataset.DatasetName);
        // Click on the first item's selection box
        cy.get(datasetsTableWrapper.findRowSelectionArea(1).toSelector()).scrollIntoView().click();

        // Click the actions dropdown and click edit
        const actionsDropdownWrapper = createWrapper().findButtonDropdown('[data-cy="dataset-actions-dropdown"]');
        cy.get(actionsDropdownWrapper.toSelector()).scrollIntoView().click();
        cy.get(actionsDropdownWrapper.findItemById('delete').toSelector()).click();
        cy.get('[data-cy="modal-delete"]').click();

        // Check that the dataset is deleted
        cy.contains('0 matches');
    });
});
