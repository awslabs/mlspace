import { BASE_URL } from '../support/commands';
import { TestProps } from '../support/test-initializer/types';

describe('Batch Translate Tests', () => {
    const now = (new Date()).getTime();
    const testProjectPrefix = 'e2eTest';
    const testProjectName = `${testProjectPrefix}${now}`;
    const testProjectDescription = 'This is an example project for E2E tests.';
    const testDatasetNameIn = `e2eBatchTranslateTestDatasetIn${now}`;
    const testDatasetNameOut = `e2eBatchTranslateTestDatasetOut${now}`;
    const testDatasetDescription = 'This is an example dataset for E2E batch translate tests.';
    const testBatchTranslateName = `e2eTestBatchTranslateJob${now}`;
    const targetLanguages = ['fr', 'de'];
    const targetLanguageTokens = ['French (fr)', 'German (de)'];
    const testProps: TestProps = {
        login: true,
        projectPrefix: testProjectPrefix,
        projects: [{
            name: testProjectName,
            description: testProjectDescription
        }],
        datasets: [
            {
                name: testDatasetNameIn,
                description: testDatasetDescription,
                type: 'global',
                format: 'text/plain',
                files: ['test_upload_file.txt']
            },
            {
                name: testDatasetNameOut,
                description: testDatasetDescription,
                type: 'global',
                format: 'text/plain',
                files: ['test_upload_file.txt']
            }
        ]
    };

    const knownAccessibilityDefects = [
        'The aria-posinset attribute is not allowed on this element because it does not have the correct role attribute',
        'The aria-posinset attribute is not allowed on this LI because it does not have the correct role attribute',
        'The aria-posinset and aria-setsize attribute pair is not allowed on this LI because it does not have the correct role attribute',
        'The aria-setsize attribute is not allowed on this LI because it does not have the correct role attribute',
    ];

    before(() => {
        cy.initializeTest(testProps);
    });

    after(() => {
        cy.teardownTest(testProps);
    });

    beforeEach(() => {
        cy.visit(`${BASE_URL}/#/project/${testProjectName}`);
    });

    it('Create Batch Translate Job', () => {
        cy.contains('Translation').click();
        cy.contains('Batch translate').click();
        cy.url().should('include', '/batch-translate');
        cy.contains('Create batch translate job').click();
        cy.url().should('include', '/batch-translate/create');
        // Input values into batch translate create job
        cy.setValueCloudscapeInput('name-input', testBatchTranslateName);
        cy.setValueCloudscapeSelect('source-language-select', 'en');
        cy.setValueCloudscapeMultiselect('target-language-multiselect', targetLanguages);
        cy.setValueCloudscapeSelect('s3-input-location-select', testDatasetNameIn);
        cy.setValueCloudscapeAutoSuggest('s3-output-location-input', testDatasetNameOut);
        // Verify that the values have been updated
        cy.verifyCloudscapeInput('name-input', testBatchTranslateName);
        cy.verifyCloudscapeSelect('source-language-select', 'en');
        cy.verifyCloudscapeMultiselect('target-language-multiselect', targetLanguageTokens);
        cy.verifyCloudscapeSelect('s3-input-location-select', testDatasetNameIn);
        cy.verifyCloudscapeAutoSuggest('s3-output-location-input', testDatasetNameOut);
        cy.get('[data-cy="batch-translate-submit"]').click();
        cy.contains(`Successfully created translation job ${testBatchTranslateName}`, { timeout: 10000 });
    });
});