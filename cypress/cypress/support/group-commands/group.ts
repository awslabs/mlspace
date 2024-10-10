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
import { GroupProps } from '../test-initializer/types';
import { BASE_URL } from '../commands';

const createGroup = ({ name, description }: GroupProps) => {
    cy.intercept('GET', `**/group/${name}**`).as('getGroup');

    cy.visit(`${BASE_URL}#/personal/group`);
    cy.contains('Create Group').click();
    cy.url().should('include', '/groups/create');

    cy.setValueCloudscapeInput('name-input', name);
    cy.setValueCloudscapeTextArea('description-input', description);

    // Verify that the values have been updated
    cy.verifyCloudscapeInput('name-input', name);
    cy.verifyCloudscapeTextArea('description-input', description);

    cy.get('[data-cy="submit"]').click();
    cy.wait('@getGroup', { timeout: 10000 });
    cy.url().should('include', `/groups/${name}`);
    dismissNotification(`Successfully created group ${name}`);
    dismissNotification(`Users added to group: ${name}.`);
};

const deleteGroup = (groupName: string) => {
    cy.visit(`${BASE_URL}#/admin/groups/${groupName}`);
    cy.contains('Actions').click();
    cy.contains('Delete').click();
    cy.contains(`Delete "${groupName}"?`);
    cy.get('[data-cy="modal-delete"]').click();
    cy.contains(`Group ${groupName} deleted.`);
    cy.url().should('not.include', `groups/${groupName}`);
};

Cypress.Commands.add('createGroup', (props: GroupProps) => {
    return createGroup(props);
});

Cypress.Commands.add('deleteGroup', (groupName: string) => {
    return deleteGroup(groupName);
});

