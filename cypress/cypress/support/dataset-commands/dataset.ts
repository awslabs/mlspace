import createWrapper from '@cloudscape-design/components/test-utils/selectors';
import { BASE_URL, capitalizeFirstLetter } from '../commands';
import { DatasetProps } from '../test-initializer/types';
import { dismissNotification } from '../cloudscape-utils/utils';

const createDataset = ({ name, description, type, format, files }: DatasetProps) => {
    cy.visit(`${BASE_URL}#/personal/dataset`);
    cy.url().should('include', '#/personal/dataset');
    cy.contains('Create dataset').scrollIntoView();
    cy.contains('Create dataset').click();
    cy.url().should('include', '/dataset/create');
    // Set dataset values
    cy.setValueCloudscapeInput('dataset-name-input', name);
    cy.setValueCloudscapeTextArea('dataset-description-textarea', description);
    cy.setValueCloudscapeSelect('dataset-type-select', type);
    cy.setValueCloudscapeAutoSuggest('dataset-format-input', format);
    cy.get('[data-cy="dataset-file-upload-input"]').as('fileInput');
    files.forEach((file) => {
        cy.fixture(file).then((fileContent) => {
            cy.get('@fileInput').attachFile({
                fileContent: fileContent.toString(),
                fileName: file,
                mimeType: format
            });
        });
    });
    // Verify expected values were input and retained by the form
    cy.verifyCloudscapeInput('dataset-name-input', name);
    cy.verifyCloudscapeTextArea('dataset-description-textarea', description);
    cy.verifyCloudscapeSelect('dataset-type-select', capitalizeFirstLetter(type));
    cy.verifyCloudscapeAutoSuggest('dataset-format-input', format);
    cy.get('[data-cy="dataset-submit-button"]').click();
    // Verify dataset creation redirected to main notebook page
    cy.url().should('include', '#/personal/dataset');
    // Wait for the dataset to be populated and redirect to the datasets page
    cy.wait(5000);
    dismissNotification('Successfully uploaded 1 file(s).');
};

const deleteDataset = (datasetName: string) => {
    cy.visit(`${BASE_URL}/#/personal/dataset`);
    cy.url().should('include', '#/personal/dataset');
    // Filter for the item so it is the only one in the list
    const datasetsTableWrapper = createWrapper().findTable('[data-cy="Dataset-table"]');
    cy.setValueCloudscapeTextFilter('Dataset-table', datasetName);
    cy.contains('1 match');
    // Arbitrary wait for DOM to stabilize
    cy.wait(1000);
    // Click on the first item's selection box
    cy.get(datasetsTableWrapper.findRowSelectionArea(1).toSelector()).click();
    // Click the actions dropdown and click edit
    const actionsDropdownWrapper = createWrapper().findButtonDropdown('[data-cy="dataset-actions-dropdown"]');
    cy.get(actionsDropdownWrapper.toSelector()).click();
    cy.get(actionsDropdownWrapper.findItemById('delete').toSelector()).click();
    cy.get('[data-cy="modal-delete"]').click();
    // Check that the dataset is deleted
    cy.contains('0 matches');
    cy.clearCloudscapeTextFilter('Dataset-table');
};

Cypress.Commands.add('createDataset', (props: DatasetProps) => {
    return createDataset(props);
});

Cypress.Commands.add('deleteDataset', (datasetName: string) => {
    return deleteDataset(datasetName);
});

