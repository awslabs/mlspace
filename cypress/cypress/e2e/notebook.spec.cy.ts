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
import { notebookInstance, newNotebookInstance, notebookOptions, project, computeTypes } from './resources';

describe('Notebook Tests', () => {
    const testTime = new Date().getTime();
    const notebookName = `e2eTestNotebook${testTime}`;
    const projectName = `e2eTestProject${testTime}`;
    const baseUrl = Cypress.env('base_url');
    const username = Cypress.env('username');
    const password = Cypress.env('password');


    before(() => {
        Cypress.session.clearAllSavedSessions();
        const resizeObserverLoopErrRe = /^[^(ResizeObserver loop limit exceeded)]/;
        Cypress.on('uncaught:exception', (err) => {
            /* returning false here prevents Cypress from failing the test */
            if (resizeObserverLoopErrRe.test(err.message)) {
                return false;
            }
        });
    });

    beforeEach(() => {
        Cypress.session.clearAllSavedSessions();
        const testProject = { ...project, project: { ...project.project, name: projectName } };
        // Register interceptor for returning mock project
        cy.intercept('GET', `**/project/${projectName}`, testProject);
        // Register interceptor for returning list of mock projects
        cy.intercept('GET', '**/project', [testProject.project]);
        // Register interceptor for returning no notebook instances
        cy.intercept('GET', '**/notebooks', { records: [] });
        // Register interceptor for notebook launch
        cy.intercept('GET', '**/notebook/*/url', {
            AuthorizedUrl: 'https://somefakeurl.amazon.com/open-notebook-instance/example-name&AUTH'
        });
        // Register interceptor to get notebook options from lambda call
        cy.intercept('GET', '**/metadata/notebook-options', notebookOptions);
        // Register interceptor to get compute types from lambda call
        cy.intercept('GET', '**/metadata/compute-types', computeTypes);
        // Register interceptor for notebook logs
        cy.intercept('GET', '**/notebook/*/logs*', {
            events: [
                {
                    logStreamName: 'notebook-example/jupyter.log',
                    timestamp: 1679516346377,
                    message: 'Example log event message',
                    ingestionTime: 1679516360980,
                    eventId: '37454466097320577689651565999376913764533911265058488320'
                },
                {
                    logStreamName: 'notebook-example/jupyter.log',
                    timestamp: 1679516346377,
                    message: 'Second event message',
                    ingestionTime: 1679516360980,
                    eventId: '37454466097320577689651565999376913764533911265058488321'
                }
            ],
            // eslint-disable-next-line spellcheck/spell-checker
            nextToken: 'Bxkq6kVGFtq2y_MoigeqscPOdhXVbhiVtLoAmXb5jCqS'
        });
        // Call login routine
        login();
        // Navigate to notebook instances page
        cy.visit(`${baseUrl}#/project/${projectName}/notebook`);
        cy.url().should('include', `#/project/${projectName}/notebook`);
    });

    it('Create Notebook', () => {
        const createdNotebook = { ...newNotebookInstance, NotebookInstanceName: `${notebookName}`, ProjectName: `${projectName}` };
        cy.intercept('GET', `**/notebook/${notebookName}`, createdNotebook);
        // Register interceptor to capture POST to notebook, verify body, and return success
        cy.intercept('POST', '**/notebook', (req) => {
            const { body } = req;
            assert.deepEqual(body, createdNotebook);
            req.reply({ statusCode: 200 });
        });
        cy.contains('Create notebook instance').click();
        cy.url().should('include', '/notebook/create');
        // Set notebook values
        cy.get('[data-cy="name-input"] > input').type(notebookName);
        cy.setValueCloudscapeSelect('instance-type-select', 'ml.t3.xlarge');
        // Verify that the name has been updated
        cy.get('[data-cy="name-input"] > input').should('have.value', notebookName);
        cy.get('[data-cy="submit"]').scrollIntoView().click();
        // Verify notebook creation redirected to notebook details page
        cy.url().should('include', `#/project/${projectName}/notebook/${notebookName}`);
    });

    it('Stop Notebook', () => {
        const testNotebook = { ...notebookInstance, NotebookInstanceName: notebookName, NotebookInstanceStatus: 'InService' };
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, testNotebook);
        cy.intercept('POST', '**/stop', (req) => {
            expect(req.url).to.contain(`/notebook/${notebookName}/stop`);
            expect(req.headers['x-mlspace-project']).to.equal(projectName);
            req.reply({ statusCode: 200 });
        }).as('stop');
        cy.visit(`${baseUrl}#/project/${projectName}/notebook/${projectName}-${username}-${notebookName}`);
        cy.get('[data-cy="notebook-stop"]').scrollIntoView().click();
        cy.wait('@stop').should((intercept) => {
            expect(intercept.response?.statusCode).to.equal(200);
            expect(intercept.request.url).to.contain(`/notebook/${notebookName}/stop`);
        });
    });

    it('Stop Notebook Disabled', () => {
        // Change the status of the notebook before every page reload and test that the stop button is disabled
        const testNotebook = { ...notebookInstance, NotebookInstanceName: notebookName, NotebookInstanceStatus: 'Pending' };
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, testNotebook);
        cy.visit(`${baseUrl}#/project/${projectName}/notebook/${projectName}-${username}-${notebookName}`);
        cy.get('[data-cy="notebook-stop"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Stopping' });
        cy.reload();
        cy.get('[data-cy="notebook-stop"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Deleting' });
        cy.reload();
        cy.get('[data-cy="notebook-stop"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Updating' });
        cy.reload();
        cy.get('[data-cy="notebook-stop"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Stopped' });
        cy.reload();
        cy.get('[data-cy="notebook-stop"]').should('not.exist');
    });

    it('Start Notebook', () => {
        const testNotebook = { ...notebookInstance, NotebookInstanceName: notebookName, NotebookInstanceStatus: 'Stopped' };
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, testNotebook);
        cy.intercept('POST', '**/start', (req) => {
            expect(req.url).to.contain(`/notebook/${notebookName}/start`);
            expect(req.headers['x-mlspace-project']).to.equal(projectName);
            req.reply({ statusCode: 200 });
        }).as('start');
        cy.visit(`${baseUrl}#/project/${projectName}/notebook/${projectName}-${username}-${notebookName}`);
        cy.get('[data-cy="notebook-start"]').scrollIntoView().click();
        cy.wait('@start').should((intercept) => {
            expect(intercept.response?.statusCode).to.equal(200);
            expect(intercept.request.url).to.contain(`/notebook/${notebookName}/start`);
        });
    });

    it('Start Notebook Disabled', () => {
        // Change the status of the notebook before every page reload and test that the start button is disabled
        const testNotebook = { ...notebookInstance, NotebookInstanceName: notebookName, NotebookInstanceStatus: 'Pending' };
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, testNotebook);
        cy.visit(`${baseUrl}#/project/${projectName}/notebook/${projectName}-${username}-${notebookName}`);
        cy.get('[data-cy="notebook-start"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Stopping' });
        cy.reload();
        cy.get('[data-cy="notebook-start"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Deleting' });
        cy.reload();
        cy.get('[data-cy="notebook-start"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Updating' });
        cy.reload();
        cy.get('[data-cy="notebook-start"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'InService' });
        cy.reload();
        cy.get('[data-cy="notebook-start"]').should('not.exist');
    });

    it('Update Notebook', () => {
        const testNotebook = { ...notebookInstance, NotebookInstanceName: `${notebookName}`, NotebookInstanceStatus: 'Stopped' };
        cy.intercept('GET', `**/notebook/${notebookName}`, testNotebook);
        cy.intercept('PUT', `**/notebook/${notebookName}`, (req) => {
            expect(req.url).to.contain(`/notebook/${notebookName}`);
            expect(req.body.NotebookInstanceName).to.equal(`${notebookName}`);
            expect(req.body.InstanceType).to.equal('ml.t2.large');
            expect(req.body.NotebookInstanceLifecycleConfigName).to.equal('No configuration');
            expect(req.body.VolumeSizeInGB).to.equal(5);
            req.reply({ statusCode: 200 });
        });
        cy.visit(`${baseUrl}#/project/${projectName}/notebook/${notebookName}`);
        cy.get('[data-cy="notebook-edit"]').click();
        cy.url().should('include', `/notebook/${notebookName}/edit`);
        cy.setValueCloudscapeSelect('instance-type-select', 'ml.t2.large');
        cy.get('[data-cy="submit"]').scrollIntoView().click();
        cy.url().should('eq', `${baseUrl}#/project/${projectName}/notebook/${notebookName}`);
    });

    it('Update Notebook Disabled', () => {
        // Change the status of the notebook before every page reload and test that the edit button is disabled
        const testNotebook = { ...notebookInstance, NotebookInstanceName: notebookName, NotebookInstanceStatus: 'Pending' };
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, testNotebook);
        cy.visit(`${baseUrl}#/project/${projectName}/notebook/${projectName}-${username}-${notebookName}`);
        cy.get('[data-cy="notebook-edit"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Stopping' });
        cy.reload();
        cy.get('[data-cy="notebook-edit"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Deleting' });
        cy.reload();
        cy.get('[data-cy="notebook-edit"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Updating' });
        cy.reload();
        cy.get('[data-cy="notebook-edit"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'InService' });
        cy.reload();
        cy.get('[data-cy="notebook-edit"]').should('have.attr', 'disabled');
    });

    it('Delete Notebook', () => {
        const testNotebook = { ...notebookInstance, NotebookInstanceName: `${projectName}-${username}-${notebookName}`, NotebookInstanceStatus: 'Stopped' };
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, testNotebook);
        cy.intercept('DELETE', `**/notebook/${projectName}-${username}-${notebookName}`, (req) => {
            expect(req.url).to.contain(`/notebook/${projectName}-${username}-${notebookName}`);
            req.reply({ statusCode: 200 });
        });
        cy.visit(`${baseUrl}#/project/${projectName}/notebook/${projectName}-${username}-${notebookName}`);
        cy.get('[data-cy="notebook-delete"]').scrollIntoView().click();
        cy.get('[data-cy="modal-delete"]').click();
        cy.url().should('eq', `${baseUrl}#/project/${projectName}/notebook`);
    });

    it('Delete Notebook Disabled', () => {
        // Change the status of the notebook before every page reload and test that the delete button is disabled
        const testNotebook = { ...notebookInstance, NotebookInstanceName: notebookName, NotebookInstanceStatus: 'Pending' };
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, testNotebook);
        cy.visit(`${baseUrl}#/project/${projectName}/notebook/${projectName}-${username}-${notebookName}`);
        cy.get('[data-cy="notebook-delete"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Stopping' });
        cy.reload();
        cy.get('[data-cy="notebook-delete"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Deleting' });
        cy.reload();
        cy.get('[data-cy="notebook-delete"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'Updating' });
        cy.reload();
        cy.get('[data-cy="notebook-delete"]').should('have.attr', 'disabled');
        cy.intercept('GET', `**/notebook/${projectName}-${username}-${notebookName}`, { ...testNotebook, NotebookInstanceStatus: 'InService' });
        cy.reload();
        cy.get('[data-cy="notebook-delete"]').should('have.attr', 'disabled');
    });
});
