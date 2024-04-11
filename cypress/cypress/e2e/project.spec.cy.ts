import { login } from '../support/commands';

describe('Project Tests', () => {
    const testProjectName = `e2eTest${(new Date()).getTime()}`;
    const testProjectDescription = 'This is an example project for E2E tests.';
    const baseUrl = Cypress.env('base_url');
    const username = Cypress.env('username');
    const password = Cypress.env('password');

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
