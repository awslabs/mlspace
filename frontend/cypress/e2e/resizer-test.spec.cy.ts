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

describe('Dataset Tests', () => {
    const testTime = new Date().getTime();
    const testProjectPrefix = 'Resizer';
    const testProjectName = `${testProjectPrefix}${testTime}`;

    const testProps: TestProps = {
        login: true,
        projectPrefix: testProjectPrefix,
        projects: [{
            name: `${testProjectName}`,
            description: `Test project used for testing ${testProjectPrefix}`
        }],
    };

    after(async () => {
        cy.teardownTest(testProps);
    });

    before(() => {
        cy.initializeTest(testProps);
    });

    beforeEach(() => {
        Cypress.session.clearAllSavedSessions();
        // Call login routine
        login();
        // Navigate to notebook instances page
        cy.visit(`${BASE_URL}#/`);
    });

    it('Trigger Resizer', () => {
        cy.visit(`${BASE_URL}#/project/FirstProject/jobs/training/create`);
        cy.setValueCloudscapeSelect('algorithm-create', 'Vision - Semantic Segmentation (MxNet)');
        cy.viewport(600,500);
        cy.setValueCloudscapeSelect('algorithm-create', 'Tabular - Linear Learner');
        cy.setValueCloudscapeSelect('algorithm-create', 'Vision - Semantic Segmentation (MxNet)');
    });
});
