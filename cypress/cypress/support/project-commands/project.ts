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

import { dismissNotification } from '../cloudscape-utils/utils';
import { ProjectProps } from '../test-initializer/types';
import { BASE_URL } from '../commands';

const baseUrl = Cypress.env('base_url');

const createProject = ({ name, description }: ProjectProps) => {
    cy.intercept('GET', `**/project/${name}**`).as('getProject');
    cy.visit(baseUrl);
    cy.contains('Create Project').click();
    cy.url().should('include', '/project/create');
    cy.setValueCloudscapeInput('name-input', name);
    cy.setValueCloudscapeTextArea('description-input', description);
    // Verify that the values have been updated
    cy.verifyCloudscapeInput('name-input', name);
    cy.verifyCloudscapeTextArea('description-input', description);
    cy.get('[data-cy="submit"]').click();
    cy.wait('@getProject');
    cy.url().should('include', `/project/${name}`);
    dismissNotification(`Successfully created project ${name}`);
};

const deleteProject = (projectName: string) => {
    cy.visit(`${baseUrl}/#/project/${projectName}`);
    cy.contains('Actions').click();
    cy.contains('Suspend project', { timeout: 5000 }).click();
    cy.contains(`Suspend ${projectName}?`);
    cy.get('[data-cy="modal-confirm-btn"]').click();
    cy.contains(`Project ${projectName} suspended.`);
    cy.reload();
    cy.contains('Actions').click();
    cy.contains('Delete project').click();
    cy.contains(`Delete ${projectName}?`);
    cy.get('[data-cy="modal-confirm-btn"]').click();
    cy.contains(`Project ${projectName} deleted.`);
    cy.url().should('not.include', `project/${projectName}`);
};

/**
 * Requires that the user is logged in
 *
 * Uses the /project API to get all of the user's projects with the current credentials
 *
 * @param projectNamePrefix The prefix of the projects to be deleted
 * @param maxNumberOfDeletes Maximum number of projects to be deleted
 *   Default is 5 to avoid long duration deleting a backlog of projects
 */
const deleteProjectsWithPrefix = (projectNamePrefix: string, maxNumberOfDeletes = 5) => {
    let numberDeleted = 0;

    for (const sessionStorageKey in sessionStorage) {
        if (sessionStorageKey.startsWith('oidc.user')) {
            // Use OIDC header to connect to the project API
            cy.request({
                url: `${BASE_URL}/project/`,
                headers: {
                    Authorization: `Bearer ${JSON.parse(sessionStorage.getItem(sessionStorageKey)!).id_token}`
                },
                method: 'GET',
                followRedirect: false
            }).then((response) => {
                const allProjects = response.body;

                for (let i = 0; i < allProjects.length; i++) {
                    const project = allProjects[i];
                    if (project.name.startsWith(projectNamePrefix)) {
                        deleteProject(project.name);

                        if (++numberDeleted >= maxNumberOfDeletes) {
                            break;
                        }
                    }
                }
            });
        }
    }
};

Cypress.Commands.add('createProject', (props: ProjectProps) => {
    return createProject(props);
});

Cypress.Commands.add('deleteProject', (projectName: string) => {
    return deleteProject(projectName);
});

Cypress.Commands.add('deleteProjectsWithPrefix', (projectNamePrefix: string, maxNumberOfDeletes = 5) => {
    return deleteProjectsWithPrefix(projectNamePrefix, maxNumberOfDeletes);
});

