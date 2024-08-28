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

import { login } from '../support/commands';

describe('Project Tests', () => {
    const testProjectName = `e2eTest${(new Date()).getTime()}`;
    const testProjectDescription = 'This is an example project for E2E tests.';
    const baseUrl = Cypress.env('base_url');

    before(() => {
        Cypress.session.clearAllSavedSessions();
    });

    beforeEach(() => {
        login();
    });

    it('Create Project', () => {
        cy.visit(baseUrl);


        cy.contains('Create Project').click();
        cy.url().should('include', '/project/create');

        cy.get('[data-cy="name-input"] > input').type(testProjectName);
        cy.get('[data-cy="description-input"] > textarea').type(testProjectDescription);
        // Verify that the values have been updated
        cy.get('[data-cy="name-input"] > input').should('have.value', testProjectName);
        cy.get('[data-cy="description-input"] > textarea').should('have.value', testProjectDescription);


        cy.get('[data-cy="submit"]').click();
        cy.intercept('GET', `**/project/${name}**`).as('getProject');
        cy.wait('@getProject', { timeout: 10000 });

        cy.url().should('include', `/project/${testProjectName}`);
        cy.contains(testProjectName);
    });

    it('Suspend project', () => {
        cy.visit(`${baseUrl}/#/project/${testProjectName}`);

        cy.contains('Actions').click();
        cy.contains('Suspend project').click();
        // Should get pop up asking for confirmation
        cy.contains(`Suspend ${testProjectName}?`);
        cy.get('[data-cy="modal-confirm-btn"]').click();
        cy.contains(`Project ${testProjectName} suspended.`);
    });

    it('Reinstate project', () => {
        cy.visit(`${baseUrl}/#/project/${testProjectName}`);
        cy.contains('Actions').click();
        // Delete option should be available for suspended project
        cy.contains('Delete project');
        cy.contains('Reinstate project').click();
        cy.contains(`Project ${testProjectName} reinstated.`);
    });

    it('Delete project', () => {
        cy.visit(`${baseUrl}/#/project/${testProjectName}`);
        cy.contains('Actions').click();
        cy.contains('Suspend project').click();
        cy.contains(`Suspend ${testProjectName}?`);
        cy.get('[data-cy="modal-confirm-btn"]').click();
        cy.contains(`Project ${testProjectName} suspended.`);
        cy.reload();
        cy.contains('Actions').click();
        cy.contains('Delete project').click();
        cy.contains(`Delete ${testProjectName}?`);
        cy.get('[data-cy="modal-confirm-btn"]').click();
        cy.wait(3000);
        cy.contains(`Project ${testProjectName} deleted.`);
        cy.url().should('not.include', `project/${testProjectName}`);
        cy.contains('Available projects');
    });
});
