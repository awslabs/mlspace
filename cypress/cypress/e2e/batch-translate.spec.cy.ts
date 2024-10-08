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

import { ACCOUNT_ID, BASE_URL } from '../support/commands';
import { TestProps } from '../support/test-initializer/types';

describe('Batch Translate Tests', () => {
    const now = (new Date()).getTime();
    const testProjectPrefix = 'e2eTest';
    const testProjectName = `${testProjectPrefix}${now}`;
    const testProjectDescription = 'This is an example project for E2E batch translate tests.';
    const testDatasetNameIn = `e2eBatchTranslateTestDatasetIn${now}`;
    const testDatasetInputURI = `s3://mlspace-data-${ACCOUNT_ID}/global/datasets/${testDatasetNameIn}/`;
    const testDatasetNameOut = `e2eBatchTranslateTestDatasetOut${now}`;
    const testDatasetOutputURI = `s3://mlspace-data-${ACCOUNT_ID}/global/datasets/${testDatasetNameOut}/`;
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
        cy.setValueCloudscapeInput('s3-output-location-input', testDatasetInputURI);
        cy.setValueCloudscapeInput('s3-output-location-output', testDatasetOutputURI);
        // Verify that the values have been updated
        cy.verifyCloudscapeInput('name-input', testBatchTranslateName);
        cy.verifyCloudscapeSelect('source-language-select', 'en');
        cy.verifyCloudscapeMultiselect('target-language-multiselect', targetLanguageTokens);
        cy.verifyCloudscapeInput('s3-output-location-input', testDatasetInputURI);
        cy.verifyCloudscapeInput('s3-output-location-output', testDatasetOutputURI);
        cy.get('[data-cy="batch-translate-submit"]').click();
        cy.contains(`Successfully created translation job ${testBatchTranslateName}`, { timeout: 10000 });
    });
});