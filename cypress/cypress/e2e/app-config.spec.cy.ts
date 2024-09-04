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
    login,
} from '../support/commands';
import { TestProps } from '../support/test-initializer/types';

const testPrefix = 'AppConfig';
const testTime = new Date().getTime();
const testProjectName = `${testPrefix}${testTime}`;

describe('App Config Tests', () => {

    const testProps: TestProps = {
        login: true,
        projectPrefix: testPrefix,
        projects: [{
            name: testProjectName,
            description: `Test project used for testing ${testPrefix}`
        }],
    };

    before(() => {
        cy.initializeTest(testProps);
    });

    beforeEach(() => {
        Cypress.session.clearAllSavedSessions();
        // Call login routine
        login();
        // Navigate to app config page
        cy.visit(`${BASE_URL}#/admin/configuration`);
        cy.url().should('include', '#/admin/configuration');
    });

    after(async () => {
        cy.teardownTest(testProps);
    });

    // it('Disable Instance Type - Notebook', () => {
    //     cy.get('[data-cy="Notebook-Expandable-Section"]').click();
    //     // TODO: Section is expanding fine but now we can't find the item in the multiselect
    //     cy.setValueCloudscapeMultiselect('instance-type-multi-select-InstanceType', ['ml.t2.medium']);
    //     cy.get('[data-cy="dynamic-configuration-submit"]').click();
    //     cy.get('[data-cy="config-submit-button"]').click();
    //     cy.intercept('POST', '**/app-config').as('updateConfig');
    //     cy.wait('@updateConfig', { timeout: 10000 });
    // });

    // it('Enable Instance Type - Notebook', () => {
    //     //TODO
    // });

    it('Deactivate Service - GroundTruth', () => {
        cy.intercept('POST', '**/app-config').as('updateConfig');
        cy.get('[data-cy="Toggle-labelingJob"]').click();
        cy.get('[data-cy="dynamic-configuration-submit"]').click();

        cy.get('[data-cy="config-submit-button"]').click();

        
        cy.wait('@updateConfig', { timeout: 10000 });
        cy.visit(`${BASE_URL}#/project/${testProjectName}/jobs/labeling`);
        cy.contains('Not Found');
    });

    it('Activate Service - GroundTruth', () => {
        cy.intercept('POST', '**/app-config').as('updateConfig');
        cy.get('[data-cy="Toggle-labelingJob"]').click();
        cy.get('[data-cy="dynamic-configuration-submit"]').click();

        cy.get('[data-cy="config-submit-button"]').click();

        
        cy.wait('@updateConfig', { timeout: 10000 });
        cy.visit(`${BASE_URL}#/project/${testProjectName}/jobs/labeling`);
        cy.contains('Create new labeling job');
    });
});